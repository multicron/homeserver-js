
'use strict';

import logger from "debug"; const debug = logger('homeserver:testserver');

import { Server } from "@homeserver-js/core";
import { Registry } from "@homeserver-js/core";

export class TestServer extends Server {
    constructor(registry: Registry) {
        super(registry);

        let house = this;
        let mqtt_broker = registry.Configuration.mqtt_broker_local_url;

    }
}

