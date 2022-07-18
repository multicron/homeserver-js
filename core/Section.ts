
'use strict';

import logger from "debug"; const debug = logger('homeserver:section');
import EventEmitter from "events";
import { Device } from "@homeserver-js/device-js";
import { Registry } from "./Registry";

export class Section extends EventEmitter {
    [index: string]: any;
    private devices: Device[] = [];
    private tags: { [index: string]: Device[] } = {};
    public items: Map<string, Device> = new Map();
    private proxy_handler;

    constructor(
        protected registry: Registry
    ) {
        super();

        this.proxy_handler = {
            get(target: any, prop: string, receiver: any) {
                if (prop in target) {
                    return target[prop];
                }
                else if (target.items.has(prop)) {
                    return target.items.get(prop);
                }
                else {
                    debug(`Illegal access of device ${prop} in ${target.constructor.name}`);
                    return new Device();
                }
            }
        };

        const proxy = new Proxy(this, this.proxy_handler);

        return proxy;
    }

    add(device: Device) {
        // Can't add a device with the same name as an existing device

        if (this.items.has(device.name)) {
            throw (new Error(`Attempt to add Duplicate Device ${device.name}`));
        }

        this.items.set(device.name, device);

        this.devices.push(device);

        return device;
    }

    close() {
        this.devices.forEach((device) => device.close());
    }

    add_to_tags(device: Device) {
        device.tags.forEach((tag) => {
            if (!this.tags[tag]) {
                this.tags[tag] = [];
            }
            this.tags[tag].push(device);
        });
    }
}
