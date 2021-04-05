/// <reference types="node" />
import { Responce } from "./server";
declare class ReplyHandler {
    onResolve: Array<(data: any) => void>;
    onError: Array<(err: string) => void>;
    pID: string;
    timeout: NodeJS.Timeout;
    constructor(pID: string);
    checkResolved(packet: Responce): boolean;
    handleTimeout(): void;
    get prom(): Promise<any>;
}
export default ReplyHandler;
