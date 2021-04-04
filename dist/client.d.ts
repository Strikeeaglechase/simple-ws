import { Packet } from "./index";
import ReplyHandler from "./replyHandler.js";
import WebSocket from "ws";
declare class WebSocketClient {
    socket: WebSocket;
    url: string;
    awaitingReplys: Array<ReplyHandler>;
    constructor(url: string);
    connect(): void;
    setupSocket(): void;
    _handlePacket(packet: Packet): void;
    send(packet: Partial<Packet>, withReply?: boolean): Promise<any>;
    reply(orgPacket: Packet, replyData?: any): void;
    handlePacket(packet: Packet): void;
}
export { WebSocketClient };
