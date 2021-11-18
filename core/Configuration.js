
'use strict';

import logger from "debug"; const debug = logger('homeserver:configuration');

import { Section } from "./Section.js";

const { default: conf } = await import("file://" + process.env['HOMESERVERJS_CONFIG']);

export class Configuration extends Section {

    static singleton;

    constructor(registry) {
        if (Configuration.singleton) {
            return Configuration.singleton;
        }

        super(registry);

        Object.assign(this, conf);

        Configuration.singleton = this;
    }
}
