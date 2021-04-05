import { Packet, PacketBase } from "./server";
import ReplyHandler from "./replyHandler.js";
import WebSocket from "ws";
declare class Client {
    socket: WebSocket;
    url: string;
    awaitingReplys: Array<ReplyHandler>;
    constructor(url: string);
    connect(): void;
    _setupSocket(): void;
    _handlePacket(packet: Packet): void;
    send<T extends PacketBase>(packet: T, withReply?: boolean): Promise<any>;
    reply<T extends PacketBase>(orgPacket: T, replyData?: any): void;
    setupSocket(): void;
    handlePacket(packet: Packet): void;
}
export { Client };
