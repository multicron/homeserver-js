
'use strict';

import logger from "debug"; const debug = logger('homeserver:device:mailer');

import { Device } from "@homeserver-js/device-js";

export class Ticker extends Device {
    private interval_id: NodeJS.Timer;

    constructor(name: string) {
        super(name);

        this.interval_id = setInterval(() => this.set_my_time(), 1000).unref();
    }

    set_my_time() {
        this.modify({ time: new Date().toISOString() });
    }
}