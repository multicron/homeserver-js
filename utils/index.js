export default {
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
