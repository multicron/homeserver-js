
'use strict';

import logger from "debug"; const debug = logger('homeserver:section');
import allKeys from "all-keys";
import EventEmitter from "events";
import { Device } from "@homeserver-js/device-js";

export class Section extends EventEmitter {
    constructor(registry) {
        super();

        this.registry = registry;
        this.devices = [];
        this.tags = {};
        this.forbidden_names = [];
        this.forbidden_names = allKeys(this);

        this.proxy_handler = {
            get(target, prop, receiver) {
                if (prop in target) {
                    return target[prop];
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
        let new_name = device.variable_name();
        debug("Variable name is", new_name);

        // Can't add a device with the same name as an existing device

        if (this.hasOwnProperty(new_name)) {
            throw (new Error(`Duplicate Device ${new_name} (actual name: "${device.name}") added to Section!`));
        }

        // Can't add a device that will conflict with a built-in property of the class "Section"

        if (this.forbidden_names.has(new_name)) {
            throw (new Error(`A Section cannot have a device named ${new_name} (actual name: "${device.name}")`));
        }

        this[new_name] = device;
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
