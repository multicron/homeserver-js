
'use strict';

import logger from "debug"; const debug = logger('otto:device:sound');
import child_process from "child_process";

import {
    Device,
} from "@homeserver-js/core";

export class Sound extends Device {
    constructor(name, file) {
        super(name);
        this.on('set_play', () => this.play());
    }

    play() {
    }
}

export class AplaySound extends Sound {
    constructor(name, filename) {
        super(name, filename);

        this.filename = filename;
    }

    play() {
        child_process.exec(`aplay ${this.filename}`);
    }
}
