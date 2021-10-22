
'use strict';

import logger from "debug"; const debug = logger('otto:state');
import mqtt from "mqtt";

import { Section } from "@homeserver-js/core";

export class MQTTStateRequestClient extends Section {
    constructor(registry) {
        super(registry);

        this.qos = 0;
        this.mqtt_client = mqtt.connect("mqtt://192.168.5.100/");
        this.command_topic = "houseserver/request_state_store/#";

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

    receive_mqtt_msg(topic, value) {
        debug("MQTTStateRequestClient got", topic, value);

        this.registry.StatePersistence.stateholder.publish_state_store();
    }

}

