
'use strict';


import {
    SmartSetup
} from "@homeserver-js/device-js";

import {
    HTTPConfigurator,
    HTTPGetPollJSON
} from "@homeserver-js/tranceiver-core";

// This Configurator encapsulates an object that could otherwise be created like this:

// new SmartSetup("Initialize Shelly", 'data')
// .test((data) => data.mqtt.update_period === 0)
// .with(new HTTPConfigurator("http://shelly1-247514/settings?mqtt_update_period=0"))
// .with(new HTTPGetPollJSON({ url: "http://shelly1-247514/settings" }, 0, 'data').poll())

// What this class (and the equivalent code above) does:

// 1. Creates a "SmartSetup" device, which runs configure() on itself when its state field 'data' changes,
// but only if the test function also returns false.
// 2. Adds the test function that checks the current value in the state field 'data'
// 3. Adds the HTTPConfigurator that will be run when configure() is called
// 4. Adds the HTTPGetPollJSON Receiver that will query the device and retrieve its configuration 
// 5. Runs the HTTPGetPollJSON poll() method once to query the device and fill in the state field 'data' with the result
// 6. The .on('change_data') handler in SmartSetup only fires if the test function returns true
// 7. If the .on('change_data') handler does fire, it triggers the SmartSetup to call configure(),
// which runs all the Configurators attached to this Device.

// Usage:

// new ShellyHTTPSmartSetup("Initialize Shelly", "shelly1-247514", "mqtt_update_period", 0,
//     (data) => data.mqtt.update_period === 0);


export class ShellyHTTPSmartSetup extends SmartSetup {
    constructor(name, hostname, setting, value, test_fn) {
        super(name, 'data');

        this.test(test_fn);
        this.with(new HTTPConfigurator(`http://${hostname}/settings?${setting}=${encodeURIComponent(value)}`));
        this.with(new HTTPGetPollJSON({ url: `http://${hostname}/settings` }, 0, 'data').poll());
    }
}
