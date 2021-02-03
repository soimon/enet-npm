/// <reference types="node" />
import { EventEmitter } from "events";
import * as Stream from "stream";
import { PEER_STATE } from "./PEER_STATE";
import { Packet } from "./Packet";
import { Host } from "./Host";
export declare type Callback<T> = (e?: Error, result?: T | undefined) => void;
export declare class Peer extends EventEmitter {
    _pointer: number;
    _host?: Host;
    _address?: {
        address: string;
        port: number;
    };
    constructor(_pointer: number);
    state(): PEER_STATE;
    incomingDataTotal(): number;
    outgoingDataTotal(): number;
    reliableDataInTransit(): number;
    send(channel: number, packet: Packet | Buffer | string, callback?: Callback<void>): boolean;
    _delete(emitDisconnect: boolean, disconnectData?: any): void;
    reset(): void;
    ping(): void;
    disconnect(data: number): this;
    disconnectNow(data: number): this;
    disconnectLater(data: number): this;
    address(): this["_address"];
    createWriteStream(channel: number): Stream.Writable | undefined;
    createReadStream(channel: number): Stream.Readable | undefined;
    createDuplexStream(channel: number): Stream.Duplex | undefined;
}
export declare interface Peer {
    on(event: "connect", listener: () => void): this;
    on(event: "message", listener: (packet: Packet, channel: number) => void): this;
    on(event: "disconnect", listener: (code?: number) => void): this;
    emit(event: "connect"): boolean;
    emit(event: "message", packet: Packet, channel: number): boolean;
    emit(event: "disconnect", code?: number): boolean;
}
