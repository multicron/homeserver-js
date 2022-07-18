
'use strict';

import logger from "debug"; const debug = logger('homeserver:device:blebeacon');

import {
    MQTTJSONReceiver,
} from "@homeserver-js/transceiver-core";

import {
    DataCollector
} from "@homeserver-js/device-js";

export class BLEBeacon extends DataCollector {
    private timeout_id: NodeJS.Timeout | null = null;

    constructor(
        public name: string,
        protected broker: string,
        protected topic: string,
        protected timeout: number
    ) {
        super(name);

        this.modify({
            rssi: null
        });

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
