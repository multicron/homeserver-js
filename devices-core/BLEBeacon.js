
'use strict';

import logger from "debug"; const debug = logger('otto:device:blebeacon');

import {
    MQTTJSONReceiver,
} from "Tranceiver/MQTT.js";

import {
    DataCollector
} from "lib/Device.js";

export class BLEBeacon extends DataCollector {
    constructor(name, broker, topic, timeout) {
        super(name);

        this.modify({
            rssi: null
        });

        this.timeout_id = null;
        this.timeout = timeout;

        this.with(new MQTTJSONReceiver(broker, "beacon", topic));

        this.on('set_beacon', (new_value) => {

            this.set_timer();

            this.modify({
                rssi: new_value.rssi,
                present: true
            });
        });
    }

    set_timer() {
        this.clear_timer();

        if (this.timeout) {
            this.timeout_id = setTimeout(() => { this.timer_expired() }, this.timeout).unref();
        }
    }

    clear_timer() {
        if (this.timeout_id) {
            clearTimeout(this.timeout_id);
            this.timeout_id = null;
        }
    }

    timer_expired() {
        this.timeout_id = null;
        this.modify({
            rssi: null,
            present: false
        });
    }
}
