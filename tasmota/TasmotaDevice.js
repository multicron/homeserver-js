
'use strict';

import logger from "debug"; const debug = logger('homeserver:device:tasmota');

import {
    Device,
    LightBulb,
    Outlet,
    SmartSetup
} from "@homeserver-js/device-js";

import {
    MQTTBooleanReceiver,
    MQTTBooleanTransmitter,
    MQTTJSONReceiver,
    MQTTTopicConfTrigger,
    HTTPConfigurator,
    HTTPGetPollJSON
} from "@homeserver-js/tranceiver-core";

import {
    MQTTTasmotaColorTemperatureTransmitter,
    MQTTTasmotaColorTransmitter,
    MQTTTasmotaBrightnessTransmitter,
    MQTTTasmotaBacklogConfigurator,
    MQTTTasmotaStateBooleanReceiver,
    MQTTTasmotaStateValueReceiver,
    MQTTTasmotaStateColorReceiver,
    MQTTTasmotaBacklogTransmitter
} from "./TasmotaTranceiver.js";

export class TasmotaBulb extends LightBulb {
    constructor(name, broker, topic) {
        super(name);

        this.topic = topic;

        this.with(new MQTTBooleanTransmitter(broker, "power", `${topic}/cmnd/POWER`, "ON", "OFF"));
        this.with(new MQTTTasmotaStateBooleanReceiver(broker, "power", `${topic}/tele/STATE`, "POWER").prevent_events());
        this.with(new MQTTTasmotaStateBooleanReceiver(broker, "power", `${topic}/stat/RESULT`, "POWER").prevent_events());

        this.with(new MQTTTasmotaColorTransmitter(broker, "color", `${topic}/cmnd/Color`));
        this.with(new MQTTTasmotaStateColorReceiver(broker, "color", `${topic}/tele/STATE`, "Color").prevent_events());
        this.with(new MQTTTasmotaStateColorReceiver(broker, "color", `${topic}/stat/RESULT`, "Color").prevent_events());

        this.with(new MQTTTasmotaColorTemperatureTransmitter(broker, "color_temperature", `${topic}/cmnd/CT`));

        this.with(new MQTTTasmotaBrightnessTransmitter(broker, "dimmer", `${topic}/cmnd/Dimmer`));
        this.with(new MQTTTasmotaStateValueReceiver(broker, "dimmer", `${topic}/tele/STATE`, "Dimmer").prevent_events());
        this.with(new MQTTTasmotaStateValueReceiver(broker, "dimmer", `${topic}/stat/RESULT`, "Dimmer").prevent_events());
    }
}

export class FeitElectricBulb extends TasmotaBulb {
    constructor(name, broker, topic) {
        super(name, broker, topic);

        // This also requires this config:
        // SetOption37 54;     // Remap LEDS from BGRWC to RGBWC
        // but since that reboots the bulb (and causes it to flash a bright white),
        // it has been moved to Section/ConfigureFeitElectricBulbs

        this.with(new MQTTTasmotaBacklogConfigurator(broker, topic,
            `
            SaveData 10         // Don't save data so often
            Sleep 5;            // Don't sleep much, for faster responses
            TelePeriod 0;       // Don't send periodic TELE messages
            SetOption59 ON;     // Send TELE data after most state changes
            SetOption20 ON;     // Allow adjusting Color, CT, and Dimmer without auto power on
            LedTable 0;         // Turn off LED Gamma Correction
            PowerOnState 1;     // Light is on by default after physical power interruption
            State               // Request the current state from the device (returned in ".../stat/RESULT")
            `
        ));

        // Configure after the device connects via MQTT and sends "INFO3"
        this.with(new MQTTTopicConfTrigger(broker, `${topic}/tele/INFO3`));
    }

}

export class TasmotaBulbScheme extends LightBulb {
    constructor(name, broker, topic, scheme, speed) {
        super(name, broker, topic);

        if (speed === undefined) speed = 1;
        if (scheme == undefined) scheme = 4;

        this.turnon = new MQTTTasmotaBacklogTransmitter(broker, topic,
            `
            HSBColor 100,100,100;       // Must have Saturation up to see the colors change
            Power on;                   // Turn on the bulb
            Fade 1;                     // Fade between colors
            Speed ${speed};             // Set Speed
            Scheme ${scheme};           // Set Scheme
            `
        );

        this.turnoff = new MQTTTasmotaBacklogTransmitter(broker, topic,
            `
            Scheme 1;
            Power off;
            Color 000000ff00;
            Dimmer 100;
            Fade 0;
            Speed 1;
            `
        );

        this.on("change_power", (new_value) => {
            if (new_value) {
                this.turnon.send();
            }
            else {
                this.turnoff.send();
            }
        });
    }
}

export class TasmotaOutlet extends Outlet {
    constructor(name, broker, topic, which_outlet) {
        super(name);

        this.topic = topic;

        if (which_outlet === undefined) {
            which_outlet = "";
        }

        // Send ON and OFF commands when the state field "power" changes
        this.with(new MQTTBooleanTransmitter(broker, "power", `${topic}/cmnd/POWER${which_outlet}`, "ON", "OFF"));

        // Receive updates to the state field "power" but don't emit events for them
        this.with(new MQTTBooleanReceiver(broker, "power", `${topic}/stat/POWER${which_outlet}`).prevent_events());

        // Receive updates to the stat result field "POWER" but don't emit events for them
        this.with(new MQTTTasmotaStateBooleanReceiver(broker, "power", `${topic}/stat/RESULT`, `POWER${which_outlet}`).prevent_events());

        this.with(new MQTTTasmotaBacklogConfigurator(broker, topic,
            `
            SaveData 10         // Don't save data so often
            Sleep 5;            // Don't sleep much, for faster responses
            TelePeriod 0;       // Don't send periodic TELE messages
            State               // Request the current state from the device (returned in ".../stat/RESULT")
            `
        ));

        // Configure after the device connects via MQTT and sends "INFO3"
        this.with(new MQTTTopicConfTrigger(broker, `${topic}/tele/INFO3`));
    }
}

export class TasmotaDetachedSwitch extends Outlet {
    constructor(name, broker, topic) {
        super(name);

        this.topic = topic;

        // Set the state field "power" when the button is pressed.  The device actually
        // sends the value "TOGGLE" which fires the "set_power" event and sets {power: true}

        // Despite us asking nicely with the ButtonTopic and SwitchTopic commands, Tasmota
        // appends "cmnd/POWER" to the topic transmitted when the button is pressed.

        this.with(new MQTTBooleanReceiver(broker, "power", `${topic}/input/cmnd/POWER`));

        this.with(new MQTTTasmotaBacklogConfigurator(broker, topic,
            `
            SaveData 10                         // Don't save data so often
            Sleep 5;                            // Don't sleep much, for faster responses
            TelePeriod 0;                       // Don't send periodic TELE messages
            SetOption13 1;                      // Disable Multi-press detection
            SwitchMode 0;                       // Send the command when the button is pressed
            ButtonTopic %hostname%/input;       // Set the topic to send for button press
            SwitchTopic %hostname%/input;       // Set the topic to send for switch change 
            `
        ));

        // Configure after the device connects via MQTT and sends "INFO3"
        this.with(new MQTTTopicConfTrigger(broker, `${topic}/tele/INFO3`));
    }
}

export class TasmotaMultiButton extends Outlet {
    constructor(name, broker, topic) {
        super(name);

        this.topic = topic;

        this.with(new MQTTTasmotaBacklogConfigurator(broker, topic,
            `
            // This "code" is sent to the Tasmota Device encapsulated in
            // a "Backlog" command and with these comments stripped off.
            
            SaveData 10             // Don't save data so often
            Sleep 5;                // Don't sleep much, for faster responses
            TelePeriod 0;           // Don't send periodic TELE messages
            SetOption13 1;          // Disable Multi-press detection
            LedPower 0;             // Turn Off the Status LED
            SetOption31 1;          // Don't Blink the Status LED for WiFi or MQTT
            SwitchMode 0;           // Default value
            ButtonTopic 0;          // Default value; if set the rule below won't work right
            SwitchTopic 0;          // Default value; if set the rule below won't work right
            Mem1 ${topic}/input;    // Save a lot of Rule storage this way (Rule must be < 512 Bytes)

            Rule1           // Define a rule to respond to button presses
            
                ON Button1#State DO Publish %Mem1%/1 %value% ENDON
                ON Button2#State DO Publish %Mem1%/2 %value% ENDON
                ON Button3#State DO Publish %Mem1%/3 %value% ENDON
                ON Button4#State DO Publish %Mem1%/4 %value% ENDON
                ON Button5#State DO Publish %Mem1%/5 %value% ENDON
                ON Button6#State DO Publish %Mem1%/6 %value% ENDON
                ON Button7#State DO Publish %Mem1%/7 %value% ENDON
                ON Button8#State DO Publish %Mem1%/8 %value% ENDON
    
            ;               // End of Rule definition
            
            Rule1 1;        // Turn on the Rule
            `
        ));

        // Configure after the device connects via MQTT and sends "INFO3"
        this.with(new MQTTTopicConfTrigger(broker, `${topic}/tele/INFO3`));
    }
}

export class TasmotaMultiSwitch extends Outlet {
    constructor(name, broker, topic, switchmode) {
        super(name);

        if (switchmode === undefined) {
            switchmode = 3;
        }

        this.with(new MQTTTasmotaBacklogConfigurator(broker, topic,
            `
            // This "code" is sent to the Tasmota Device encapsulated in
            // a "Backlog" command and with these comments stripped off.
            
            SaveData 10                     // Don't save data so often
            Sleep 5;                        // Don't sleep much, for faster responses
            TelePeriod 0;                   // Don't send periodic TELE messages
            SetOption13 1;                  // Disable Multi-press detection
            LedPower 0;                     // Turn Off the Status LED
            SetOption31 1;                  // Don't Blink the Status LED for WiFi or MQTT
            SwitchMode1 ${switchmode};      // Set the SwitchMode for all Switches
            SwitchMode2 ${switchmode};      // Set the SwitchMode for all Switches
            SwitchMode3 ${switchmode};      // Set the SwitchMode for all Switches
            SwitchMode4 ${switchmode};      // Set the SwitchMode for all Switches
            SwitchMode5 ${switchmode};      // Set the SwitchMode for all Switches
            SwitchMode6 ${switchmode};      // Set the SwitchMode for all Switches
            SwitchMode7 ${switchmode};      // Set the SwitchMode for all Switches
            SwitchMode8 ${switchmode};      // Set the SwitchMode for all Switches
            ButtonTopic 0;                  // Default value; if set the rule below won't work right
            SwitchTopic 0;                  // Default value; if set the rule below won't work right
            Mem1 ${topic}/input;            // Save a lot of Rule storage this way (Rule must be < 512 Bytes

            Rule1           // Define a rule to respond to button presses
            
                ON Switch1#State DO Publish %Mem1%/1 %value% ENDON
                ON Switch2#State DO Publish %Mem1%/2 %value% ENDON
                ON Switch3#State DO Publish %Mem1%/3 %value% ENDON
                ON Switch4#State DO Publish %Mem1%/4 %value% ENDON
                ON Switch5#State DO Publish %Mem1%/5 %value% ENDON
                ON Switch6#State DO Publish %Mem1%/6 %value% ENDON
                ON Switch7#State DO Publish %Mem1%/7 %value% ENDON
                ON Switch8#State DO Publish %Mem1%/8 %value% ENDON
    
            ;               // End of Rule definition
            
            Rule1 1;        // Turn on the Rule
            `
        ));

        // Configure after the device connects via MQTT and sends "INFO3"
        this.with(new MQTTTopicConfTrigger(broker, `${topic}/tele/INFO3`));
    }
}

export class TasmotaPowerMeter extends Device {
    constructor(name, broker, topic, field, resolution, decimals) {
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
            let watts = 0;

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

// This SmartSetup encapsulates an object that could otherwise be created like this:

// new SmartSetup("Change Tasmota LED Mapping", 'data')
// .test((data) => data.SetOption37 === 54)
// .with(new HTTPConfigurator("http://tasmota1-247514/settings?mqtt_update_period=0"))
// .with(new HTTPGetPollJSON({ url: "http://tasmota1-247514/settings" }, 0, 'data').poll())

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

// new TasmotaHTTPSmartSetup("Change Tasmota LED Mapping", "tasmota-host-name-or-ip", "SetOption37", 54,
//     (data) => data.SetOption37 === 54);


export class TasmotaHTTPSmartSetup extends SmartSetup {
    constructor(name, hostname, setting, value, test_fn) {
        super(name, 'data');

        this.test(test_fn);
        this.with(new HTTPConfigurator(`http://${hostname}/cm?cmnd=${setting}%20${encodeURIComponent(value)}`));
        this.with(new HTTPGetPollJSON({ url: `http://${hostname}/cm?cmnd=${setting}` }, 0, 'data').poll());
    }
}
