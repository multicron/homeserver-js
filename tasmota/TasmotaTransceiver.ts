
'use strict';

import logger from "debug"; const debug = logger('homeserver:xcvr:tasmota');

import { Device } from "@homeserver-js/device-js";

import {
    MQTTConfigurator,
    MQTTTransmitter,
    MQTTReceiver,
    MQTTBooleanReceiver,
    MQTTValueTransmitter
} from "@homeserver-js/transceiver-core";

import { parse_json } from "@homeserver-js/utils";

export class MQTTTasmotaBacklogConfigurator extends MQTTConfigurator {
    constructor(
        broker: string,
        topic: string,
        protected value: string
    ) {
        super(broker, `${topic}/cmnd/Backlog`, "");

        // Strip off double-slash comments from the value

        let comment_regexp = new RegExp("\\s*//.*$", "gm");
        let whitespace_regexp = new RegExp("\\s+", "g");

        this.value = value.replace(comment_regexp, "").replace(whitespace_regexp, " ");
    }
}

export class MQTTTasmotaBacklogTransmitter extends MQTTTransmitter {
    constructor(
        public broker: string,
        protected topic: string,
        protected default_value: string
    ) {
        super(broker, "", `${topic}/cmnd/Backlog`);

        // Strip off double-slash comments from the value

        let comment_regexp = new RegExp("\\s*//.*$", "gm");
        let whitespace_regexp = new RegExp("\\s+", "g");

        this.default_value = default_value.replace(comment_regexp, "").replace(whitespace_regexp, " ");
    }

    send(value?: string) {
        if (!value) {
            value = this.default_value;
        }
        debug("Running MQTTTasmotaBacklogTransmitter.send", value);
        super.send(value);
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
    constructor(
        protected broker: string,
        protected field: string,
        protected topic: string,
        protected state_key: string) {
        super(broker, field, topic);
        this.state_key = state_key;
    }

    receive_mqtt_msg(topic: string, message: string) {
        let values: { [index: string]: any } = {};

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
    constructor(
        broker: string,
        device: Device,
        state_key: string
    ) {
        let topic = (device as any).topic || "unkown_topic";

        super(broker, device.name, `${topic}/tele/STATE`, state_key);
    }
}

export class MQTTTasmotaStateNumberReceiver extends MQTTReceiver {
    constructor(
        broker: string,
        field: string,
        topic: string,
        protected state_key: string
    ) {
        super(broker, field, topic);
    }

    receive_mqtt_msg(topic: string, message: string) {
        let values: { [index: string]: number } = {};

        let tasmota_state = parse_json(message);

        if (tasmota_state) {
            if (tasmota_state[this.state_key] !== undefined && this.field !== null) {
                values[this.field] = Number(tasmota_state[this.state_key]);
            }
        }

        this.owner.receive(this, values);
    }
}

export class MQTTTasmotaStateBooleanReceiver extends MQTTBooleanReceiver {
    constructor(
        protected broker: string,
        protected field: string,
        protected topic: string,
        protected state_key: string
    ) {
        super(broker, field, topic);
        this.state_key = state_key;
    }

    receive_mqtt_msg(topic: string, message: string) {
        let values: { [index: string]: boolean } = {};

        let tasmota_state = parse_json(message);

        if (tasmota_state) {
            if (tasmota_state[this.state_key] !== undefined) {
                let boolean_or_null = this.booleanize(tasmota_state[this.state_key]);
                if (boolean_or_null !== null) {
                    values[this.field] = boolean_or_null;
                }
            }
        }

        this.owner.receive(this, values);
    }
}

export class MQTTTasmotaStateColorReceiver extends MQTTReceiver {
    constructor(
        protected broker: string,
        protected field: string,
        protected topic: string,
        protected state_key: string
    ) {
        super(broker, field, topic);
        this.state_key = state_key;
    }

    receive_mqtt_msg(topic: string, message: string) {
        let values: { [index: string]: string } = {};

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
    constructor(
        broker: string,
        field: string,
        topic: string
    ) {
        super(broker, field, topic);
    }

    send(value: string) {
        super.send('#' + value.toString());
    }
}

export class MQTTTasmotaBrightnessTransmitter extends MQTTValueTransmitter {
    constructor(
        broker: string,
        field: string,
        topic: string
    ) {
        super(broker, field, topic);
    }

    // Don't send a value of 0, because that sets the power to off.
    // I really feel that power and dimmer shouldn't interact like that!

    send(value: number) {
        if (value < 1) {
            value = 1;
        }

        super.send(value);
    }
}

export class MQTTTasmotaColorTemperatureTransmitter extends MQTTTransmitter {
    constructor(
        broker: string,
        field: string,
        topic: string
    ) {
        super(broker, field, topic);
    }

    send(value: number) {
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

