const ENETModule = require("./build/enet.js");
const jsapi_ = ENETModule.jsapi;

export const Host = require("./lib/Host.js").Host;
export const createServer = require("./lib/Host.js").createServer;
export const createClient = require("./lib/Host.js").createClient;
export const createServerFromSocket = require("./lib/Host.js").createServerFromSocket;
export const Event = require("./lib/Event.js").Event;
export const Address = require("./lib/Address.js").Address;
export const Packet = require("./lib/Packet.js").Packet;
export const Peer = require("./lib/Peer.js").Peer;
export const Buffer = require("buffer").Buffer; //for use in chrome app when creating packets
export const PACKET_FLAG = require("./lib/PACKET_FLAG.js").PACKET_FLAG;
export const PEER_STATE = require("./lib/PEER_STATE.js").PEER_STATE;

export const init = function (func) {
	var funcPointer = ENETModule["Runtime_addFunction"](function (host_ptr) {
		var addr = new Address(jsapi_.host_get_receivedAddress(host_ptr));
		return func(addr.address(), addr.port());
	});
	jsapi_.init(funcPointer);
};

