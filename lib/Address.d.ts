export declare type AddressType = Address | {
    address: string;
    port: number;
} | string;
export declare class Address {
    _pointer: number | undefined;
    _host: number;
    _port: number;
    constructor(pointer: number);
    constructor(address: AddressType);
    constructor(address: string | number, port: number);
    host(): number;
    port(): number;
    address(): string;
}
