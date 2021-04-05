/// <reference types="node" />
import WebSocket from "ws";
import ReplyHandler from "./replyHandler.js";
import fs from "fs";
interface PacketBase {
    event: string;
    pID?: string;
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
    send<T extends PacketBase>(packet: T, withReply?: boolean): Promise<any>;
    reply<T extends PacketBase>(orgPacket: T, replyData?: any): void;
    broadcast<T extends PacketBase>(packet: T, withReply?: boolean): void;
    setupSocket(): void;
    handlePacket(packet: Packet): void;
}
interface LogConfig {
    path: string;
    file: fs.WriteStream;
    enabled: boolean;
    logger: (message: string) => void;
}
interface LogOpts {
    path?: string;
    logger?: (message: string) => void;
}
declare class Server<T extends Client> {
    port: number;
    wss: WebSocket.Server;
    ClientConstruct: new (server: Server<T>, socket: WebSocket) => T;
    clients: Client[];
    log: LogConfig;
    constructor(port: number, ClientConstruct: new (server: Server<T>, socket: WebSocket) => T, logOpts?: LogOpts);
    setupPacketLogger(opts: LogOpts): LogConfig;
    init(): void;
    makeConnection(ws: WebSocket): void;
    logOutPacket(client: Client, message: string): void;
    close(clientID: string): void;
    broadcast<T extends PacketBase>(clientID: string, packet: T, withReply: boolean): Promise<any>[];
}
export { Server, Client, Packet, PacketBase, Heartbeat, Responce };
