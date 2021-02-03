import { Packet } from "./Packet";
import { Peer } from "./Peer";

const jsapi_ = require("../build/enet.js").jsapi;

export class Event {
    _pointer;

    constructor() {
        this._pointer = jsapi_.event_new();
    }
    free() {
        jsapi_.event_free(this._pointer);
    }
    type(): number {
        return jsapi_.event_get_type(this._pointer);
    }
    peer(): Peer {
        const ptr = jsapi_.event_get_peer(this._pointer);
        return new Peer(ptr);
    }
    peerPtr(): number {
        return jsapi_.event_get_peer(this._pointer);
    }
    packet(): Packet {
        const ptr = jsapi_.event_get_packet(this._pointer);
        return new Packet(ptr);
    }
    data(): number {
        return jsapi_.event_get_data(this._pointer);
    }
    channelID(): number {
        return jsapi_.event_get_channelID(this._pointer);
    }
}
