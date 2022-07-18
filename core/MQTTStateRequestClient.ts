
'use strict';

// import logger from "debug"; const debug = logger('homeserver:state');
import mqtt from "mqtt";
import { QoS } from "mqtt-packet";


import { Section } from "./Section";
import { Registry } from "./Registry";

export class MQTTStateRequestClient extends Section {
    private qos: QoS;
    private mqtt_client;
    private command_topic;

    constructor(registry: Registry) {
        super(registry);

        this.qos = 0;
        this.mqtt_client = mqtt.connect(registry.Configuration.mqtt_broker_local_url);
        this.command_topic = "houseserver/request_state_store/#";

        this.subscribe();
    }

    subscribe() {
        this.mqtt_client.subscribe(this.command_topic, { qos: this.qos }, (err) => {
            if (err) {
                // debug(`Error subscribing to ${this.command_topic}: ${err}`);
            }
        });

        this.mqtt_client.on('message', (topic, message) => {
            this.receive_mqtt_msg(topic, message.toString());
        });
    }

    receive_mqtt_msg(topic: string, value: string | number) {
        // debug("MQTTStateRequestClient got", topic, value);

        this.registry.StatePersistence.stateholder.publish_state_store();
    }

}

