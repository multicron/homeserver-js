
'use strict';

// import logger from "debug"; const debug = logger('otto:configuration');

import { Section } from "@homeserver-js/core";
import config from "../../configuration.js";

export class Configuration extends Section {

    static singleton;

    constructor(registry) {
        if (Configuration.singleton) {
            return Configuration.singleton;
        }

        super(registry);

        this.timezone = "America/New_York";
        this.HTTPServer_port = 3000;
        this.HTTPServer_address = "192.168.5.100";
        this.HomeServer_mqtt_broker = "mqtt://127.0.0.1";

        Object.assign(this, config);

        Configuration.singleton = this;
    }
}
