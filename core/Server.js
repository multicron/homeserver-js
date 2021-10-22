
'use strict';

import logger from "debug"; const debug = logger('otto:server');

import { Section } from "Section.js";

export class Server extends Section {
    constructor(registry) {
        super(registry);
    }
}
