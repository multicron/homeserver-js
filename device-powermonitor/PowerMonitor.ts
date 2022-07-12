
'use strict';

import logger from "debug"; const debug = logger('homeserver:powermonitor');

import { Device } from "@homeserver-js/device-js";

import {
    Scene
} from "@homeserver-js/device-js";

import {
    MQTTJSONReceiver,
} from "@homeserver-js/tranceiver-core";

import {
    MQTTTasmotaBacklogConfigurator,
    TasmotaDetachedSwitch
} from "@homeserver-js/tasmota";

export class TasmotaPowerMeter extends Device {
    last_ms: number;
    current_ms: number;
    interval_ms: number;
    resolution: number;
    decimals: number;

    constructor(name, broker, topic, field, resolution?, decimals?) {
        super(name);

        this.modify({
            [field]: 0
        });

        this.last_ms = Date.now();
        this.current_ms = Date.now();
        this.interval_ms = 0;
        this.resolution = resolution || 1;
        this.decimals = decimals || 0;

        this.with(new MQTTJSONReceiver(broker, "timepacket", topic));

        this.on('change_timepacket', (new_value) => {
            this.current_ms = Date.parse(new_value.Time);
            this.interval_ms = this.current_ms - this.last_ms;


            // The meter flashes once per Wh used, or 3600 Watts for once per second
            // Some meters only report with a minimum granularity in ms (which I call "resolution")

            let interval_rounded = Math.floor((this.interval_ms / this.resolution) + 0.5) * resolution;

            debug(new_value.Time, this.last_ms, this.current_ms, this.interval_ms, interval_rounded);

            let interval_sec = (interval_rounded / 1000);
            let watts = "0";

            if (interval_sec > 0) {
                watts = (3600 / interval_sec).toFixed(this.decimals);
            }

            this.last_ms = this.current_ms;

            this.modify({
                [field]: watts
            });

            debug(`Power usage in Watts: ${watts}`);
        })
    }
}

export class TasmotaPowerConsumptionScene extends Scene {
    sensor: Device;
    constructor(name, broker, topic, high_watts) {
        super(name);

        this.modify({ watts: 0 });

        this.on('change_watts', (new_value, old_value) => {
            if (new_value > high_watts && old_value <= high_watts) {
                this.activate();
            }
        })

        // Define a device which is a Tasmota smart outlet used only to measure
        // power consumption.
        this.sensor = new TasmotaDetachedSwitch("", broker, topic)
            .with(new MQTTTasmotaBacklogConfigurator(broker, topic,
                `
                POWER ON;           // Device is initially on
                PowerOnState 4;     // Device is on at boot and can't be turned off
                PowerDelta 102;     // A two-watt change is enough to trigger a SENSOR report
                `))
            .with(new MQTTJSONReceiver(broker, "sensors", "tasmotas/front-door-power/tele/SENSOR"))
            .on('set_sensors', (new_value) => {
                debug("sensors", new_value);
                try {
                    // Note that "this" is the TasmotaPowerMonitor object, not the TasmotaDetachedSwitch
                    this.modify({ watts: new_value.ENERGY.Power });
                }
                catch (e) {
                    debug("Bad data from tasmota SENSOR report");
                }
            });

    }
}
