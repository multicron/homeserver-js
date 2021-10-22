
'use strict';

import logger from "debug"; const debug = logger('otto:testserver');

import { Server } from "lib/Server.js";

export class TestServer extends Server {
    constructor(registry) {
        super(registry);

        let house = this;
        let mqtt_broker = registry.Configuration.HomeServer_mqtt_broker;

    }
}

