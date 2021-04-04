import ReplyHandler from "./replyHandler.js";
import WebSocket from "ws";
import { v4 as uuidv4 } from "uuid";
class WebSocketClient {
    constructor(url) {
        this.url = url;
        this.awaitingReplys = [];
    }
    connect() {
        this.socket = new WebSocket(this.url);
        this.setupSocket();
    }
    setupSocket() {
        this.socket.on("close", () => {
            console.log(`Websocket closed, attempting to reopen`);
            setTimeout(() => this.connect(), 500);
        });
        this.socket.on("open", () => {
            console.log(`Websocket connected`);
        });
        this.socket.on("message", (data) => {
            try {
                const packet = JSON.parse(data.toString());
                this._handlePacket(packet);
            }
            catch (e) {
                console.log(`Unable to parse packet ${data} - ${e}`);
            }
        });
    }
    _handlePacket(packet) {
        switch (packet.event) {
            case "responce":
                this.awaitingReplys = this.awaitingReplys.filter(repl => repl.checkResolved(packet));
                break;
            case "heartbeat":
                this.reply(packet, packet.time);
            default: this.handlePacket(packet);
        }
    }
    send(packet, withReply = false) {
        packet.pID = uuidv4();
        const str = JSON.stringify(packet);
        this.socket.send(str);
        if (withReply) {
            const handler = new ReplyHandler(packet.pID);
            this.awaitingReplys.push(handler);
            return handler.prom;
        }
    }
    reply(orgPacket, replyData) {
        const reply = {
            event: "responce",
            data: replyData,
            orgPID: orgPacket.pID,
        };
        this.send(reply);
    }
    handlePacket(packet) { }
}
export { WebSocketClient };
