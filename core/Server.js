
'use strict';

import logger from "debug"; const debug = logger('homeserver:server');

import { Section } from "@homeserver-js/core";

export class Server extends Section {
    constructor(registry) {
        super(registry);
    }
}
