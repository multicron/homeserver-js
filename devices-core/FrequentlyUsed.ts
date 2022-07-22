
'use strict';

import logger from "debug"; const debug = logger('homeserver:device:blebeacon');

import { Device } from "@homeserver-js/device-js";

export class FrequentlyUsed extends Device {
    usages: { [index: string]: number } = {};
    constructor(
        public name: string) {
        super(name);

        this.modify({ devices: ['Power_Meter', 'Red_Table_Light'] });
    }

    device_modified(device: Device, field: string, value: any) {
        let device_name = device.variable_name();

        if (this.usages[device_name] === undefined) this.usages[device_name] = 0;

        this.usages[device_name]++;

        // [[device_name, count],[device_name, count],[device_name, count],...]

        let entries = Object.entries(this.usages).sort((a, b) => b[1] - a[1]);

        let devices = entries.map(([dev_name, count]) => dev_name);

        this.modify({ devices: devices });
    }
}
