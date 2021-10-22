
'use strict';

import logger from "debug"; const debug = logger('otto:xcvr:ssh');
import { execFile } from "child_process";

import {
    Receiver,
    Transmitter,
    Configurator
} from "@homeserver-js/core";

/**
 * Utility Function Asynchronously fetches data from a URL with request.get 
 * (including optional Basic Auth header if options[username] and options[password] are passed)
 *
 * @param {Object} options
 * @param {Function} callback
 * @returns request.get() response
 */

function SSHGet(options, callback) {
    let my_options = Object.assign({}, options);
    let username = options.username;
    let password = options.password;
    let stdout_data = "";
    let stderr_data = "";

    debug("SSHGet", my_options);

    console.log("Spawning ssh process", options);

    let ssh_process = execFile(
        "ssh",
        [`${options.username}@${options.hostname}`,
        options.command],
        {},
        callback
    );
}

export class SSHGetPoll extends Receiver {
    constructor(options, period, field) {
        super();
        this.period = Math.abs(period);
        this.field = field;
        this.options = options;
        this.interval = null;

        if (period > 0) {
            this.poll();
        }

        debug("Period is", this.period);

        if (period != 0) {
            this.interval = setInterval(() => this.poll(), this.period * 1000).unref();
        }
    }

    poll() {
        let options = Object.assign({}, this.options);

        SSHGet(options, (err, stdout, stderr) => {
            if (err) {
                debug(err);
            }
            else {
                debug("Got stdout", stdout);
                debug("Got stderr", stderr);
                this.receive_SSH_msg(stdout);
            }
        });

        return this;
    }

    receive_SSH_msg(body) {
        debug("SSHGetPoll got data: ", body);
        let values = {};
        values[this.field] = body;
        this.owner.receive(this, values);
    }
}

export class SSHGetPollParsed extends SSHGetPoll {
    constructor(options, period, field, parser) {
        super(options, period, field);

        if (!parser) {
            throw new Error("parser must be specified");
        }

        this.parser = parser;
    }

    receive_SSH_msg(body) {
        let values = {};
        let parsed = {};

        debug("SSHGetPoll got data: ", body);

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

export class SSHGetPollJSON extends SSHGetPollParsed {
    constructor(options, period, field) {
        super(options, period, field, (json) => this.parse_json(json));
    }
}

export class SSHTransmitter extends Transmitter {
    constructor(url, field) {
        super();
        this.url = url;
        this.field = field;
    }

    state_change(field, new_value, old_value) {
        if (this.field === field) {
            this.send(new_value);
        }
    }

    send(value) {
    }
}

export class SSHBooleanTransmitter extends SSHTransmitter {
    constructor(url, field, on_value, off_value) {
        super(url, field);
        this.on_value = on_value;
        this.off_value = off_value;
    }

    send(value) {
        if (value) {
            super.send(this.on_value);
        }
        else {
            super.send(this.off_value);
        }
    }
}

