import { Responce } from "./server";

const REPLY_TIMEOUT = 5000;

class ReplyHandler {
	onResolve: Array<(data: any) => void>;
	onError: Array<(err: string) => void>;
	pID: string;
	timeout: NodeJS.Timeout;
	constructor(pID: string) {
		this.pID = pID;
		this.onResolve = [];
		this.onError = [];
		this.timeout = setTimeout(() => this.handleTimeout(), REPLY_TIMEOUT);
	}
	checkResolved(packet: Responce): boolean {
		if (packet.orgPID == this.pID) {
			this.onResolve.forEach(resHandler => resHandler(packet.data));
			clearTimeout(this.timeout);
			return true;
		}
		return false;
	}
	handleTimeout() {
		this.onError.forEach(errHandler => errHandler(`Websocket did not reply`));
	}
	get prom() {
		return new Promise<any>((res, err) => {
			this.onResolve.push(res);
			this.onError.push(err);
		});
	}
}
export default ReplyHandler;