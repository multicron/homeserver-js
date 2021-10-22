
'use strict';

import logger from "debug"; const debug = logger('otto:baseobject');
import EventEmitter from "events";

export class BaseObject extends EventEmitter {
    constructor() {
        super();
    }

    can(method_name) {
        return (typeof this[method_name] === "function");
    }

    parse_json(json) {
        try {
            return JSON.parse(json);
        }
        catch (e) {
            debug("parse_json failed:", e, json);
            return undefined;
        }
    }
}

