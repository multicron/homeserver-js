
'use strict';

// import logger from "debug"; const debug = logger('homeserver:configuration');

import { Section } from "./Section.js";
import config from "../../../configuration.js";

export class Configuration extends Section {

    static singleton;

    constructor(registry) {
        if (Configuration.singleton) {
            return Configuration.singleton;
        }

        super(registry);

        Object.assign(this, config);

        Configuration.singleton = this;
    }
}
