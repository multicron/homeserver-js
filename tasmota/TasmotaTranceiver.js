
'use strict';

import logger from "debug"; const debug = logger('homeserver:xcvr:tasmota');

import {
    MQTTConfigurator,
    MQTTTransmitter,
    MQTTReceiver,
    MQTTValueTransmitter
} from "@homeserver-js/tranceiver-core";

import { parse_json } from "@homeserver-js/utils";

export class MQTTTasmotaBacklogConfigurator extends MQTTConfigurator {
    constructor(broker, topic, value) {
        super(broker, `${topic}/cmnd/Backlog`, "");

        // Strip off double-slash comments from the value

        let comment_regexp = new RegExp("\\s*//.*$", "gm");
        let whitespace_regexp = new RegExp("\\s+", "g");

        this.value = value.replace(comment_regexp, "").replace(whitespace_regexp, " ");
    }
}

export class MQTTTasmotaBacklogTransmitter extends MQTTTransmitter {
    constructor(broker, topic, value) {
        super(broker, "", `${topic}/cmnd/Backlog`);

        // Strip off double-slash comments from the value

        let comment_regexp = new RegExp("\\s*//.*$", "gm");
        let whitespace_regexp = new RegExp("\\s+", "g");

        this.value = value.replace(comment_regexp, "").replace(whitespace_regexp, " ");
    }

    send() {
        debug("Running MQTTTasmotaBacklogTransmitter.send", this.value);
        super.send(this.value);
    }
}

// This is what tasmota_state looks like:
//
//  {"Time":"2019-07-09T12:47:32","Uptime":"3T08:10:22","Vcc":0.593,"SleepMode":"Dynamic","Sleep":0,
//   "LoadAvg": 999, "POWER": "OFF", "Dimmer": 100, "Color": "0000000002", "HSBColor": "0,0,0", 
//   "Channel": [0, 0, 0, 0, 0], "CT": 500, "Scheme": 0, "Fade": "OFF", "Speed": 1, "LedTable": "OFF",
//   "Wifi": { "AP": 1, "SSId": "Peace", "BSSId": "04:A1:51:D3:8A:E3", "Channel": 3, "RSSI": 100, 
//   "LinkCount": 1, "Downtime": "0T00:00:04" }}

export class MQTTTasmotaStateReceiver extends MQTTReceiver {
    constructor(broker, field, topic, state_key) {
        super(broker, field, topic);
        this.state_key = state_key;
    }

    receive_mqtt_msg(topic, message) {
        let values = {};

        let tasmota_state = parse_json(message);

        if (tasmota_state) {
            if (tasmota_state[this.state_key] !== undefined) {
                values[this.field] = tasmota_state[this.state_key];
            }
        }

        this.owner.receive(this, values);
    }
}

export class MQTTTasmotaDeviceStateReceiver extends MQTTTasmotaStateReceiver {
    constructor(broker, device, state_key) {
        super(broker, device.variable_name(), `${device.topic}/tele/STATE`, state_key);
    }
}

export class MQTTTasmotaStateValueReceiver extends MQTTReceiver {
    constructor(broker, field, topic, state_key) {
        super(broker, field, topic);
        this.state_key = state_key;
    }

    receive_mqtt_msg(topic, message) {
        let values = {};

        let tasmota_state = parse_json(message);

        if (tasmota_state) {
            if (tasmota_state[this.state_key] !== undefined) {
                values[this.field] = Number(tasmota_state[this.state_key]);
            }
        }

        this.owner.receive(this, values);
    }
}

export class MQTTTasmotaStateBooleanReceiver extends MQTTReceiver {
    constructor(broker, field, topic, state_key) {
        super(broker, field, topic);
        this.state_key = state_key;
    }

    receive_mqtt_msg(topic, message) {
        let values = {};

        let tasmota_state = parse_json(message);

        if (tasmota_state) {
            if (tasmota_state[this.state_key] !== undefined) {
                values[this.field] = this.booleanize(tasmota_state[this.state_key]);
            }
        }

        this.owner.receive(this, values);
    }
}

export class MQTTTasmotaStateColorReceiver extends MQTTReceiver {
    constructor(broker, field, topic, state_key) {
        super(broker, field, topic);
        this.state_key = state_key;
    }

    receive_mqtt_msg(topic, message) {
        let values = {};

        let tasmota_state = parse_json(message);

        if (tasmota_state) {
            if (tasmota_state[this.state_key] !== undefined) {
                values[this.field] = String(tasmota_state[this.state_key]).substring(0, 6);
            }
        }

        this.owner.receive(this, values);
    }
}

export class MQTTTasmotaColorTransmitter extends MQTTTransmitter {
    constructor(broker, field, topic) {
        super(broker, field, topic);
    }

    send(value) {
        super.send('#' + value.toString());
    }
}

export class MQTTTasmotaBrightnessTransmitter extends MQTTValueTransmitter {
    constructor(broker, field, topic) {
        super(broker, field, topic);
    }

    // Don't send a value of 0, because that sets the power to off.
    // I really feel that power and dimmer shouldn't interact like that!

    send(value) {
        if (value < 1) {
            value = 1;
        }

        super.send(value);
    }
}

export class MQTTTasmotaColorTemperatureTransmitter extends MQTTTransmitter {
    constructor(broker, field, topic) {
        super(broker, field, topic);
    }

    send(value) {
        let ct_val = Math.floor(((1 - ((value - 2000) / 3000)) * (500 - 153)) + 153);
        if (ct_val < 153) {
            ct_val = 153;
        }
        if (ct_val > 500) {
            ct_val = 500;
        }
        debug(`Color temperature ${value} for Tasmota Bulb is ct_val ${ct_val}`);
        super.send(ct_val.toString());
    }
}

