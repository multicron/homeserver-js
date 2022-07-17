
'use strict';

import logger from "debug"; const debug = logger('homeserver:device:mailer');
import nodemailer from "nodemailer";
import { Transporter } from "nodemailer";
import SMTPTransport from "nodemailer/lib/smtp-transport";

import { Device } from "@homeserver-js/device-js";

// options = {
//     host: "smtp.ethereal.email",
//     port: 587,
//     secure: false, // true for 465, false for other ports
//     auth: {
//         user: testAccount.user, // generated ethereal user
//         pass: testAccount.pass // generated ethereal password
//     }
// }

export class Mailer extends Device {
    protected transporter: Transporter;
    constructor(
        public name: string,
        private options: SMTPTransport.Options) {
        super(name);

        this.transporter = nodemailer.createTransport(options);
    }

    // Receive a state change from a receiver

    receive(receiver, state) {
        debug(`Got topic ${state.topic} message "${state.message}" `);
        super.receive(receiver, state);
    }

    // data = {
    //     from: '"Fred Foo" <foo@example.com>',    // sender address
    //     to: "bar@example.com, baz@example.com",  // list of receivers
    //     subject: "Hello",                        // Subject line
    //     text: "Hello world?",                    // plain text body
    //     html: "<b>Hello world?</b>"              // html body
    // }

    template(data) {
        this.template = data;

        return this;
    }

    send(data) {

        let message = {};

        Object.assign(message, this.template, data);

        this.transporter.sendMail(message, (info) => this.sent(info));

        return this;
    }

    sent(info) {
        debug("Message sent", info);

        return this;
    }
}