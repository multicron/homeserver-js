
'use strict';

import logger from "debug"; const debug = logger('otto:device:openwrtstatus');

import { Device } from "lib/Device.js";
import { SSHGetPollJSON } from "Tranceiver/SSH.js";
import util from 'util';

export class OpenWRTStatusRaw extends Device {
    constructor(name, hostname, username, password, period) {
        super(name);

        this.with(
            new SSHGetPollJSON(
                {
                    username: username,
                    hostname: hostname,
                    command: `ubus call iwinfo assoclist '{"device": "wlan0"}'`
                },
                period, "openwrt_wlan0"));

        this.with(
            new SSHGetPollJSON(
                {
                    username: username,
                    hostname: hostname,
                    command: `ubus call iwinfo assoclist '{"device": "wlan1"}'`
                },
                period, "openwrt_wlan1"));

        this.with(
            new SSHGetPollJSON(
                {
                    username: username,
                    hostname: hostname,
                    command: `ubus call luci-rpc getDHCPLeases '{}'`
                },
                period, "openwrt_dhcp")
        );

        this.on('set_openwrt_dhcp', () => this.process_network_status_tables());
        this.on('set_openwrt_wlan0', () => this.process_network_status_tables());
        this.on('set_openwrt_wlan1', () => this.process_network_status_tables());
    }

    // Returned data format:

    // openwrt_dhcp = {
    //     "dhcp_leases": [
    //         {
    //             "expires": 2060,
    //             "macaddr": "EA:66:5D:A4:09:B2",
    //             "duid": "01:ea:66:5d:a4:09:b2",
    //             "ipaddr": "192.168.5.29"
    //         },
    //         {
    //             "expires": 2378,
    //             "hostname": "henry-pc",
    //             "macaddr": "08:71:90:A5:32:00",
    //             "ipaddr": "192.168.5.119"
    //         },
    //     ],
    //     "dhcp6_leases": [
    //         {
    //             "expires": 2107,
    //             "hostname": "presence-3",
    //             "macaddr": "27:5A:4B:7B:B8:27",
    //             "duid": "00010001275a4b7bb827ebc1d519",
    //             "ip6addr": "2601:155:8300:8d7::2e9",
    //             "ip6addrs": [
    //                 "2601:155:8300:8d7::2e9",
    //                 "fd7c:d102:845::2e9"
    //             ]
    //         },
    //         {
    //             "expires": 3277,
    //             "macaddr": "19:14:33:0C:00:25",
    //             "duid": "000100011914330c0025bce10e2a",
    //             "ip6addr": "2601:155:8300:8d7::38c",
    //             "ip6addrs": [
    //                 "2601:155:8300:8d7::38c",
    //                 "fd7c:d102:845::38c"
    //             ]
    //         },
    //     ]
    // }

    // openwrt_wlan0 = {
    //     "results": [
    //         {
    //             "mac": "CC:50:E3:0F:CF:60",
    //             "signal": -54,
    //             "signal_avg": -52,
    //             "noise": -95,
    //             "inactive": 70,
    //             "connected_time": 73374,
    //             "thr": 38906,
    //             "authorized": true,
    //             "authenticated": true,
    //             "preamble": "short",
    //             "wme": false,
    //             "mfp": false,
    //             "tdls": false,
    //             "mesh llid": 0,
    //             "mesh plid": 0,
    //             "mesh plink": "",
    //             "mesh local PS": "",
    //             "mesh peer PS": "",
    //             "mesh non-peer PS": "",
    //             "rx": {
    //                 "drop_misc": 311,
    //                 "packets": 493905,
    //                 "bytes": 12398480,
    //                 "ht": false,
    //                 "vht": false,
    //                 "mhz": 20,
    //                 "rate": 2000
    //             },
    //             "tx": {
    //                 "failed": 17,
    //                 "retries": 1299,
    //                 "packets": 6538,
    //                 "bytes": 584463,
    //                 "ht": false,
    //                 "vht": false,
    //                 "mhz": 20,
    //                 "rate": 54000
    //             }
    //         },
    //         { ... },
    //         { ... },
    //     ],
    // };


    process_network_status_tables() {
        let dhcp = this.state().openwrt_dhcp?.dhcp_leases || [];
        let dhcp6 = this.state().openwrt_dhcp?.dhcp6_leases || [];
        let wlan0 = this.state().openwrt_wlan0?.results || [];
        let wlan1 = this.state().openwrt_wlan1?.results || [];

        this.output = {};

        dhcp.forEach((item) => this.build_struct(item.macaddr, 'dhcp', item));
        dhcp6.forEach((item) => this.build_struct(item.macaddr, 'dhcp6', item));
        wlan0.forEach((item) => this.build_struct(item.mac, 'wlan0', item));
        wlan1.forEach((item) => this.build_struct(item.mac, 'wlan1', item));

        debug("OpenWRT status", util.inspect(this.output, false, 100));

        this.modify({
            status: this.output
        });
    }

    build_struct(mac, field, value) {
        if (this.output[mac] === undefined) {
            this.output[mac] = {};
        }

        this.output[mac][field] = value;
    }
}


export class OpenWRTStatus extends Device {

    constructor(name, hostname, username, password, period) {
        super(name);

        let raw = new OpenWRTStatusRaw("_OpenWRTStatusRaw", hostname, username, password, period);

        raw.on('change_status', (new_status) => this.modify({ status: new_status }));
    }
}


