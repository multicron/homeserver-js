
'use strict';

import logger from "debug"; const debug = logger('homeserver:mqtt:client');
import mqtt from "mqtt";

import { Section, Registry } from "@homeserver-js/core";

// This portion of the system listens for state changes sent via MQTT.  At the moment,
// these are only sent by the web interface.

export class MQTTCommandClient extends Section {
    private qos: mqtt.QoS = 0;
    private command_topic: string = "homeserver/command/#";
    private command_topic_regexp = new RegExp("homeserver/command/device/([^/+#]+)/([a-zA-Z0-9_]+)");
    private mqtt_client: mqtt.MqttClient;

    constructor(registry: Registry) {
        super(registry);

        this.mqtt_client = mqtt.connect(registry.Configuration.mqtt_command_client_broker_url);

        this.subscribe();
    }

    subscribe() {
        this.mqtt_client.subscribe(this.command_topic, { qos: this.qos }, (err) => {
            if (err) {
                debug(`Error subscribing to ${this.command_topic}: ${err}`);
            }
        });

        this.mqtt_client.on('message', (topic, message) => {
            this.receive_mqtt_msg(topic, message.toString());
        });
    }

    receive_mqtt_msg(topic: string, value: string) {
        // Topic is in the format homeserver/command/device/:deviceName/:key = value
        debug(topic, value);

        let matches = topic.match(this.command_topic_regexp);

        if (matches instanceof Array && matches.length === 3) {
            let output_value: string | number | boolean = value;

            let device_name = matches[1];
            let field = matches[2];

            // Special case for true and false

            debug(`MQTTCommandClient received device_name ${JSON.stringify(device_name)} field ${JSON.stringify(field)} value ${JSON.stringify(value)}`);

            if (value === "false") {
                output_value = false;
            }

            if (value === "true") {
                output_value = true;
            }

            // If the value can be converted to a Number and back and retains its
            // exact value, we set it as a Number in the state_delta

            if (value === Number(value).toString()) {
                debug("value is a number");
                output_value = Number(value);
            }

            // TODO: Reaching into a global in another Section !!!

            let device = this.registry.MainSection[device_name];

            if (device !== undefined) {
                device.modify({ [field]: output_value });
                this.emit('modify_device', device, field, output_value);
            }
        }

    }

}

