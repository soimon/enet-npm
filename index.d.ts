export { Host, createClient, createServer, createServerFromSocket, } from "./lib/Host";
export { Event } from "./lib/Event";
export { Address } from "./lib/Address";
export { Packet } from "./lib/Packet";
export { Peer } from "./lib/Peer";
export { PACKET_FLAG } from "./lib/PACKET_FLAG";
export { PEER_STATE, PEER_STATES } from "./lib/PEER_STATE";
export declare const init: (func: (address: string, port: number) => void) => void;
