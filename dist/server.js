var __awaiter = (this && this.__awaiter) || function (thisArg, _arguments, P, generator) {
    function adopt(value) { return value instanceof P ? value : new P(function (resolve) { resolve(value); }); }
    return new (P || (P = Promise))(function (resolve, reject) {
        function fulfilled(value) { try { step(generator.next(value)); } catch (e) { reject(e); } }
        function rejected(value) { try { step(generator["throw"](value)); } catch (e) { reject(e); } }
        function step(result) { result.done ? resolve(result.value) : adopt(result.value).then(fulfilled, rejected); }
        step((generator = generator.apply(thisArg, _arguments || [])).next());
    });
};
import WebSocket from "ws";
import ReplyHandler from "./replyHandler.js";
import { v4 as uuidv4 } from "uuid";
import fs from "fs";
const PING_RATE = 5000;
// Header for logs
function getDateHeader() {
    function addZero(n) {
        const str = n.toString();
        return str.length >= 2 ? str.substring(0, 2) : "0" + str;
    }
    function THeader(date) {
        return `[${addZero(date.getHours())}:${addZero(date.getMinutes())}]`;
    }
    function DHeader(date) {
        return `[${addZero(date.getDate())}/${addZero(date.getMonth() + 1)}]`;
    }
    const date = new Date();
    const t = DHeader(date) + THeader(date);
    return t;
}
class Client {
    constructor(server, socket, _ = null) {
        this.server = server;
        this.socket = socket;
        this.ping = {
            isAwaitingReply: false,
            lastLatency: 0,
        };
        this.awaitingReplys = [];
        this.id = uuidv4();
        this._setupSocket();
    }
    _setupSocket() {
        this.socket.on("message", (data) => {
            try {
                const packet = JSON.parse(data.toString());
                this._handlePacket(packet);
            }
            catch (e) {
                this.server.log.logger(`Unable to parse packet ${data} - ${e}`);
            }
        });
        this.socket.on("close", () => this.server.close(this.id));
        setInterval(() => this.sendPing(), PING_RATE);
        this.setupSocket();
    }
    _handlePacket(packet) {
        switch (packet.event) {
            case "responce":
                this.awaitingReplys = this.awaitingReplys.filter(repl => repl.checkResolved(packet));
                break;
            default: this.handlePacket(packet);
        }
    }
    sendPing() {
        return __awaiter(this, void 0, void 0, function* () {
            if (this.ping.isAwaitingReply)
                return;
            this.ping.isAwaitingReply = true;
            const message = { event: 'heartbeat', time: Date.now() };
            const time = yield this.send(message, true).catch(() => { });
            if (!time) {
                this.server.log.logger(`Client ${this.id} timed out`);
                this.server.close(this.id);
                return;
            }
            const latency = Date.now() - time;
            this.ping.lastLatency = latency;
            this.ping.isAwaitingReply = false;
        });
    }
    send(packet, withReply = false) {
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
    reply(orgPacket, replyData) {
        const reply = {
            event: "responce",
            data: replyData,
            orgPID: orgPacket.pID,
        };
        this.send(reply);
    }
    broadcast(packet, withReply = false) {
        this.server.broadcast(this.id, packet, withReply);
    }
    // Methods intended to be overriden by an extended class
    setupSocket() { }
    handlePacket(packet) { }
}
class Server {
    constructor(port, ClientConstruct, constructObj, logOpts) {
        this.port = port;
        this.clients = [];
        this.ClientConstruct = ClientConstruct;
        this.constructObj = constructObj;
        this.log = this.setupPacketLogger(logOpts || {});
    }
    setupPacketLogger(opts) {
        const logFunc = opts.logger || console.log;
        const path = opts.path;
        if (!path) {
            return {
                path: "",
                file: null,
                enabled: false,
                logger: logFunc
            };
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
        };
    }
    init() {
        this.wss = new WebSocket.Server({ port: this.port });
        this.wss.on("connection", (ws) => this.makeConnection(ws));
        this.wss.on("error", (err) => this.log.logger(err.toString()));
        this.wss.on("close", () => this.log.logger(`Websocket server closed!`));
        this.wss.on("listening", () => this.log.logger(`Webscoket server open on ${this.port}`));
    }
    makeConnection(ws) {
        const client = new this.ClientConstruct(this, ws, this.constructObj);
        this.clients.push(client);
        if (this.log.enabled) {
            client.socket.on("message", (message) => {
                this.log.file.write(`[ IN]${getDateHeader()} (${client.id}) ${message}\n`);
            });
        }
    }
    logOutPacket(client, message) {
        if (this.log.enabled) {
            this.log.file.write(`[OUT]${getDateHeader()} (${client.id}) ${message}\n`);
        }
    }
    close(clientID) {
        const client = this.clients.find(c => c.id == clientID);
        if (!client)
            return;
        if (client.socket.readyState == WebSocket.OPEN) {
            client.socket.close();
        }
        this.clients = this.clients.filter(c => c.id != clientID);
    }
    broadcast(clientID, packet, withReply) {
        if (!withReply) {
            this.clients.forEach(client => {
                if (client.id != clientID)
                    client.send(packet, false);
            });
        }
        else {
            const replyProms = this.clients.map(client => {
                if (client.id != clientID)
                    return client.send(packet, true);
            });
            return replyProms.filter(v => v != null);
        }
    }
}
export { Server, Client };
