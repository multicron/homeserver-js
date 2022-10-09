
'use strict';

import logger from "debug"; const debug = logger('homeserver:device:group');

import { Device } from "@homeserver-js/device-js";

export class Group extends Device {
    protected devices: Device[] = [];
    protected delay: number = 0;

    constructor(
        public name: string,
        ...devices: Device[]
    ) {
        super(name);
        this.modify({
            power: false,
            delay: 0
        });

        devices.forEach((item) => this.add(item));
    }

    forEach(callback: (device: Device) => void) {
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

    add(...items: Device[]) {
        items.forEach((item) => this.devices.push(item));
    }
}

export class MagicGroup extends Group {
    [index: string]: any;
    public methods: string[] = ['modify'];
    constructor(
        public name: string,
        ...devices: Device[]) {
        super(name, ...devices);

        this.modify({
            power: false,
            delay: 0
        });

        this._build_methods();
    }

    _build_methods() {
        this.methods.forEach((method) => {
            debug(`Adding method ${method} to MagicGroup ${this.name}`);
            this[method] = ((...args: any[]) => this._dispatch_method(method, ...args));
        });
    }

    _dispatch_method(method: string, ...args: any[]) {

        debug("Dispatching", method, "with", args);

        debug("MagicGroup", this);

        if (this.state().delay === 0) {
            this.devices
                .filter((device) => {
                    debug(`Device: ${device.name} method: ${method} type: ${typeof (device as any)[method]}`);
                    return typeof (device as any)[method] === "function";
                })
                .forEach((device) => (device as any)[method](...args));
        }
        else {
            let time = 0;
            this.devices.filter(device => typeof (device as any)[method] === "function").forEach((device) => {
                setTimeout(() => (device as any)[method](...args), time).unref();
                time += this.state().delay;
            });
        }
    }
}

export class MarqueeGroup extends Group {
    protected flipflop: boolean = true;
    protected interval: NodeJS.Timer | null = null;
    constructor(name: string, ...devices: Device[]) {
        super(name, ...devices);

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

    power_change(power: boolean) {
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
