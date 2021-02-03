"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.Packet = void 0;
var buffer_1 = require("buffer");
var PACKET_FLAG_1 = require("./PACKET_FLAG");
var ENETModule = require("../build/enet.js");
var jsapi_ = ENETModule.jsapi;
var enet_ = ENETModule.libenet;
var Packet = /** @class */ (function () {
    function Packet(input, flags) {
        this._pointer = 0;
        if (typeof input === "number") {
            this._pointer = input;
            return;
        }
        if (typeof input === "object" || typeof input === "string") {
            var buf = void 0;
            if (typeof input === "string")
                buf = buffer_1.Buffer.from(input);
            else
                buf = input;
            this._packetFromBuffer(buf, flags || 0);
        }
    }
    Packet.prototype._packetFromBuffer = function (buf, flags) {
        var packet = this, begin, end, c, i;
        packet._pointer = enet_.packet_create(0, buf.length, flags);
        if (!packet._pointer)
            return; //no memory allocated for packet
        begin = jsapi_.packet_get_data(packet._pointer);
        end = begin + buf.length;
        c = 0;
        i = begin;
        for (; i < end; i++, c++) {
            ENETModule["HEAPU8"][i] = buf.readUInt8(c);
        }
    };
    Packet.prototype._attachFreeCallback = function (free_ptr) {
        jsapi_.packet_set_free_callback(this._pointer, free_ptr);
    };
    Packet.prototype.flags = function () {
        if (!this._pointer)
            return 0;
        return jsapi_.packet_flags(this._pointer);
    };
    Packet.prototype.wasSent = function () {
        return (this.flags() & PACKET_FLAG_1.PACKET_FLAG.SENT) == PACKET_FLAG_1.PACKET_FLAG.SENT;
    };
    Packet.prototype.data = function () {
        var begin, end;
        if (!this._pointer)
            return undefined;
        begin = jsapi_.packet_get_data(this._pointer);
        end = begin + jsapi_.packet_get_dataLength(this._pointer);
        return buffer_1.Buffer.from(ENETModule["HEAPU8"].subarray(begin, end), "binary");
        //return HEAPU8.subarray(begin,end);
    };
    Packet.prototype.dataLength = function () {
        if (!this._pointer)
            return 0;
        return jsapi_.packet_get_dataLength(this._pointer);
    };
    Packet.prototype.destroy = function () {
        if (!this._pointer)
            return;
        enet_.packet_destroy(this._pointer);
        this._pointer = 0;
    };
    return Packet;
}());
exports.Packet = Packet;
