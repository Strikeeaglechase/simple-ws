import WebSocket from "ws";
import ReplyHandler from "./replyHandler.js";

import { v4 as uuidv4 } from "uuid";
import fs from "fs";
type uuidv4 = () => string;

const PING_RATE = 5000;
interface PacketBase {
	event: string;
	pID?: string;
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
	constructor(server: Server<Client>, socket: WebSocket, _ = null) {
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
				this.server.log.logger(`Unable to parse packet ${data} - ${e}`);
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
	private async sendPing() {
		if (this.ping.isAwaitingReply) return;
		this.ping.isAwaitingReply = true;
		const message: Heartbeat = { event: 'heartbeat', time: Date.now() };
		const time: number = await this.send(message, true).catch(() => { });
		if (!time) {
			this.server.log.logger(`Client ${this.id} timed out`);
			this.server.close(this.id);
			return;
		}

		const latency = Date.now() - time;
		this.ping.lastLatency = latency;
		this.ping.isAwaitingReply = false;

	}
	public send<T extends PacketBase>(packet: T, withReply = false) {
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
	public reply<T extends PacketBase>(orgPacket: T, replyData?: any) {
		const reply: Responce = {
			event: "responce",
			data: replyData,
			orgPID: orgPacket.pID,
		}
		this.send(reply);
	}
	public broadcast<T extends PacketBase>(packet: T, withReply = false) {
		this.server.broadcast(this.id, packet, withReply);
	}
	// Methods intended to be overriden by an extended class
	public setupSocket() { }
	public handlePacket(packet: Packet) { }
}
interface LogConfig {
	path: string;
	file: fs.WriteStream;
	enabled: boolean;
	logger: (message: string) => void;
}
interface LogOpts {
	path?: string;
	logger?: (message: string) => void
}
type ClientConstructor<T extends Client> = new (server: Server<T>, socket: WebSocket, obj?: Object) => T;
class Server<T extends Client> {
	private port: number;
	private wss: WebSocket.Server;
	private ClientConstruct: ClientConstructor<T>;
	public clients: Client[];
	public log: LogConfig;
	private constructObj: Object;
	constructor(port: number, ClientConstruct: ClientConstructor<T>, constructObj?: Object, logOpts?: LogOpts) {
		this.port = port;
		this.clients = [];
		this.ClientConstruct = ClientConstruct;
		this.constructObj = constructObj;
		this.log = this.setupPacketLogger(logOpts || {});
	}
	private setupPacketLogger(opts: LogOpts): LogConfig {
		const logFunc = opts.logger || console.log;
		const path = opts.path;
		if (!path) {
			return {
				path: "",
				file: null,
				enabled: false,
				logger: logFunc
			}
		}
		if (!fs.existsSync(path)) {
			fs.writeFileSync(path, "Log created\n");
		}
		const file = fs.createWriteStream(path, { flags: "a" });
		return {
			path: path,
			file: file,
			enabled: true,
			logger: logFunc
		}
	}
	public init() {
		this.wss = new WebSocket.Server({ port: this.port });
		this.wss.on("connection", (ws) => this.makeConnection(ws));
		this.wss.on("error", (err) => this.log.logger(err.toString()));
		this.wss.on("close", () => this.log.logger(`Websocket server closed!`));
		this.wss.on("listening", () => this.log.logger(`Webscoket server open on ${this.port}`));
	}
	private makeConnection(ws: WebSocket) {
		const client = new this.ClientConstruct(this, ws, this.constructObj);
		this.clients.push(client);
		if (this.log.enabled) {
			client.socket.on("message", (message) => {
				this.log.file.write(`[ IN]${getDateHeader()} (${client.id}) ${message}\n`)
			});
		}
	}
	public logOutPacket(client: Client, message: string) {
		if (this.log.enabled) {
			this.log.file.write(`[OUT]${getDateHeader()} (${client.id}) ${message}\n`)
		}
	}
	public close(clientID: string) {
		const client = this.clients.find(c => c.id == clientID);
		if (!client) return;
		if (client.socket.readyState == WebSocket.OPEN) {
			client.socket.close();
		}
		this.clients = this.clients.filter(c => c.id != clientID);
	}
	public broadcast<T extends PacketBase>(clientID: string, packet: T, withReply: boolean) {
		if (!withReply) {
			this.clients.forEach(client => {
				if (client.id != clientID) client.send(packet, false);
			});
		} else {
			const replyProms = this.clients.map(client => {
				if (client.id != clientID) return client.send(packet, true);
			});
			return replyProms.filter(v => v != null);
		}
	}
}

export {
	Server,
	Client,
	Packet,
	PacketBase,
	Heartbeat,
	Responce
}