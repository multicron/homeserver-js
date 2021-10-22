
'use strict';

import logger from "debug"; const debug = logger('homeserver:device:mailer');
import nodemailer from "nodemailer";

import { Device } from "@homeserver-js/device-js";

import { PortProbeReceiver } from "@homeserver-js/tranceiver-js";

export class PingerTCP extends Device {
    constructor(name, host, ip, port, comment, period) {
        super(name);

        this.modify({
            host: host,
            ip: ip,
            port: port,
            comment: comment
        });

        this.with(new PortProbeReceiver(ip, port, period));
    }
}