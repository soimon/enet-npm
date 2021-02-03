import { Buffer } from "buffer";
import { PACKET_FLAG } from "./PACKET_FLAG";

var ENETModule = require("../build/enet.js");
var jsapi_ = ENETModule.jsapi;
var enet_ = ENETModule.libenet;

export class Packet {
    _pointer = 0;

    constructor(pointer: number);
    constructor(buffer: Buffer | string, flags?: number);
    constructor(input: Buffer | string | number, flags?: number) {
        if (typeof input === "number") {
            this._pointer = input;
            return;
        }

        if (typeof input === "object" || typeof input === "string") {
            let buf: Buffer;
            if (typeof input === "string") buf = Buffer.from(input);
            else buf = input;
            this._packetFromBuffer(buf, flags || 0);
        }
    }

    protected _packetFromBuffer(buf: Buffer, flags: number) {
        var packet = this,
            begin,
            end,
            c,
            i;
        packet._pointer = enet_.packet_create(0, buf.length, flags);
        if (!packet._pointer) return; //no memory allocated for packet
        begin = jsapi_.packet_get_data(packet._pointer);
        end = begin + buf.length;
        c = 0;
        i = begin;
        for (; i < end; i++, c++) {
            ENETModule["HEAPU8"][i] = buf.readUInt8(c);
        }
    }

    _attachFreeCallback(free_ptr: number) {
        jsapi_.packet_set_free_callback(this._pointer, free_ptr);
    }

    flags(): number {
        if (!this._pointer) return 0;
        return jsapi_.packet_flags(this._pointer);
    }

    wasSent() {
        return (this.flags() & PACKET_FLAG.SENT) == PACKET_FLAG.SENT;
    }

    data() {
        var begin, end;
        if (!this._pointer) return undefined;
        begin = jsapi_.packet_get_data(this._pointer);
        end = begin + jsapi_.packet_get_dataLength(this._pointer);
        return Buffer.from(ENETModule["HEAPU8"].subarray(begin, end), "binary");
        //return HEAPU8.subarray(begin,end);
    }

    dataLength(): number {
        if (!this._pointer) return 0;
        return jsapi_.packet_get_dataLength(this._pointer);
    }

    destroy() {
        if (!this._pointer) return;
        enet_.packet_destroy(this._pointer);
        this._pointer = 0;
    }
}
