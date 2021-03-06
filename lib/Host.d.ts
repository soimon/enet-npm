/// <reference types="node" />
import { EventEmitter } from "events";
import { AddressType } from "./Address";
import { Event } from "./Event";
import { Packet } from "./Packet";
import { Peer } from "./Peer";
export declare type Callback<T> = (e?: Error, result?: T | undefined) => void;
export declare type HostType = "server" | "client" | "custom";
export declare function createServer(arg: Parameters<typeof createHost>[0], callback: Parameters<typeof createHost>[1]): Host | undefined;
export declare function createClient(arg: Parameters<typeof createHost>[0], callback: Parameters<typeof createHost>[1]): Host | undefined;
export declare function createServerFromSocket(arg: Parameters<typeof createHost>[0], callback: Parameters<typeof createHost>[1]): Host | undefined;
export declare type HostOptions = {
    address?: AddressType;
    peers?: number;
    channels?: number;
    down?: number;
    up?: number;
    socket?: any;
};
declare function createHost(opt: HostOptions, callback: Callback<Host> | undefined, host_type: HostType): Host | undefined;
export declare class Host extends EventEmitter {
    connectedPeers: Record<string, Peer>;
    _type: HostType;
    _event: Event;
    _pointer: number;
    _socket: any;
    _packet_free_func_ptr: any;
    _packet_callback_functions: Record<keyof any, Callback<void>>;
    _shutting_down: boolean;
    _socket_closed: boolean;
    _servicing: boolean;
    _io_loop: any;
    constructor(address?: AddressType, maxpeers?: number, maxchannels?: number, bw_down?: number, bw_up?: number, host_type?: HostType, custom_socket?: any);
    _addPacketCallback(packet: Packet, callback: Callback<void>): void;
    isOffline(): boolean;
    isOnline(): boolean;
    _service(): void;
    stop(): void;
    destroy(): void;
    receivedAddress(): {
        address: string;
        port: number;
    } | undefined;
    address(): {
        address: string;
        port: number;
    } | undefined;
    send(ip: string, port: number, buff: Buffer, callback?: Callback<number>): void;
    flush(): void;
    connect(address: AddressType, channelCount?: number, data?: number, callback?: Callback<Peer>): Peer | undefined;
    throttleBandwidth(): void;
    enableCompression(): void;
    disableCompression(): void;
    broadcast(channel: number, packet: Packet | Buffer): void;
    peers(): (Peer | undefined)[];
    firstStart(): void;
    start(ms_interval: number): void;
}
export declare interface Host {
    on(event: "error", listener: (err: any) => void): this;
    on(event: "connect", listener: (peer: Peer, data: number, initiatedByMe: boolean) => void): this;
    on(event: "telex", listener: (data: Buffer | undefined, sender: {
        address: string;
        port: number;
    }) => void): this;
    on(event: "message", listener: (peer: Peer, packet: Packet, channel: number) => void): this;
    on(event: "disconnect", listener: () => void): this;
    on(event: "destroy", listener: () => void): this;
    emit(event: "error", err: any): boolean;
    emit(event: "connect", peer: Peer, data: number | undefined, initiatedByMe: boolean): boolean;
    emit(event: "telex", data: Buffer | undefined, sender: {
        address?: string;
        port?: number;
    }): boolean;
    emit(event: "message", peer: Peer, packet: Packet, channel: number): boolean;
    emit(event: "disconnect", code?: number): boolean;
    emit(event: "destroy"): boolean;
}
export {};
