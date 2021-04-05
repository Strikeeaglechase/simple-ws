var __awaiter = (this && this.__awaiter) || function (thisArg, _arguments, P, generator) {
    function adopt(value) { return value instanceof P ? value : new P(function (resolve) { resolve(value); }); }
    return new (P || (P = Promise))(function (resolve, reject) {
        function fulfilled(value) { try { step(generator.next(value)); } catch (e) { reject(e); } }
        function rejected(value) { try { step(generator["throw"](value)); } catch (e) { reject(e); } }
        function step(result) { result.done ? resolve(result.value) : adopt(result.value).then(fulfilled, rejected); }
        step((generator = generator.apply(thisArg, _arguments || [])).next());
    });
};
import { Server, Client as ServerClient } from "../server.js";
import { Client } from "../client.js";
class ServerUser extends ServerClient {
    constructor(server, socket) {
        super(server, socket);
    }
    handlePacket(packet) {
        switch (packet.event) {
            case "echo":
                this.reply(packet, `I am replying to "${packet.message}"`);
                break;
        }
    }
}
class ClientUser extends Client {
    constructor(url, name) {
        super(url);
        this.name = name;
    }
    setupSocket() {
        this.socket.on('open', () => __awaiter(this, void 0, void 0, function* () {
            const serverReply = yield this.send({ event: "echo", message: "Hello World!" }, true);
            console.log(serverReply);
        }));
    }
    handlePacket(packet) {
        console.log(`${this.name} - ${JSON.stringify(packet)}`);
    }
}
const server = new Server(8000, ServerUser, {
    path: "./packets.txt"
});
server.init();
const client1 = new ClientUser("ws://localhost:8000", "Client 1");
client1.connect();
