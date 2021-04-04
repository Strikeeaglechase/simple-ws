import WebSocket from "ws";
import ReplyHandler from "./replyHandler.js";

import { v4 as uuidv4 } from "uuid";
import fs from "fs";
type uuidv4 = () => string;

const PING_RATE = 5000;
interface PacketBase {
	event: string;
	pID: string;
}
interface Heartbeat extends PacketBase {
	event: "heartbeat"
	time: number;
}
interface Responce extends PacketBase {
	event: "responce",
	data?: any;
	orgPID: string;
}
type Packet = Heartbeat | Responce;
// Header for logs
function getDateHeader() {
	function addZero(n: number): string {
		const str = n.toString();
		return str.length >= 2 ? str.substring(0, 2) : "0" + str;
	}

	function THeader(date: Date): string {
		return `[${addZero(date.getHours())}:${addZero(date.getMinutes())}]`;
	}

	function DHeader(date: Date): string {
		return `[${addZero(date.getDate())}/${addZero(
			date.getMonth() + 1
		)}]`;
	}
	const date = new Date();
	const t = DHeader(date) + THeader(date);
	return t;
}
class Client {
	server: Server<Client>;
	socket: WebSocket;
	ping: {
		isAwaitingReply: boolean;
		lastLatency: number;
	}
	awaitingReplys: Array<ReplyHandler>;
	id: string;
	constructor(server: Server<Client>, socket: WebSocket) {
		this.server = server;
		this.socket = socket;
		this.ping = {
			isAwaitingReply: false,
			lastLatency: 0,
		}
		this.awaitingReplys = [];
		this.id = uuidv4();
		this._setupSocket();
	}
	private _setupSocket() {
		this.socket.on("message", (data) => {
			try {
				const packet: Packet = JSON.parse(data.toString());
				this._handlePacket(packet);
			} catch (e) {
				console.log(`Unable to parse packet ${data} - ${e}`);
			}
		});
		this.socket.on("close", () => this.server.close(this.id));
		setInterval(() => this.sendPing(), PING_RATE);
		this.setupSocket();
	}
	private _handlePacket(packet: Packet) {
		switch (packet.event) {
			case "responce":
				this.awaitingReplys = this.awaitingReplys.filter(repl => repl.checkResolved(packet));
				break;
			default: this.handlePacket(packet);
		}
	}
	async sendPing() {
		if (this.ping.isAwaitingReply) return;
		this.ping.isAwaitingReply = true;

		const time: number = await this.send({ event: 'heartbeat', time: Date.now() }, true).catch(() => { });
		if (!time) {
			console.log(`Client ${this.id} timed out`);
			this.server.close(this.id);
			return;
		}

		const latency = Date.now() - time;
		this.ping.lastLatency = latency;
		this.ping.isAwaitingReply = false;

	}
	send(packet: Partial<Packet>, withReply = false) {
		packet.pID = uuidv4();
		const str = JSON.stringify(packet);
		this.socket.send(str);
		this.server.logOutPacket(this, str);
		if (withReply) {
			const handler = new ReplyHandler(packet.pID);
			this.awaitingReplys.push(handler);
			return handler.prom;
		}
	}
	// Methods intended to be overriden by an extended class
	setupSocket() { }
	handlePacket(packet: Packet) { }
}
interface LogConfig {
	path: string;
	file: fs.WriteStream;
	enabled: boolean;
}
class Server<T extends Client> {
	port: number;
	wss: WebSocket.Server;
	ClientConstruct: new (server: Server<T>, socket: WebSocket) => T;
	clients: Client[];
	log: {
		path: string;
		file: fs.WriteStream;
		enabled: boolean;
	}
	constructor(port: number, ClientConstruct: new (server: Server<T>, socket: WebSocket) => T, packetLog?: string) {
		this.port = port;
		this.clients = [];
		this.ClientConstruct = ClientConstruct;
		this.log = this.setupPacketLogger(packetLog);
	}
	setupPacketLogger(path: string): LogConfig {
		if (!path) {
			return {
				path: "",
				file: null,
				enabled: false
			}
		}
		if (!fs.existsSync(path)) {
			fs.writeFileSync(path, "Log created\n");
		}
		const file = fs.createWriteStream(path, { flags: "a" });
		return {
			path: path,
			file: file,
			enabled: true
		}
	}
	init() {
		this.wss = new WebSocket.Server({ port: this.port });
		this.wss.on("connection", (ws) => this.makeConnection(ws));
		this.wss.on("error", (err) => console.log(err));
		this.wss.on("close", () => console.log(`Websocket server closed!`));
		this.wss.on("listening", () => console.log(`Webscoket server open on ${this.port}`));
	}
	makeConnection(ws: WebSocket) {
		const client = new this.ClientConstruct(this, ws);
		this.clients.push(client);
		if (this.log.enabled) {
			client.socket.on("message", (message) => {
				this.log.file.write(`[ IN]${getDateHeader()} (${client.id}) ${message}\n`)
			});
		}
	}
	logOutPacket(client: Client, message: string) {
		if (this.log.enabled) {
			this.log.file.write(`[OUT]${getDateHeader()} (${client.id}) ${message}\n`)
		}
	}
	close(clientID: string) {
		const client = this.clients.find(c => c.id == clientID);
		if (!client) return;
		if (client.socket.readyState == WebSocket.OPEN) {
			client.socket.close();
		}
		this.clients = this.clients.filter(c => c.id != clientID);
	}
}

export {
	Server,
	Packet,
	PacketBase,
	Heartbeat,
	Responce
}