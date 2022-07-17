
'use strict';

import logger from "debug"; const debug = logger('homeserver:alarm');


import { Device } from "@homeserver-js/device-js";

import { Flasher } from "@homeserver-js/device-js";

export class Alarm extends Device {
    protected flasher: Flasher;
    private timeout_id: NodeJS.Timeout | null = null;

    constructor(
        public name: string,
        protected trigger: Device,
        protected siren: Device,
        protected lights: Device,
        protected warning_time: number,
        protected warning_flash_rate: number,
        protected siren_time: number,
        protected siren_flash_rate: number
    ) {
        super(name);

        // The device that sets off the alarm when its power turns on

        this.trigger = trigger;

        // The device that makes a lot of noise
        this.siren = siren;

        // The device that we flash on and off
        this.lights = lights;

        // The device that actually flashes them
        this.flasher = new Flasher("Alarm Flasher", this.lights);

        // The rate to flash the lights during warning
        this.warning_flash_rate = warning_flash_rate;

        // How long we flash lights without siren
        this.warning_time = warning_time;

        // The rate to flash the lights during warning
        this.siren_flash_rate = siren_flash_rate;

        // How long the siren goes before we reset the whole thing
        this.siren_time = siren_time;

        this.siren.power(false);

        // Turning this on arms the alarm; turning it off disables it.

        this.on("change_power", (power) => {
            clearInterval(this.timeout_id || undefined);

            if (power) {
                this.set_mode("armed");
            }
            else {
                this.set_mode("disabled");
            }
        });

        // Mode dispatcher runs when the "mode" state field changes

        this.on('change_mode', (new_mode, old_mode) => {
            switch (old_mode) {
                case "warn":
                    this.warn_stop();
                    break;
                case "siren":
                    this.siren_stop();
                    break;
                case "armed":
                    this.armed_stop();
                    break;
                case "disabled":
                    this.disabled_stop();
                    break;
            }
            switch (new_mode) {
                case "warn":
                    this.warn_start();
                    break;
                case "siren":
                    this.siren_start();
                    break;
                case "armed":
                    this.armed_start();
                    break;
                case "disabled":
                    this.disabled_start();
                    break;
            }
        });

        // If the trigger turns on and we are in "armed" mode, 
        // we go into "warn" mode.

        this.trigger.on('set_power', (new_value) => {
            if (new_value && this.state().mode === "armed") {
                this.set_mode("warn");
            }
        });
    }

    set_mode(mode) {
        this.modify({ mode: mode });
    }

    next_mode(mode, timeout) {
        if (this.timeout_id) {
            clearInterval(this.timeout_id);
        }

        debug("Next mode is", mode, "in", timeout, "milliseconds");

        this.timeout_id = setTimeout(() => {
            debug("Alarm Entering mode", mode);
            this.set_mode(mode);
        }, timeout).unref();

    }

    warn_start() {
        this.flasher.start(this.warning_flash_rate, 1);
        this.next_mode("siren", this.warning_time);
    }

    warn_stop() {
        this.flasher.stop(true);
    }

    siren_start() {
        this.flasher.start(this.siren_flash_rate, 1);
        this.siren.power(true);
        this.next_mode("armed", this.siren_time);
    }

    siren_stop() {
        this.flasher.stop(true);
        this.siren.power(false);
    }

    armed_start() {
        this.flasher.stop(true);
        this.siren.power(false);
    }

    armed_stop() {
    }

    disabled_start() {
        this.flasher.stop(true);
        this.siren.power(false);
    }

    disabled_stop() {
    }

}

