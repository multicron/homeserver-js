"use strict";

import logger from "debug";
const debug = logger("homeserver:powermonitor");

import { Device } from "@homeserver-js/device-js";

import { Scene } from "@homeserver-js/device-js";

import { MQTTJSONReceiver } from "@homeserver-js/transceiver-core";

import {
  MQTTTasmotaBacklogConfigurator,
  TasmotaDetachedSwitch,
} from "@homeserver-js/tasmota";

// This device calculates power usage in Watts based on the time between
// "timepacket" MQTT messages sent from a ESP8266 (or ESP32) with an IR receiver.

export class TasmotaPowerMeter extends Device {
  last_ms: number;
  current_ms: number;
  interval_ms: number;

  constructor(
    name: string,
    broker: string,
    topic: string,
    field: string,
    protected resolution: number = 1,
    protected decimals: number = 0,
  ) {
    super(name);

    this.modify({
      [field]: 0,
    });

    this.last_ms = Date.now();
    this.current_ms = Date.now();
    this.interval_ms = 0;

    this.with(new MQTTJSONReceiver(broker, "timepacket", topic));

    this.on("change_timepacket", (new_value) => {
      this.current_ms = Date.parse(new_value.Time);
      this.interval_ms = this.current_ms - this.last_ms;

      // The meter flashes once per Wh used, or 3600 Watts for once per second
      // Some meters only report with a minimum granularity in ms (which I call "resolution")

      let interval_rounded =
        Math.floor(this.interval_ms / this.resolution + 0.5) * resolution;

      debug(
        new_value.Time,
        this.last_ms,
        this.current_ms,
        this.interval_ms,
        interval_rounded,
      );

      let interval_sec = interval_rounded / 1000;
      let watts = "0";

      if (interval_sec > 0) {
        watts = (3600 / interval_sec).toFixed(this.decimals);
      }

      this.last_ms = this.current_ms;

      this.modify({
        [field]: watts,
      });

      debug(`Power usage in Watts: ${watts}`);
    });
  }
}
