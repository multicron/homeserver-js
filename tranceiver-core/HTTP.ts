
'use strict';

import logger from "debug"; const debug = logger('homeserver:xcvr:http');
import request from "request";
import { parse_json } from "@homeserver-js/utils";

import {
    Receiver,
    Transmitter,
    Configurator
} from "@homeserver-js/tranceiver-js";

/**
 * Utility Function Asynchronously fetches data from a URL with request.get 
 * (including optional Basic Auth header if options[username] and options[password] are passed)
 *
 * @param {Object} options
 * @param {Function} callback
 * @returns request.get() response
 */

type HTTPOptions = request.CoreOptions & { username?: string, password?: string, url: string };

function HTTPGet(options: HTTPOptions, callback) {
    let my_options = Object.assign({}, options);
    let username = options.username;
    let password = options.password;
    if (username || password) {
        let auth = 'Basic ' + Buffer.from(username + ':' + password).toString('base64');

        var new_header = { 'Authorization': auth };

        let my_headers = Object.assign({}, my_options.headers, new_header);

        my_options.headers = my_headers;
    }

    debug("HTTPGet", my_options);

    if (!(my_options.url)) {
        throw new Error("HTTP request must have a URL");
    }

    return request.get(my_options, callback);
}

export class HTTPGetPoll extends Receiver {
    protected interval_id: NodeJS.Timer | null = null;

    constructor(
        protected options: HTTPOptions,
        protected period: number,
        protected field: string
    ) {
        super();

        if (period > 0) {
            this.period = Math.abs(period);
            this.poll();
        }

        debug("Period is", this.period);

        if (period != 0) {
            this.interval_id = setInterval(() => this.poll(), this.period * 1000).unref();
        }
    }

    poll() {
        let options = Object.assign({}, this.options);

        HTTPGet(options, (err, res, body) => {
            if (err) {
                debug(err);
            }
            else {
                this.receive_http_msg(body);
            }
        });

        return this;
    }

    receive_http_msg(body) {
        debug("HTTPGetPoll got data: ", body);
        let values = {};
        values[this.field] = body;
        this.owner.receive(this, values);
    }
}

export class HTTPGetPollParsed extends HTTPGetPoll {
    constructor(
        protected options: HTTPOptions,
        protected period: number,
        protected field: string,
        protected parser: (data: any) => any
    ) {
        super(options, period, field);

        if (!parser) {
            throw new Error("parser must be specified");
        }

        this.parser = parser;
    }

    receive_http_msg(body) {
        let values = {};
        let parsed = {};

        debug("HTTPGetPoll got data: ", body);

        try {
            parsed = this.parser(body);
        }
        catch (err) {
            debug("Bad Parse: ", err, body);
        }
        values[this.field] = parsed;

        this.owner.receive(this, values);
    }
}

export class HTTPGetPollJSON extends HTTPGetPollParsed {
    constructor(options, period, field) {
        super(options, period, field, (json) => parse_json(json));
    }
}

export class HTTPConfigurator extends Configurator {
    constructor(protected url: string) {
        super();
    }

    configure() {
        request(this.url, (err, res, body) => {
            if (err) {
                debug(err);
            }
            else {
                debug(body);
            }
        });
    }
}

export class HTTPTransmitter extends Transmitter {
    constructor(
        protected url: string,
        protected field: string
    ) {
        super();
    }

    state_change(field: string, new_value: any, old_value: any) {
        if (this.field === field) {
            this.send(new_value);
        }
    }

    send(value) {
        if (this.url) {

            request(`${this.url}${value}`, (err, res, body) => {
                if (err) {
                    debug(err);
                }
                else {
                    debug(body);
                }
            });

        }
    }
}

export class HTTPBooleanTransmitter extends HTTPTransmitter {
    constructor(
        protected url: string,
        protected field: string,
        protected on_value: string | number,
        protected off_value: string | number
    ) {
        super(url, field);
    }

    send(value: boolean) {
        if (value) {
            super.send(this.on_value);
        }
        else {
            super.send(this.off_value);
        }
    }
}

