
'use strict';

// import logger from "debug"; const debug = logger('homeserver:configuration');

import conf from "../../myhome-server/etc/configuration.js";

import { Section } from "./Section.js";

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

    async load_config() {
        const { default: config } = await import('../etc/configuration.js');

        return config;
    }
}
