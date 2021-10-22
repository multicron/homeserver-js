
'use strict';

import logger from "debug"; const debug = logger('otto:server');

import { Section } from "@homeserver-js/core";

export class Server extends Section {
    constructor(registry) {
        super(registry);
    }
}
