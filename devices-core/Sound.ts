
'use strict';

import logger from "debug"; const debug = logger('homeserver:device:sound');
import child_process from "child_process";

import { Device } from "@homeserver-js/device-js";

export class Sound extends Device {
    constructor(
        public name: string,
        protected filename: string
    ) {
        super(name);
        this.on('set_play', () => this.play());
    }

    play() {
    }
}

export class AplaySound extends Sound {
    constructor(
        public name: string,
        public filename: string
    ) {
        super(name, filename);

        this.filename = filename;
    }

    play() {
        child_process.exec(`aplay ${this.filename}`);
    }
}
