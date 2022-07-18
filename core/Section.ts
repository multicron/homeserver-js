
'use strict';

import logger from "debug"; const debug = logger('homeserver:section');
import EventEmitter from "events";
import { Device } from "@homeserver-js/device-js";
import { Registry } from "./Registry";

export class Section extends EventEmitter {
    protected registry;
    private devices;
    private tags;
    public items;
    private proxy_handler;

    constructor(registry: Registry) {
        super();

        this.registry = registry;
        this.devices = [];
        this.tags = {};
        this.items = new Map();

        this.proxy_handler = {
            get(target, prop, receiver) {
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

    add(device) {
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

    add_to_tags(device) {
        device.tags.forEach((tag) => {
            if (!this.tags[tag]) {
                this.tags[tag] = [];
            }
            this.tags[tag].push(device);
        });
    }
}
