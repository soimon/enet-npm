export declare const PEER_STATES: {
    readonly DISCONNECTED: 0;
    readonly CONNECTING: 1;
    readonly ACKNOWLEDGING_CONNECT: 2;
    readonly CONNECTION_PENDING: 3;
    readonly CONNECTION_SUCCEEDED: 4;
    readonly CONNECTED: 5;
    readonly DISCONNECT_LATER: 6;
    readonly DISCONNECTING: 7;
    readonly ACKNOWLEDGING_DISCONNECT: 8;
    readonly ZOMBIE: 9;
};
export declare type PEER_STATE = typeof PEER_STATES[keyof typeof PEER_STATES];
