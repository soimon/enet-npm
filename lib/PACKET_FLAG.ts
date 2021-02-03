export const PACKET_FLAG = {
    RELIABLE: 1,
    UNSEQUENCED: 2,
    UNRELIABLE_FRAGMENT: 8,
    SENT: 256,
} as const;
