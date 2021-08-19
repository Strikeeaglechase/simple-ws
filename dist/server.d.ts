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
    constructor(server: Server<Client>, socket: WebSocket, _?: any);
    private _setupSocket;
    private _handlePacket;
    private sendPing;
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
declare type ClientConstructor<T extends Client> = new (server: Server<T>, socket: WebSocket, obj?: Object) => T;
declare class Server<T extends Client> {
    private port;
    private wss;
    private ClientConstruct;
    clients: Client[];
    log: LogConfig;
    private constructObj;
    constructor(port: number, ClientConstruct: ClientConstructor<T>, constructObj?: Object, logOpts?: LogOpts);
    private setupPacketLogger;
    init(): void;
    private makeConnection;
    logOutPacket(client: Client, message: string): void;
    close(clientID: string): void;
    broadcast<T extends PacketBase>(clientID: string, packet: T, withReply: boolean): Promise<any>[];
}
export { Server, Client, Packet, PacketBase, Heartbeat, Responce };
