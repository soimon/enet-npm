import { Address } from "./lib/Address";

const ENETModule = require("./build/enet.js");
const jsapi_ = ENETModule.jsapi;

export {
    Host,
    createClient,
    createServer,
    createServerFromSocket,
} from "./lib/Host";
export { Event } from "./lib/Event";
export { Address } from "./lib/Address";
export { Packet } from "./lib/Packet";
export { Peer } from "./lib/Peer";
export { PACKET_FLAG } from "./lib/PACKET_FLAG";
export { PEER_STATE, PEER_STATES } from "./lib/PEER_STATE";

export const init = function (func: (address: string, port: number) => void) {
    var funcPointer = ENETModule["Runtime_addFunction"](function (
        host_ptr: number
    ) {
        var addr = new Address(jsapi_.host_get_receivedAddress(host_ptr));
        return func(addr.address(), addr.port());
    });
    jsapi_.init(funcPointer);
};
