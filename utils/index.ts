import logger from "debug"; const debug = logger('homeserver:util');

export function parse_json(json) {
    try {
        return JSON.parse(json);
    }
    catch (e) {
        debug("parse_json failed:", e, json);
        return undefined;
    }
}


