
'use strict';

import logger from "debug"; const debug = logger('homeserver:baseobject');
import EventEmitter from "events";

export class BaseObject extends EventEmitter {
    constructor() {
        super();
    }

    can(method_name) {
        return (typeof this[method_name] === "function");
    }
}

