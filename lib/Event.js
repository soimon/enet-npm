"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.Event = void 0;
var Packet_1 = require("./Packet");
var Peer_1 = require("./Peer");
var jsapi_ = require("../build/enet.js").jsapi;
var Event = /** @class */ (function () {
    function Event() {
        this._pointer = jsapi_.event_new();
    }
    Event.prototype.free = function () {
        jsapi_.event_free(this._pointer);
    };
    Event.prototype.type = function () {
        return jsapi_.event_get_type(this._pointer);
    };
    Event.prototype.peer = function () {
        var ptr = jsapi_.event_get_peer(this._pointer);
        return new Peer_1.Peer(ptr);
    };
    Event.prototype.peerPtr = function () {
        return jsapi_.event_get_peer(this._pointer);
    };
    Event.prototype.packet = function () {
        var ptr = jsapi_.event_get_packet(this._pointer);
        return new Packet_1.Packet(ptr);
    };
    Event.prototype.data = function () {
        return jsapi_.event_get_data(this._pointer);
    };
    Event.prototype.channelID = function () {
        return jsapi_.event_get_channelID(this._pointer);
    };
    return Event;
}());
exports.Event = Event;
