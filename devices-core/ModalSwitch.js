
'use strict';

import logger from "debug"; const debug = logger('otto:device:modalswitch');

import { Device } from "@homeserver-js/device-js";

export class ModalSwitch extends Device {
    constructor(name, max_mode) {
        super(name);
        this.modify({
            mode: null,
            next_mode: true,
            max_mode: max_mode
        });

        this.on('set_next_mode', new_value => this.do_next_mode());
    }

    do_next_mode() {
        debug("Switching mode for device", this.name);

        let mode = this.state().mode;

        if (mode === null) {
            mode = 0;
        }
        else {
            mode++;
        }

        if (mode > this.state().max_mode) {
            mode = 0;
        }

        this.modify({ mode: mode });
    }
}

export class ModalSwitchWithTimeout extends ModalSwitch {
    constructor(name, max_mode, timeout) {
        super(name, max_mode);
        this.modify({
            timeout: timeout
        });
        this.current_callback = null;
        this.mode_timed_out = false;
    }

    // Replace this method at runtime to tell do_next_mode whether to skip the "all off" mode (0)
    // after the timeout.

    check_everything_off() {
        return false;
    }

    do_next_mode() {
        debug("Switching mode for device", this.name);

        let mode = this.state().mode;

        // The timeout feature sets mode_timed_out, meaning the next
        // call to do_next_mode should set the mode to 0 (which is usually "off").

        if (this.mode_timed_out) {
            if (this.check_everything_off()) {
                mode = 1;
            }
            else {
                mode = 0;
            }
        }
        else {
            mode++;
        }

        // Wrap the mode number at max_mode

        if (mode > this.state().max_mode) {
            mode = 0;
        }

        // Clear pending timeout, if any

        this.clear_timeout();

        // Unless we're already going into mode 0, we set up a timeout so that
        // the next call to do_next_mode will go to mode 0.

        if (mode !== 0) {
            this.setup_timeout();
        }

        this.modify({ mode: mode });
    }

    setup_timeout() {
        this.current_callback = setTimeout(() => this.timeout(), this.state().timeout).unref();
    }

    clear_timeout() {
        if (this.current_callback) {
            clearTimeout(this.current_callback);
        }

        this.current_callback = null;
        this.mode_timed_out = false;
    }

    timeout() {
        debug("Mode timed out for device", this.name);

        this.clear_timeout();

        this.mode_timed_out = true;
    }
}

