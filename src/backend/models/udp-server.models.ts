/**
 * Client request registration flags.
 */
export const enum ClientRequestRegFlags {
    All = 0,
    Id = 1,
    Mac = 2,
}

/**
 * Default values for UDP server.
 */
export const enum UdpServerDefaults {
    MaxProtocolVer = 1001,
    ClientTimeoutLimit = 5000,
}

/**
 * UDP server possible message values.
 */
export const enum UdpServerMessage {
    DSUC_VersionReq = 0x100000,
    DSUS_VersionRsp = 0x100000,
    DSUC_ListPorts = 0x100001,
    DSUS_PortInfo = 0x100001,
    DSUC_PadDataReq = 0x100002,
    DSUS_PadDataRsp = 0x100002,
}
