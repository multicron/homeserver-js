
'use strict';

import logger from "debug"; const debug = logger('homeserver:device:mailer');

import { Device } from "@homeserver-js/device-js";

export class Ticker extends Device {
    constructor(name) {
        super(name);

        this.interval = setInterval(() => this.set_my_time(), 1000).unref();
    }

    set_my_time() {
        this.modify({ time: new Date().toISOString() });
    }
}