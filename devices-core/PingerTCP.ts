
'use strict';

import logger from "debug"; const debug = logger('homeserver:device:mailer');
import nodemailer from "nodemailer";

import { Device } from "@homeserver-js/device-js";

import { PortProbeReceiver } from "@homeserver-js/transceiver-js";

export class PingerTCP extends Device {
    constructor(
        name: string,
        host: string,
        ip: string,
        port: number,
        comment: string,
        period: number
    ) {
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