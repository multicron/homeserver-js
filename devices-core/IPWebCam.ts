
'use strict';

import path from "path";
import logger from "debug"; const debug = logger('homeserver:ipwebcam');

import {
    Device,
    DataCollector,
    Switch

} from "@homeserver-js/device-js";

import {
    HTTPGetPollParsed
} from "@homeserver-js/transceiver-core";

import { parse_json } from "@homeserver-js/utils";

import {
    StateHolder
} from "@homeserver-js/core";

export class IPWebCamSensorsCollector extends DataCollector {
    constructor(name: string, url: string, period: number) {
        super(name);

        // We need a special parser because the JSON has an illegal trailing NUL sometimes

        this.with(new HTTPGetPollParsed({ url: url }, period, 'data', (data) => this.parse_data(data)));
    }

    parse_data(data: string) {
        if (data.slice(-1) === "\0") {
            debug("IPWebCamSensorsCollector Found NUL byte at end of JSON data-- ignoring");
            return parse_json(data.slice(0, -1));
        }
        else {
            return parse_json(data);
        }
    }
}

export class IPWebCam extends Device {
    timeout_id: NodeJS.Timeout | undefined;
    constructor(
        public readonly name: string,
        protected url: string
    ) {
        super(name);

    }

    record(tag: string, duration: number) {
        let record_url = `${this.url}/startvideo?force=1&tag=${tag}`;

        new HTTPGetPollParsed({ url: record_url }, 0, 'start_response', (data) => parse_json(data)).poll();

        if (duration) {
            clearTimeout(this.timeout_id);
            this.timeout_id = setTimeout(() => this.timeout_expired, duration).unref();
        }
    }

    timeout_expired() {
        this.timeout_id = undefined;
        this.stop();
    }

    stop() {
        let stop_url = `${this.url}/stopvideo?force=1`;

        new HTTPGetPollParsed({ url: stop_url }, 0, 'stop_response', (data) => parse_json(data)).poll();
    }
}

export class IPWebCamMagSensor extends Switch {
    constructor(
        public name: string,
        protected url?: string,
        protected period?: number
    ) {
        super(name);

        this.modify({ max_thresh: -3, min_thresh: -5, sensor_name: "mag" });
    }

    process_sensor_data(sensor_data: any) {
        let new_state: { [index: string]: any } = {};
        let { max_thresh, min_thresh, sensor_name } = this.state();

        let summary = this.summarize_data(sensor_data, sensor_name);

        debug("Summary of Sensor data", summary);

        let { min } = summary;

        debug("Last value", min);

        if (min !== undefined) {

            new_state.power = (min > max_thresh || min < min_thresh);

            debug(this.name, "old value of power", this.state().power);
            debug(this.name, "updating state with", new_state);

            this.modify(new_state);
        }
    }

    summarize_data(sensor_data: any, sensor_name: string) {
        let count: number = 0;
        let sum: number = 0;
        let avg: number = 0;
        let max: number | undefined;
        let min: number | undefined;
        let last: number | undefined;

        if (sensor_data[sensor_name]) {
            if (sensor_data[sensor_name].data) {
                sensor_data[sensor_name].data.forEach((element: any) => {
                    let [timestamp, [Mx, My, Mz]] = element;
                    if (max === undefined || max < Mx) max = Mx;
                    if (min === undefined || min > Mx) min = Mx;
                    last = Mx;
                    sum += Mx;
                    count++;
                });

                if (count > 0) {
                    avg = (sum / count);
                }
            }
        }
        return { count, sum, avg, max, min, last };
    }
}

// sensor_data = {
//     "mag": {
//         "desc": ["Mx", "My", "Mz"],
//         "unit": "µT",
//         "data": [
//             [1584573244094, [-4.525757, 171.90936, -172.4507]],
//             [1584573244154, [-4.39415, 171.96582, -172.55522]],
//             [1584573244234, [-4.3296814, 171.89697, -172.63495]],
//             [1584573244294, [-4.4345856, 171.95457, -172.63266]],
//             [1584573244354, [-4.3216705, 171.93607, -172.40645]]
//         ]
//     },
//     "lin_accel": {
//         "desc": ["LAx", "LAy", "LAz"],
//         "unit": "m/s²",
//         "data": [
//             [1584573244094, [0.0074261446, -4.863739E-5, -0.0077625215]],
//             [1584573244153, [-0.0016771806, -3.8146973E-5, 0.0088567585]],
//             [1584573244234, [-0.0010145903, -2.2888184E-5, 0.008667633]],
//             [1584573244294, [0.0066639446, -1.8119812E-5, -0.008152783]],
//             [1584573244355, [0.0066639446, -1.8119812E-5, -0.008152783]]
//         ]
//     }
// }
