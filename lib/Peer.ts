import { Buffer } from "buffer";
import { EventEmitter } from "events";
import * as Stream from "stream";
import { PEER_STATES, PEER_STATE } from "./PEER_STATE";
import { Packet } from "./Packet";
import { Host } from "./Host";
import { PACKET_FLAG } from "./PACKET_FLAG";
import { Address } from "./Address";

var ENETModule = require("../build/enet.js");
var jsapi_ = ENETModule.jsapi;
var enet_ = ENETModule.libenet;

export type Callback<T> = (e?: Error, result?: T | undefined) => void;

export class Peer extends EventEmitter {
    _host?: Host;
    _address?: { address: string; port: number };

    constructor(public _pointer: number) {
        super();
        if (!_pointer || !(typeof _pointer === "number") || _pointer === 0)
            throw "Peer null pointer";
        this.setMaxListeners(0);
    }
    state(): PEER_STATE {
        if (this._pointer) return jsapi_.peer_get_state(this._pointer);
        return PEER_STATES.DISCONNECTED;
    }
    incomingDataTotal(): number {
        if (this._pointer) {
            return jsapi_.peer_get_incomingDataTotal(this._pointer);
        }
        return 0;
    }
    outgoingDataTotal(): number {
        if (this._pointer) {
            return jsapi_.peer_get_outgoingDataTotal(this._pointer);
        }
        return 0;
    }
    reliableDataInTransit(): number {
        if (!this._pointer) return 0;
        return jsapi_._peer_get_reliableDataInTransit(this._pointer);
    }
    send(
        channel: number,
        packet: Packet | Buffer | string,
        callback?: Callback<void>
    ) {
        if (this._host?.isOffline()) {
            if (typeof callback === "function")
                callback(new Error("host-destroyed"));
            return true;
        }

        if (!this._pointer) {
            if (typeof callback === "function")
                callback(new Error("Peer is disconnected"));
            return true;
        }

        if (!(packet instanceof Packet))
            packet = new Packet(packet, PACKET_FLAG.RELIABLE);

        if (!packet._pointer || packet._pointer == 0) {
            if (typeof callback === "function")
                callback(new Error("null packet"));
            return true;
        }

        if (typeof callback === "function" && this._host) {
            this._host._addPacketCallback(packet, callback);
        }

        if (enet_.peer_send(this._pointer, channel, packet._pointer) !== 0) {
            if (typeof callback === "function")
                callback(new Error("Packet not queued"));
            return true; //packet not queued - error
        }

        return false; //packed queued - no error
    }
    _delete(emitDisconnect: boolean, disconnectData: any = undefined) {
        if (!this._pointer) return;
        if (this._host) delete this._host.connectedPeers[this._pointer];
        this._pointer = 0;
        if (emitDisconnect) this.emit("disconnect", disconnectData);
    }
    reset() {
        if (this._pointer) {
            enet_.peer_reset(this._pointer);
            this._delete(false);
        }
    }
    ping() {
        if (this._pointer) enet_.peer_ping(this._pointer);
    }
    disconnect(data: number) {
        if (this._pointer) {
            enet_.peer_disconnect(this._pointer, data || 0);
        }
        return this;
    }
    disconnectNow(data: number) {
        if (this._pointer) {
            enet_.peer_disconnect_now(this._pointer, data || 0);
            this._delete(true);
        }
        return this;
    }
    disconnectLater(data: number) {
        if (this._pointer) {
            enet_.peer_disconnect_later(this._pointer, data || 0);
        }
        return this;
    }
    address(): this["_address"] {
        if (!this._pointer) {
            if (this._address) return this._address;
            return;
        }
        var ptr = jsapi_.peer_get_address(this._pointer);
        var addr = new Address(ptr);
        //save the address so we can check it after disconnect
        this._address = {
            address: addr.address(),
            port: addr.port(),
        };
        return this._address;
    }
    //turn a channel with peer into a node writeable Stream
    //ref: https://github.com/substack/stream-handbook
    //todo - for stream, some additional error checking - make sure channel is a number
    //and not larger than the number of channels supported by peer. Dont allow creating
    //allow more than one write/readable stream for same channel?
    createWriteStream(channel: number) {
        if (!this._pointer) return;

        var connected = this.state() === PEER_STATES.CONNECTED;
        var error = false;

        var s = new Stream.Writable();

        this.on("connect", function () {
            connected = true;
        });

        this.on("disconnect", function (data) {
            connected = false;
        });

        s._write = (buf, enc, next) => {
            if (!connected) {
                next(new Error("peer-not-connected"));
                return;
            }

            if (error) {
                next(new Error("packet-queuing-error"));
                return;
            }

            var packet = new Packet(buf, PACKET_FLAG.RELIABLE);

            error = this.send(channel, packet);

            if (error) {
                next(new Error("packet-queuing-error"));
                return;
            }

            next();
        };

        return s;
    }
    createReadStream(channel: number) {
        if (!this._pointer) return;

        var s = new Stream.Readable();

        var connected = this.state() === PEER_STATES.CONNECTED;

        this.on("connect", function () {
            connected = true;
        });

        this.on("disconnect", function (data) {
            connected = false;
            s.push(null); //signals end of data
        });

        this.on("message", function (_packet, _channel) {
            if (channel === _channel) {
                s.push(_packet.data());
            }
        });

        s._read = function (size) {
            if (!connected) s.push(null);
        };

        return s;
    }
    createDuplexStream(channel: number) {
        if (!this._pointer) return;

        var s = new Stream.Duplex();
        var error = false;

        var connected = this.state() === PEER_STATES.CONNECTED;

        this.on("connect", function () {
            connected = true;
        });

        this.on("disconnect", function (data) {
            connected = false;
            s.push(null); //signals end of data
        });

        s._write = (buf, enc, next) => {
            if (!connected) {
                next(new Error("peer-not-connected"));
                return;
            }

            if (error) {
                next(new Error("packet-queuing-error"));
                return;
            }

            var packet = new Packet(buf, PACKET_FLAG.RELIABLE);

            error = this.send(channel, packet);

            if (error) {
                next(new Error("packet-queuing-error"));
                return;
            }

            next();
        };

        this.on("message", function (_packet, _channel) {
            if (channel === _channel) {
                s.push(_packet.data());
            }
        });

        s._read = function (size) {
            if (!connected) s.push(null);
        };

        return s;
    }
}
