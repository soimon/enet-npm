import { Packet } from "./Packet";
import { Peer } from "./Peer";
export declare class Event {
    _pointer: any;
    constructor();
    free(): void;
    type(): number;
    peer(): Peer;
    peerPtr(): number;
    packet(): Packet;
    data(): number;
    channelID(): number;
}
