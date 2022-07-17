
'use strict';

import cron from "cron"; const CronJob = cron.CronJob;

import logger from "debug"; const debug = logger('homeserver:powermonitor');

import { Device } from "@homeserver-js/device-js";

export class Daylight extends Device {
    constructor(name) {
        super(name);

        new CronJob("00 50 05 * * *", () => {
            this.modify({ power: true });
        }, null, true, "America/New_York");

        new CronJob("00 15 20 * * *", () => {
            this.modify({ power: false });
        }, null, true, "America/New_York");

    }
}

