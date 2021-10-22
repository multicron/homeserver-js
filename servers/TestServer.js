
'use strict';

import logger from "debug"; const debug = logger('homeserver:testserver');

import { Server } from "@homeserver-js/core";

export class TestServer extends Server {
    constructor(registry) {
        super(registry);

        let house = this;
        let mqtt_broker = registry.Configuration.HomeServer_mqtt_broker;

    }
}

