
'use strict';

import {
    DataCollector,
    Switch

} from "@homeserver-js/device-js";

import {
    HTTPGetPollJSON
} from "@homeserver-js/tranceiver-core";

export class LaundryViewCollector extends DataCollector {
    constructor(name, url, period) {
        super(name);
        this.with(new HTTPGetPollJSON({ url: url }, period, 'status'));
    }
}

export class LaundryViewAppliance extends Switch {
    constructor(name, index) {
        super(name);
        this.index = index;
    }

    update_status(new_status) {
        let appliance_state;
        let new_state = {};

        if (!new_status) return;

        if (new_status.objects) {
            if (new_status.objects[this.index]) {
                appliance_state = new_status.objects[this.index].time_left_lite;
            }
        }

        new_state.available = appliance_state;
        new_state.power = !(appliance_state === "Available" || appliance_state === "Ext. Cycle" || appliance_state === "Idle");

        this.modify(new_state);
    }
}

