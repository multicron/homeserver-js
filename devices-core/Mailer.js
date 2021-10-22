
'use strict';

import logger from "debug"; const debug = logger('otto:device:mailer');
import nodemailer from "nodemailer";

import {
    Device
} from "@homeserver-js/core";

export class Mailer extends Device {
    constructor(name) {
        super(name);
    }

    // Receive a state change from a receiver

    receive(receiver, state) {
        debug(`Got topic ${state.topic} message "${state.message}" `);
        super.receive(receiver, state);
    }

    // options = {
    //     host: "smtp.ethereal.email",
    //     port: 587,
    //     secure: false, // true for 465, false for other ports
    //     auth: {
    //         user: testAccount.user, // generated ethereal user
    //         pass: testAccount.pass // generated ethereal password
    //     }
    // }

    configure(options) {
        this.transporter = nodemailer.createTransport(options);

        return this;
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