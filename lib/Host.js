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
Object.defineProperty(exports, "__esModule", { value: true });
exports.Host = exports.createServerFromSocket = exports.createClient = exports.createServer = void 0;
var buffer_1 = require("buffer");
var events_1 = require("events");
var Address_1 = require("./Address");
var Event_1 = require("./Event");
var Packet_1 = require("./Packet");
var PACKET_FLAG_1 = require("./PACKET_FLAG");
var Peer_1 = require("./Peer");
var ENETModule = require("../build/enet.js");
var jsapi_ = ENETModule.jsapi;
var enet_ = ENETModule.libenet;
var ENET_HOST_SERVICE_INTERVAL = 10; //milliseconds
function createServer(arg, callback) {
    return createHost(arg, callback, "server");
}
exports.createServer = createServer;
function createClient(arg, callback) {
    return createHost(arg, callback, "client");
}
exports.createClient = createClient;
function createServerFromSocket(arg, callback) {
    return createHost(arg, callback, "custom");
}
exports.createServerFromSocket = createServerFromSocket;
function createHost(opt, callback, host_type) {
    var host;
    var socket;
    try {
        host = new Host(opt.address, opt.peers, opt.channels, opt.down, opt.up, host_type, opt.socket);
    }
    catch (e) {
        if (typeof callback === "function")
            callback(e);
        return;
    }
    if (!host || host._pointer === 0) {
        setImmediate(function () {
            if (callback)
                callback(new Error("host-creation-error"));
        });
        return;
    }
    socket = host._socket;
    if (!socket) {
        setImmediate(function () {
            if (callback)
                callback(new Error("socket-creation-error"));
        });
        return;
    }
    //catch socket bind errors
    socket.on("error", function (e) {
        host._socket_closed = true;
        //server will bind so error will be called before listening if error occurs
        //so we can return the error in the callback
        if (host_type === "server") {
            if (callback)
                callback(e);
        }
        else {
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
    if ((host_type === "client" || host_type === "custom") &&
        typeof callback === "function") {
        setImmediate(function () {
            callback(undefined, host); //clients get host in callback before socket is listening.
        });
    }
    return host;
}
var Host = /** @class */ (function (_super) {
    __extends(Host, _super);
    function Host(address, maxpeers, maxchannels, bw_down, bw_up, host_type, custom_socket) {
        if (maxpeers === void 0) { maxpeers = 128; }
        if (maxchannels === void 0) { maxchannels = 5; }
        if (bw_down === void 0) { bw_down = 0; }
        if (bw_up === void 0) { bw_up = 0; }
        if (custom_socket === void 0) { custom_socket = null; }
        var _this = _super.call(this) || this;
        _this.connectedPeers = {};
        _this._packet_callback_functions = {};
        _this._shutting_down = false;
        _this._socket_closed = false;
        _this._servicing = false;
        _this.setMaxListeners(0);
        var pointer = 0;
        switch (host_type) {
            case "client":
                _this._type = "client";
                pointer = jsapi_.enet_host_create_client(maxpeers, maxchannels, bw_down, bw_up);
                break;
            case "custom":
                _this._type = "custom";
                //insert a socket into emscrtipten FS
                var socketfd_1 = ENETModule["createStreamFromSocket"](custom_socket);
                pointer = jsapi_.enet_host_from_socket(socketfd_1, 0, maxpeers, maxchannels, bw_down, bw_up);
                break;
            case "server":
                _this._type = "server";
                address = address || {
                    address: "0.0.0.0",
                    port: 0,
                };
                var enetAddr = address instanceof Address_1.Address ? address : new Address_1.Address(address);
                pointer = jsapi_.enet_host_create_server(enetAddr.host(), enetAddr.port(), maxpeers, maxchannels, bw_down, bw_up);
                break;
            default:
                //create a host using the createClient and createServer methods.
                throw new Error("Do not create a new instance of Host. Use createServer() and createClient() instead.");
        }
        if (pointer === 0) {
            throw "failed to create ENet host";
        }
        _this._event = new Event_1.Event(); //allocate memory for events - free it when we destroy the host
        _this._pointer = pointer;
        var socketfd = jsapi_.host_get_socket(_this._pointer);
        _this._socket = ENETModule["getStreamSocket"](socketfd);
        _this._packet_free_func_ptr = ENETModule["Runtime_addFunction"](function (packet_ptr) {
            //grab the callback from peer._packet_callback_functions, call its callback indicate if sent flag
            //delete from peer._packet_callback_functions
            Object.keys(_this._packet_callback_functions)
                .map(Number)
                .forEach(function (ptr) {
                //keys are strings
                if (Number(ptr) === packet_ptr) {
                    var packet = new Packet_1.Packet(packet_ptr);
                    var callback = _this._packet_callback_functions[ptr];
                    delete _this._packet_callback_functions[ptr];
                    if (callback)
                        callback(packet.wasSent()
                            ? undefined
                            : new Error("packet-not-delivered"));
                    return;
                }
            });
        });
        return _this;
    }
    Host.prototype._addPacketCallback = function (packet, callback) {
        packet._attachFreeCallback(this._packet_free_func_ptr);
        this._packet_callback_functions[packet._pointer] = callback;
    };
    Host.prototype.isOffline = function () {
        return (typeof this._pointer === "undefined" ||
            this._pointer === 0 ||
            this._shutting_down ||
            this._socket_closed);
    };
    Host.prototype.isOnline = function () {
        return this.isOffline() === false;
    };
    Host.prototype._service = function () {
        var peer;
        var recvdAddr;
        if (this._servicing)
            return;
        this._servicing = true;
        if (!this._pointer || !this._event || this._socket_closed)
            return;
        var err = enet_.host_service(this._pointer, this._event._pointer, 0);
        while (err > 0) {
            switch (this._event.type()) {
                case 1: //connect
                    peer = this.connectedPeers[this._event.peerPtr()];
                    if (peer) {
                        //outgoing connection
                        peer.emit("connect");
                        this.emit("connect", peer, undefined, true //local host initiated the connection to foriegn host
                        );
                    }
                    else {
                        peer = this.connectedPeers[this._event.peerPtr()] = this._event.peer();
                        peer._host = this;
                        //incoming connection
                        this.emit("connect", peer, this._event.data(), false //foreign host initiated connection to local host
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
                    this.emit("message", peer, this._event.packet(), this._event.channelID());
                    //todo - return packet.data() not packet (incase app wants to handle the packet asynchronously)
                    peer.emit("message", this._event.packet(), this._event.channelID());
                    this._event.packet().destroy();
                    break;
                case 100: //JSON,telex
                    recvdAddr = this.receivedAddress();
                    this.emit("telex", this._event.packet().data(), {
                        address: recvdAddr === null || recvdAddr === void 0 ? void 0 : recvdAddr.address,
                        port: recvdAddr === null || recvdAddr === void 0 ? void 0 : recvdAddr.port,
                    });
                    this._event.packet().destroy();
                    break;
            }
            if (!this._pointer || !this._event || this._socket_closed)
                return;
            err = enet_.host_service(this._pointer, this._event._pointer, 0);
        }
        if (err < 0)
            console.error("Error servicing host: ", err);
        this._servicing = false;
    };
    Host.prototype.stop = function () {
        this.destroy();
    };
    Host.prototype.destroy = function () {
        var peer, peer_ptr;
        if (this._shutting_down)
            return;
        this._shutting_down = true;
        if (this._io_loop) {
            clearInterval(this._io_loop);
        }
        if (typeof this._pointer === "undefined" || this._pointer === 0)
            return;
        for (peer_ptr in this.connectedPeers) {
            peer = this.connectedPeers[peer_ptr];
            if (peer && peer._pointer !== 0) {
                if (!this._socket_closed)
                    enet_.peer_disconnect_now(peer_ptr, 0);
                peer._pointer = 0;
                peer.emit("disconnect", 0);
            }
        }
        for (var key in this.connectedPeers)
            delete this.connectedPeers[key];
        this.flush();
        if (this._event)
            this._event.free();
        try {
            if (this._pointer)
                enet_.host_destroy(this._pointer);
        }
        catch (e) { }
        if (this._packet_free_func_ptr)
            ENETModule["Runtime_removeFunction"](this._packet_free_func_ptr);
        for (var key in this._packet_callback_functions)
            delete this._packet_callback_functions[key];
        // delete this._pointer;
        // delete this._event;
        delete this._io_loop;
        delete this._socket;
        this.emit("destroy");
    };
    Host.prototype.receivedAddress = function () {
        if (this.isOffline())
            return;
        var ptr = jsapi_.host_get_receivedAddress(this._pointer);
        var addr = new Address_1.Address(ptr);
        return {
            address: addr.address(),
            port: addr.port(),
        };
    };
    Host.prototype.address = function () {
        if (this.isOffline())
            return;
        return this._socket.address();
    };
    Host.prototype.send = function (ip, port, buff, callback) {
        if (this.isOffline())
            return;
        this._socket.send(buff, 0, buff.length, port, ip, callback);
    };
    Host.prototype.flush = function () {
        if (this.isOffline())
            return;
        enet_.host_flush(this._pointer);
    };
    Host.prototype.connect = function (address, channelCount, data, callback) {
        if (channelCount === void 0) { channelCount = 5; }
        if (data === void 0) { data = 0; }
        if (this.isOffline()) {
            if (typeof callback === "function")
                callback(new Error("host-destroyed"));
            return;
        }
        var self = this;
        var enetAddr = address instanceof Address_1.Address ? address : new Address_1.Address(address);
        var ptr = jsapi_.enet_host_connect(this._pointer, enetAddr.host(), enetAddr.port(), channelCount, data);
        self.firstStart(); //start servicing if not yet started
        var succeeded = false;
        if (ptr) {
            var peer_1 = new Peer_1.Peer(ptr);
            peer_1._host = self;
            self.connectedPeers[ptr] = peer_1;
            if (typeof callback === "function") {
                peer_1.on("connect", function () {
                    succeeded = true;
                    callback(undefined, peer_1);
                });
                peer_1.on("disconnect", function () {
                    if (!succeeded)
                        callback(new Error("failed"));
                });
            }
            return peer_1;
        }
        if (typeof callback === "function") {
            setImmediate(function () {
                callback(new Error("maxpeers"));
            });
        }
        return undefined;
    };
    Host.prototype.throttleBandwidth = function () {
        if (this.isOffline())
            return;
        enet_.host_bandwidth_throttle(this._pointer);
    };
    Host.prototype.enableCompression = function () {
        if (this._pointer) {
            enet_.host_compress_with_range_coder(this._pointer);
        }
    };
    Host.prototype.disableCompression = function () {
        if (this._pointer) {
            enet_.host_compress(this._pointer, 0); //passing a 0 disables compression
        }
    };
    Host.prototype.broadcast = function (channel, packet) {
        if (this.isOffline())
            return;
        var _packet = packet instanceof buffer_1.Buffer
            ? new Packet_1.Packet(packet, PACKET_FLAG_1.PACKET_FLAG.RELIABLE)
            : packet;
        enet_.host_broadcast(this._pointer, channel, _packet._pointer);
    };
    Host.prototype.peers = function () {
        var peer_ptr, peers = [];
        for (peer_ptr in this.connectedPeers) {
            peers.push(this.connectedPeers[peer_ptr]);
        }
        return peers;
    };
    Host.prototype.firstStart = function () {
        var self = this;
        if (!self._io_loop) {
            self._io_loop = setInterval(function () {
                self._service();
            }, ENET_HOST_SERVICE_INTERVAL);
        }
    };
    Host.prototype.start = function (ms_interval) {
        var self = this;
        if (!self._pointer)
            return; //cannot start a host that is not initialised
        if (self._io_loop) {
            clearInterval(self._io_loop);
        }
        self._io_loop = setInterval(function () {
            self._service();
        }, ms_interval || ENET_HOST_SERVICE_INTERVAL);
    };
    return Host;
}(events_1.EventEmitter));
exports.Host = Host;
