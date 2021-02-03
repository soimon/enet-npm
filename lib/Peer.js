"use strict";
var __extends = (this && this.__extends) || (function () {
    var extendStatics = function (d, b) {
        extendStatics = Object.setPrototypeOf ||
            ({ __proto__: [] } instanceof Array && function (d, b) { d.__proto__ = b; }) ||
            function (d, b) { for (var p in b) if (Object.prototype.hasOwnProperty.call(b, p)) d[p] = b[p]; };
        return extendStatics(d, b);
    };
    return function (d, b) {
        extendStatics(d, b);
        function __() { this.constructor = d; }
        d.prototype = b === null ? Object.create(b) : (__.prototype = b.prototype, new __());
    };
})();
var __createBinding = (this && this.__createBinding) || (Object.create ? (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    Object.defineProperty(o, k2, { enumerable: true, get: function() { return m[k]; } });
}) : (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    o[k2] = m[k];
}));
var __setModuleDefault = (this && this.__setModuleDefault) || (Object.create ? (function(o, v) {
    Object.defineProperty(o, "default", { enumerable: true, value: v });
}) : function(o, v) {
    o["default"] = v;
});
var __importStar = (this && this.__importStar) || function (mod) {
    if (mod && mod.__esModule) return mod;
    var result = {};
    if (mod != null) for (var k in mod) if (k !== "default" && Object.prototype.hasOwnProperty.call(mod, k)) __createBinding(result, mod, k);
    __setModuleDefault(result, mod);
    return result;
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.Peer = void 0;
var events_1 = require("events");
var Stream = __importStar(require("stream"));
var PEER_STATE_1 = require("./PEER_STATE");
var Packet_1 = require("./Packet");
var PACKET_FLAG_1 = require("./PACKET_FLAG");
var Address_1 = require("./Address");
var ENETModule = require("../build/enet.js");
var jsapi_ = ENETModule.jsapi;
var enet_ = ENETModule.libenet;
var Peer = /** @class */ (function (_super) {
    __extends(Peer, _super);
    function Peer(_pointer) {
        var _this = _super.call(this) || this;
        _this._pointer = _pointer;
        if (!_pointer || !(typeof _pointer === "number") || _pointer === 0)
            throw "Peer null pointer";
        _this.setMaxListeners(0);
        return _this;
    }
    Peer.prototype.state = function () {
        if (this._pointer)
            return jsapi_.peer_get_state(this._pointer);
        return PEER_STATE_1.PEER_STATES.DISCONNECTED;
    };
    Peer.prototype.incomingDataTotal = function () {
        if (this._pointer) {
            return jsapi_.peer_get_incomingDataTotal(this._pointer);
        }
        return 0;
    };
    Peer.prototype.outgoingDataTotal = function () {
        if (this._pointer) {
            return jsapi_.peer_get_outgoingDataTotal(this._pointer);
        }
        return 0;
    };
    Peer.prototype.reliableDataInTransit = function () {
        if (!this._pointer)
            return 0;
        return jsapi_._peer_get_reliableDataInTransit(this._pointer);
    };
    Peer.prototype.send = function (channel, packet, callback) {
        var _a;
        if ((_a = this._host) === null || _a === void 0 ? void 0 : _a.isOffline()) {
            if (typeof callback === "function")
                callback(new Error("host-destroyed"));
            return true;
        }
        if (!this._pointer) {
            if (typeof callback === "function")
                callback(new Error("Peer is disconnected"));
            return true;
        }
        if (!(packet instanceof Packet_1.Packet))
            packet = new Packet_1.Packet(packet, PACKET_FLAG_1.PACKET_FLAG.RELIABLE);
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
    };
    Peer.prototype._delete = function (emitDisconnect, disconnectData) {
        if (disconnectData === void 0) { disconnectData = undefined; }
        if (!this._pointer)
            return;
        if (this._host)
            delete this._host.connectedPeers[this._pointer];
        this._pointer = 0;
        if (emitDisconnect)
            this.emit("disconnect", disconnectData);
    };
    Peer.prototype.reset = function () {
        if (this._pointer) {
            enet_.peer_reset(this._pointer);
            this._delete(false);
        }
    };
    Peer.prototype.ping = function () {
        if (this._pointer)
            enet_.peer_ping(this._pointer);
    };
    Peer.prototype.disconnect = function (data) {
        if (this._pointer) {
            enet_.peer_disconnect(this._pointer, data || 0);
        }
        return this;
    };
    Peer.prototype.disconnectNow = function (data) {
        if (this._pointer) {
            enet_.peer_disconnect_now(this._pointer, data || 0);
            this._delete(true);
        }
        return this;
    };
    Peer.prototype.disconnectLater = function (data) {
        if (this._pointer) {
            enet_.peer_disconnect_later(this._pointer, data || 0);
        }
        return this;
    };
    Peer.prototype.address = function () {
        if (!this._pointer) {
            if (this._address)
                return this._address;
            return;
        }
        var ptr = jsapi_.peer_get_address(this._pointer);
        var addr = new Address_1.Address(ptr);
        //save the address so we can check it after disconnect
        this._address = {
            address: addr.address(),
            port: addr.port(),
        };
        return this._address;
    };
    //turn a channel with peer into a node writeable Stream
    //ref: https://github.com/substack/stream-handbook
    //todo - for stream, some additional error checking - make sure channel is a number
    //and not larger than the number of channels supported by peer. Dont allow creating
    //allow more than one write/readable stream for same channel?
    Peer.prototype.createWriteStream = function (channel) {
        var _this = this;
        if (!this._pointer)
            return;
        var connected = this.state() === PEER_STATE_1.PEER_STATES.CONNECTED;
        var error = false;
        var s = new Stream.Writable();
        this.on("connect", function () {
            connected = true;
        });
        this.on("disconnect", function (data) {
            connected = false;
        });
        s._write = function (buf, enc, next) {
            if (!connected) {
                next(new Error("peer-not-connected"));
                return;
            }
            if (error) {
                next(new Error("packet-queuing-error"));
                return;
            }
            var packet = new Packet_1.Packet(buf, PACKET_FLAG_1.PACKET_FLAG.RELIABLE);
            error = _this.send(channel, packet);
            if (error) {
                next(new Error("packet-queuing-error"));
                return;
            }
            next();
        };
        return s;
    };
    Peer.prototype.createReadStream = function (channel) {
        if (!this._pointer)
            return;
        var s = new Stream.Readable();
        var connected = this.state() === PEER_STATE_1.PEER_STATES.CONNECTED;
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
            if (!connected)
                s.push(null);
        };
        return s;
    };
    Peer.prototype.createDuplexStream = function (channel) {
        var _this = this;
        if (!this._pointer)
            return;
        var s = new Stream.Duplex();
        var error = false;
        var connected = this.state() === PEER_STATE_1.PEER_STATES.CONNECTED;
        this.on("connect", function () {
            connected = true;
        });
        this.on("disconnect", function (data) {
            connected = false;
            s.push(null); //signals end of data
        });
        s._write = function (buf, enc, next) {
            if (!connected) {
                next(new Error("peer-not-connected"));
                return;
            }
            if (error) {
                next(new Error("packet-queuing-error"));
                return;
            }
            var packet = new Packet_1.Packet(buf, PACKET_FLAG_1.PACKET_FLAG.RELIABLE);
            error = _this.send(channel, packet);
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
            if (!connected)
                s.push(null);
        };
        return s;
    };
    return Peer;
}(events_1.EventEmitter));
exports.Peer = Peer;
