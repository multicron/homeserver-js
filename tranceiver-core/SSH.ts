
'use strict';

import logger from "debug"; const debug = logger('homeserver:xcvr:ssh');
import { execFile, ExecFileException } from "child_process";
import { parse_json } from "@homeserver-js/utils";

import {
    Receiver,
    Transmitter,
} from "@homeserver-js/tranceiver-js";

/**
 * Utility Function Asynchronously fetches data by executing ssh in a subprocess 
 */

function SSHGet(options, callback: (error: ExecFileException | null, stdout: string, stderr: string) => void) {
    let my_options = Object.assign({}, options);

    debug("Spawning ssh process", options);

    let ssh_process = execFile(
        "ssh",
        [
            'StrictHostKeyChecking=accept-new',
            `${options.username}@${options.hostname}`,
            options.command
        ],
        {},
        callback
    );
}

export class SSHGetPoll extends Receiver {
    protected interval_id: NodeJS.Timer | null = null;

    constructor(
        protected options: { [index: string]: any } = {},
        protected period: number,
        protected field: string
    ) {
        super();

        if (this.period > 0) {
            this.poll();
            this.period = Math.abs(this.period);
        }

        if (period != 0) {
            this.interval_id = setInterval(() => this.poll(), this.period * 1000).unref();
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
    constructor(
        protected options: { [index: string]: any },
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
        super(options, period, field, (json) => parse_json(json));
    }
}

