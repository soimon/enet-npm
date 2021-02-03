import { Buffer } from "buffer";
import { EventEmitter } from "events";
import { Address, AddressType } from "./Address";
import { Event } from "./Event";
import { Packet } from "./Packet";
import { PACKET_FLAG } from "./PACKET_FLAG";
import { Peer } from "./Peer";

var ENETModule = require("../build/enet.js");
var jsapi_ = ENETModule.jsapi;
var enet_ = ENETModule.libenet;

var ENET_HOST_SERVICE_INTERVAL = 10; //milliseconds

export type Callback<T> = (e?: Error, result?: T | undefined) => void;
export type HostType = "server" | "client" | "custom";

export function createServer(
    arg: Parameters<typeof createHost>[0],
    callback: Parameters<typeof createHost>[1]
) {
    return createHost(arg, callback, "server");
}

export function createClient(
    arg: Parameters<typeof createHost>[0],
    callback: Parameters<typeof createHost>[1]
) {
    return createHost(arg, callback, "client");
}

export function createServerFromSocket(
    arg: Parameters<typeof createHost>[0],
    callback: Parameters<typeof createHost>[1]
) {
    return createHost(arg, callback, "custom");
}

export type HostOptions = {
    address?: AddressType;
    peers?: number;
    channels?: number;
    down?: number;
    up?: number;
    socket?: any;
};

function createHost(
    opt: HostOptions,
    callback: Callback<Host> | undefined,
    host_type: HostType
) {
    let host: Host;
    let socket: any;

    try {
        host = new Host(
            opt.address,
            opt.peers,
            opt.channels,
            opt.down,
            opt.up,
            host_type,
            opt.socket
        );
    } catch (e) {
        if (typeof callback === "function") callback(e);
        return;
    }

    if (!host || host._pointer === 0) {
        setImmediate(function () {
            if (callback) callback(new Error("host-creation-error"));
        });
        return;
    }

    socket = host._socket;

    if (!socket) {
        setImmediate(function () {
            if (callback) callback(new Error("socket-creation-error"));
        });
        return;
    }

    //catch socket bind errors
    socket.on("error", function (e: any) {
        host._socket_closed = true;

        //server will bind so error will be called before listening if error occurs
        //so we can return the error in the callback
        if (host_type === "server") {
            if (callback) callback(e);
        } else {
            //for client and custom host application can listen for the error event
            host.emit("error", e);
        }

        host.destroy();
    });

    socket.on("close", function () {
        host._socket_closed = true;
        host.destroy();
    });

    socket.on("listening", function () {
        socket.setBroadcast(true);
        //for server host callback when socket is listening
        if (host_type === "server" && typeof callback === "function")
            callback(undefined, host);
    });

    //bind the socket
    if (host_type === "server" || host_type === "custom")
        jsapi_.enet_host_bind(host._pointer);

    if (
        (host_type === "client" || host_type === "custom") &&
        typeof callback === "function"
    ) {
        setImmediate(function () {
            callback(undefined, host); //clients get host in callback before socket is listening.
        });
    }

    return host;
}

export class Host extends EventEmitter {
    connectedPeers: Record<string, Peer> = {};
    _type: HostType;
    _event;
    _pointer;
    _socket;
    _packet_free_func_ptr;
    _packet_callback_functions: Record<keyof any, Callback<void>> = {};
    _shutting_down = false;
    _socket_closed = false;
    _servicing = false;
    _io_loop: any;

    constructor(
        address?: AddressType,
        maxpeers: number = 128,
        maxchannels: number = 5,
        bw_down: number = 0,
        bw_up: number = 0,
        host_type?: HostType,
        custom_socket: any = null
    ) {
        super();
        this.setMaxListeners(0);
        let pointer = 0;

        switch (host_type) {
            case "client":
                this._type = "client";
                pointer = jsapi_.enet_host_create_client(
                    maxpeers,
                    maxchannels,
                    bw_down,
                    bw_up
                );
                break;

            case "custom":
                this._type = "custom";
                //insert a socket into emscrtipten FS
                const socketfd = ENETModule["createStreamFromSocket"](
                    custom_socket
                );
                pointer = jsapi_.enet_host_from_socket(
                    socketfd,
                    0,
                    maxpeers,
                    maxchannels,
                    bw_down,
                    bw_up
                );
                break;

            case "server":
                this._type = "server";
                address = address || {
                    address: "0.0.0.0",
                    port: 0,
                };
                const enetAddr =
                    address instanceof Address ? address : new Address(address);
                pointer = jsapi_.enet_host_create_server(
                    enetAddr.host(),
                    enetAddr.port(),
                    maxpeers,
                    maxchannels,
                    bw_down,
                    bw_up
                );
                break;

            default:
                //create a host using the createClient and createServer methods.
                throw new Error(
                    "Do not create a new instance of Host. Use createServer() and createClient() instead."
                );
        }

        if (pointer === 0) {
            throw "failed to create ENet host";
        }

        this._event = new Event(); //allocate memory for events - free it when we destroy the host
        this._pointer = pointer;
        const socketfd = jsapi_.host_get_socket(this._pointer);
        this._socket = ENETModule["getStreamSocket"](socketfd);

        this._packet_free_func_ptr = ENETModule["Runtime_addFunction"](
            (packet_ptr: number) => {
                //grab the callback from peer._packet_callback_functions, call its callback indicate if sent flag
                //delete from peer._packet_callback_functions
                Object.keys(this._packet_callback_functions)
                    .map(Number)
                    .forEach((ptr) => {
                        //keys are strings
                        if (Number(ptr) === packet_ptr) {
                            const packet = new Packet(packet_ptr);
                            const callback = this._packet_callback_functions[
                                ptr
                            ];
                            delete this._packet_callback_functions[ptr];
                            if (callback)
                                callback(
                                    packet.wasSent()
                                        ? undefined
                                        : new Error("packet-not-delivered")
                                );
                            return;
                        }
                    });
            }
        );
    }
    _addPacketCallback(packet: Packet, callback: Callback<void>) {
        packet._attachFreeCallback(this._packet_free_func_ptr);
        this._packet_callback_functions[packet._pointer] = callback;
    }
    isOffline() {
        return (
            typeof this._pointer === "undefined" ||
            this._pointer === 0 ||
            this._shutting_down ||
            this._socket_closed
        );
    }
    isOnline() {
        return this.isOffline() === false;
    }
    _service() {
        let peer: Peer | undefined;
        var recvdAddr;
        if (this._servicing) return;
        this._servicing = true;

        if (!this._pointer || !this._event || this._socket_closed) return;
        var err = enet_.host_service(this._pointer, this._event._pointer, 0);
        while (err > 0) {
            switch (this._event.type()) {
                case 1: //connect
                    peer = this.connectedPeers[this._event.peerPtr()];
                    if (peer) {
                        //outgoing connection
                        peer.emit("connect");
                        this.emit(
                            "connect",
                            peer,
                            undefined,
                            true //local host initiated the connection to foriegn host
                        );
                    } else {
                        peer = this.connectedPeers[
                            this._event.peerPtr()
                        ] = this._event.peer();
                        peer._host = this;
                        //incoming connection
                        this.emit(
                            "connect",
                            peer,
                            this._event.data(),
                            false //foreign host initiated connection to local host
                        );
                    }
                    break;
                case 2: //disconnect
                    peer = this.connectedPeers[this._event.peerPtr()];
                    if (peer) {
                        peer._delete(true, this._event.data());
                    }
                    break;
                case 3: //receive
                    peer =
                        this.connectedPeers[this._event.peerPtr()] ||
                        this._event.peer();
                    this.emit(
                        "message",
                        peer,
                        this._event.packet(),
                        this._event.channelID()
                    );
                    //todo - return packet.data() not packet (incase app wants to handle the packet asynchronously)
                    peer.emit(
                        "message",
                        this._event.packet(),
                        this._event.channelID()
                    );
                    this._event.packet().destroy();
                    break;
                case 100: //JSON,telex
                    recvdAddr = this.receivedAddress();
                    this.emit("telex", this._event.packet().data(), {
                        address: recvdAddr?.address,
                        port: recvdAddr?.port,
                    });
                    this._event.packet().destroy();
                    break;
            }
            if (!this._pointer || !this._event || this._socket_closed) return;

            err = enet_.host_service(this._pointer, this._event._pointer, 0);
        }
        if (err < 0) console.error("Error servicing host: ", err);
        this._servicing = false;
    }
    stop() {
        this.destroy();
    }
    destroy() {
        var peer, peer_ptr;
        if (this._shutting_down) return;
        this._shutting_down = true;

        if (this._io_loop) {
            clearInterval(this._io_loop);
        }

        if (typeof this._pointer === "undefined" || this._pointer === 0) return;

        for (peer_ptr in this.connectedPeers) {
            peer = this.connectedPeers[peer_ptr];
            if (peer && peer._pointer !== 0) {
                if (!this._socket_closed)
                    enet_.peer_disconnect_now(peer_ptr, 0);
                peer._pointer = 0;
                peer.emit("disconnect", 0);
            }
        }
        for (let key in this.connectedPeers) delete this.connectedPeers[key];
        this.flush();

        if (this._event) this._event.free();

        try {
            if (this._pointer) enet_.host_destroy(this._pointer);
        } catch (e) {}

        if (this._packet_free_func_ptr)
            ENETModule["Runtime_removeFunction"](this._packet_free_func_ptr);
        for (let key in this._packet_callback_functions)
            delete this._packet_callback_functions[key];

        // delete this._pointer;
        // delete this._event;
        delete this._io_loop;
        delete this._socket;
        this.emit("destroy");
    }
    receivedAddress() {
        if (this.isOffline()) return;
        var ptr = jsapi_.host_get_receivedAddress(this._pointer);
        var addr = new Address(ptr);
        return {
            address: addr.address(),
            port: addr.port(),
        };
    }
    address() {
        if (this.isOffline()) return;
        return this._socket.address();
    }
    send(ip: string, port: number, buff: Buffer, callback?: Callback<number>) {
        if (this.isOffline()) return;
        this._socket.send(buff, 0, buff.length, port, ip, callback);
    }
    flush() {
        if (this.isOffline()) return;
        enet_.host_flush(this._pointer);
    }
    connect(
        address: AddressType,
        channelCount: number = 5,
        data = 0,
        callback?: Callback<Peer>
    ) {
        if (this.isOffline()) {
            if (typeof callback === "function")
                callback(new Error("host-destroyed"));
            return;
        }

        var self = this;
        var enetAddr =
            address instanceof Address ? address : new Address(address);
        var ptr = jsapi_.enet_host_connect(
            this._pointer,
            enetAddr.host(),
            enetAddr.port(),
            channelCount,
            data
        );

        self.firstStart(); //start servicing if not yet started

        var succeeded = false;

        if (ptr) {
            const peer = new Peer(ptr);
            peer._host = self;
            self.connectedPeers[ptr] = peer;
            if (typeof callback === "function") {
                peer.on("connect", function () {
                    succeeded = true;
                    callback(undefined, peer);
                });
                peer.on("disconnect", function () {
                    if (!succeeded) callback(new Error("failed"));
                });
            }
            return peer;
        }

        if (typeof callback === "function") {
            setTimeout(function () {
                callback(new Error("maxpeers"));
            });
        }

        return undefined;
    }
    throttleBandwidth() {
        if (this.isOffline()) return;
        enet_.host_bandwidth_throttle(this._pointer);
    }
    enableCompression() {
        if (this._pointer) {
            enet_.host_compress_with_range_coder(this._pointer);
        }
    }
    disableCompression() {
        if (this._pointer) {
            enet_.host_compress(this._pointer, 0); //passing a 0 disables compression
        }
    }
    broadcast(channel: number, packet: Packet | Buffer) {
        if (this.isOffline()) return;

        let _packet =
            packet instanceof Buffer
                ? new Packet(packet, PACKET_FLAG.RELIABLE)
                : packet;

        enet_.host_broadcast(this._pointer, channel, _packet._pointer);
    }
    peers() {
        var peer_ptr,
            peers = [];
        for (peer_ptr in this.connectedPeers) {
            peers.push(this.connectedPeers[peer_ptr]);
        }
        return peers;
    }
    firstStart() {
        var self = this;
        if (!self._io_loop) {
            self._io_loop = setInterval(function () {
                self._service();
            }, ENET_HOST_SERVICE_INTERVAL);
        }
    }
    start(ms_interval: number) {
        var self = this;
        if (!self._pointer) return; //cannot start a host that is not initialised
        if (self._io_loop) {
            clearInterval(self._io_loop);
        }
        self._io_loop = setInterval(function () {
            self._service();
        }, ms_interval || ENET_HOST_SERVICE_INTERVAL);
    }
}
