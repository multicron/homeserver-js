
'use strict';

import logger from "debug"; const debug = logger('homeserver:device:group');

import { Device } from "@homeserver-js/device-js";

export class Group extends Device {
    constructor(name, ...devices) {
        super(name);
        this.modify({
            power: false,
            delay: 0
        });
        this.devices = devices.filter((item) => (typeof item === "object"));
    }

    forEach(callback) {
        if (this.delay === 0) {
            this.devices.forEach((device) => callback(device));
        }
        else {
            let time = 0;
            this.devices.forEach((device) => {
                setTimeout(() => callback(device), time).unref();
                time += this.state().delay;
            });
        }
    }

    // If you add an array with a single item (e.g., [Living_Room_Lights]), the items in Living Room Lights
    // are added, instead of the group "Living Room Lights".

    // This is Group.add() which is a subclass of Device which already has .add() and it performs a different
    // task!

    add(...items) {
        items.forEach((item) => {
            if (item.constructor === Array) {
                if (item.length === 1) {
                    // An array of length 1 - add the device's component devices recursively
                    item[0].devices.forEach((device) => this.add(device));
                }
                else {
                    throw new Error("Only length 1 arrays allowed in argument list to Device.add()");
                }
            }
        });
    }
}

export class MagicGroup extends Group {
    constructor(name, ...devices) {
        super(name, ...devices);

        this.modify({
            power: false,
            delay: 0
        });
        this.methods = ['modify'];

        this._build_methods();
    }

    _build_methods() {
        this.methods.forEach((method) => {
            debug(`Adding method ${method} to MagicGroup ${this.name}`);
            this[method] = ((...args) => this._dispatch_method(method, ...args));
        });
    }

    _dispatch_method(method, ...args) {

        debug("Dispatching", method, "with", args);
        if (this.state().delay === 0) {
            this.devices.filter(device => typeof device[method] === "function").forEach((device) => device[method](...args));
        }
        else {
            let time = 0;
            this.devices.filter(device => typeof device[method] === "function").forEach((device) => {
                setTimeout(() => device[method](...args), time).unref();
                time += this.state().delay;
            });
        }
    }
}

export class MarqueeGroup extends Group {
    constructor(name, ...devices) {
        super(name, ...devices);

        this.flipflop = true;
        this.interval = null;

        let delay = 1000 / (this.devices.length > 0 ? this.devices.length : 0);

        this.modify({
            delay: delay,
            period: 1000,
            power: false
        });

        // Stupid obfuscated code ahead!  This is actually:

        // if (this.state().power) {
        // 	this.power_change(true);
        // }

        this.on('change_period', () => this.state().power && this.power_change(true));
        this.on('change_power', (power) => this.power_change(power));
    }

    update_flipflop() {
        this.flipflop = !this.flipflop;
        this.forEach((device) => device.modify({ power: this.flipflop }));
    }

    power_change(power) {
        if (this.interval) {
            clearInterval(this.interval);
            this.interval = null;
        }

        if (power) {
            this.interval = setInterval(this.update_flipflop.bind(this), this.state().period).unref();
        }
        else {
        }
    }
}
