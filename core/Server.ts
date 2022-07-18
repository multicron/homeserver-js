
'use strict';

import logger from "debug"; const debug = logger('homeserver:server');

import { Section } from "./Section";
import { Registry } from "./Registry";

export class Server extends Section {
    constructor(registry: Registry) {
        super(registry);
    }
}
