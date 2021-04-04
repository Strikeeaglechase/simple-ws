/// <reference types="node" />
import WebSocket from "ws";
import ReplyHandler from "./replyHandler.js";
import fs from "fs";
interface PacketBase {
    event: string;
    pID: string;
}
interface Heartbeat extends PacketBase {
    event: "heartbeat";
    time: number;
}
interface Responce extends PacketBase {
    event: "responce";
    data?: any;
    orgPID: string;
}
declare type Packet = Heartbeat | Responce;
declare class Client {
    server: Server<Client>;
    socket: WebSocket;
    ping: {
        isAwaitingReply: boolean;
        lastLatency: number;
    };
    awaitingReplys: Array<ReplyHandler>;
    id: string;
    constructor(server: Server<Client>, socket: WebSocket);
    private _setupSocket;
    private _handlePacket;
    sendPing(): Promise<void>;
    send(packet: Partial<Packet>, withReply?: boolean): Promise<any>;
    setupSocket(): void;
    handlePacket(packet: Packet): void;
}
interface LogConfig {
    path: string;
    file: fs.WriteStream;
    enabled: boolean;
}
declare class Server<T extends Client> {
    port: number;
    wss: WebSocket.Server;
    ClientConstruct: new (server: Server<T>, socket: WebSocket) => T;
    clients: Client[];
    log: {
        path: string;
        file: fs.WriteStream;
        enabled: boolean;
    };
    constructor(port: number, ClientConstruct: new (server: Server<T>, socket: WebSocket) => T, packetLog?: string);
    setupPacketLogger(path: string): LogConfig;
    init(): void;
    makeConnection(ws: WebSocket): void;
    logOutPacket(client: Client, message: string): void;
    close(clientID: string): void;
}
export { Server, Packet, PacketBase, Heartbeat, Responce };
