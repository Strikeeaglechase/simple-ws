import { Server, Client as ServerClient, PacketBase, Packet as BasePackets } from "../server.js";
import { Client } from "../client.js";
import WebSocket from "ws";

interface EchoPacket extends PacketBase {
	event: "echo",
	message: string;
}
type Packet = EchoPacket | BasePackets;
class ServerUser extends ServerClient {
	constructor(server: Server<ServerUser>, socket: WebSocket) {
		super(server, socket);
	}
	handlePacket(packet: Packet) {
		switch (packet.event) {
			case "echo":
				this.reply(packet, `I am replying to "${packet.message}"`);
				break;
		}
	}
}
class ClientUser extends Client {
	name: string;
	constructor(url: string, name: string) {
		super(url);
		this.name = name;
	}
	setupSocket() {
		this.socket.on('open', async () => {
			const serverReply = await this.send({ event: "echo", message: "Hello World!" }, true);
			console.log(serverReply);
		});
	}
	handlePacket(packet: Packet) {
		console.log(`${this.name} - ${JSON.stringify(packet)}`);
	}
}
const server = new Server(8000, ServerUser, {
	path: "./packets.txt"
});
server.init();

const client1 = new ClientUser("ws://localhost:8000", "Client 1");
client1.connect();
