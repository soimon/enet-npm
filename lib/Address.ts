const ENETModule = require("../build/enet.js");
const jsapi_ = ENETModule.jsapi;

function ip2long(ipstr: string) {
    const b = ipstr.split(".");
    return (
        (Number(b[0]) |
            (Number(b[1]) << 8) |
            (Number(b[2]) << 16) |
            (Number(b[3]) << 24)) >>>
        0
    );
}

function long2ip(addr: number) {
    return (
        (addr & 0xff) +
        "." +
        ((addr >> 8) & 0xff) +
        "." +
        ((addr >> 16) & 0xff) +
        "." +
        ((addr >> 24) & 0xff)
    );
}

export type AddressType = Address | { address: string; port: number } | string;

export class Address {
    _pointer;
    _host = 0;
    _port = 0;

    constructor(pointer: number);
    constructor(address: AddressType);
    constructor(address: string | number, port: number);
    constructor(...args: any[]) {
        if (args.length == 1 && typeof args[0] == "object") {
            if (args[0] instanceof Address) {
                this._host = args[0].host();
                this._port = args[0].port();
            } else {
                this._host = ip2long(args[0].address || 0);
                this._port = parseInt(args[0].port || 0);
            }
            return this;
        }
        if (args.length == 1 && typeof args[0] == "number") {
            this._pointer = args[0];
            return this;
        }
        if (args.length == 1 && typeof args[0] == "string") {
            const ipp = args[0].split(":");
            this._host = ip2long(ipp[0] || "0.0.0.0");
            this._port = parseInt(ipp[1] || "0");
            return this;
        }
        if (args.length == 2) {
            if (typeof args[0] == "string") {
                this._host = ip2long(args[0]);
            } else {
                this._host = args[0];
            }
            this._port = parseInt(args[1]);
            return this;
        }
        throw "bad parameters creating Address";
    }

    host(): number {
        if (this._pointer) {
            const hostptr = jsapi_.address_get_host(this._pointer);
            return ENETModule["HEAPU32"][hostptr >> 2];
        } else {
            return this._host;
        }
    }

    port(): number {
        if (this._pointer) {
            return jsapi_.address_get_port(this._pointer);
        } else {
            return this._port;
        }
    }

    address() {
        return long2ip(this.host());
    }
}
