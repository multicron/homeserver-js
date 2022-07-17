
'use strict';

import logger from "debug"; const debug = logger('homeserver:configuration');

import url from 'url';

import { Section } from "./Section";
import { Registry } from "./Registry";

if (!process.env.HOMESERVERJS_CONFIG) {
    throw new Error("Environment variable HOMESERVERJS_CONFIG is not set!");
}

const { "default": conf } = await import(url.pathToFileURL(process.env.HOMESERVERJS_CONFIG).toString());

export class Configuration extends Section {

    // This class is a singleton
    static singleton: Configuration;

    // This allows any property reference at all on this class
    [index: string]: any;

    // If you are not instantiating the singleton, you don't need to pass the registry

    constructor(registry?: Registry) {
        if (Configuration.singleton) {
            return Configuration.singleton;
        }

        if (!registry) {
            throw new Error("No registry specified when trying to create Configuration singleton");
        }

        super(registry);

        Object.assign(this, conf);

        Configuration.singleton = this;
    }
}
