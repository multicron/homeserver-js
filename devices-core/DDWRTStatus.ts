
'use strict';

import logger from "debug"; const debug = logger('homeserver:device:ddwrtstatus');

import { Device } from "@homeserver-js/device-js";
import { StateHolder } from "@homeserver-js/core";
import { HTTPGetPollJSON } from "@homeserver-js/transceiver-core";

export class DDWRTStatusRaw extends Device {
    constructor(name, hostname, username, password, period) {
        super(name);

        this.with(
            new HTTPGetPollJSON(
                {
                    url: `https://${hostname}/Status_Lan.live.asp`,
                    rejectUnauthorized: false,
                    username: username,
                    password: password
                }, period, "ddwrt_lan"));

        this.with(
            new HTTPGetPollJSON(
                {
                    url: `https://${hostname}/Status_Wireless.live.asp`,
                    rejectUnauthorized: false,
                    username: username,
                    password: password
                }, period, "ddwrt_wireless")
        );

        this.on('set_ddwrt_lan', () => this.process_network_status_tables());
        this.on('set_ddwrt_wireless', () => this.process_network_status_tables());
    }

    process_network_status_tables() {
        let lan = this.state().ddwrt_lan || {};
        let wireless = this.state().ddwrt_wireless || {};

        let arp = lan.arp_table || {};
        let dhcp = lan.dhcp_leases || {};
        let wifi = wireless.active_wireless || {};

        let output = {};

        let macs = {};

        Object.keys(arp).forEach((mac) => macs[mac] = 1);
        Object.keys(dhcp).forEach((mac) => macs[mac] = 1);
        Object.keys(wifi).forEach((mac) => macs[mac] = 1);

        Object.keys(macs).forEach((mac) => {
            output[mac] = {
                arp: arp[mac] || {},
                dhcp: dhcp[mac] || {},
                wifi: wifi[mac] || {}
            };
        });

        // debug("Final output", util.inspect(output, false, 100));

        this.modify({
            status: output
        });
    }
}

export class DDWRTStatus extends Device {
    constructor(name, hostname, username, password, period) {
        super(name);

        let raw = new DDWRTStatusRaw("_DDWRTStatusRaw", hostname, username, password, period);

        raw.on('change_status', (new_status) => this.modify({ status: new_status }));
    }
}


