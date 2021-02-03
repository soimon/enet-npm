/// <reference types="node" />
export declare class Packet {
    _pointer: number;
    constructor(pointer: number);
    constructor(buffer: Buffer | string, flags?: number);
    protected _packetFromBuffer(buf: Buffer, flags: number): void;
    _attachFreeCallback(free_ptr: number): void;
    flags(): number;
    wasSent(): boolean;
    data(): Buffer | undefined;
    dataLength(): number;
    destroy(): void;
}
