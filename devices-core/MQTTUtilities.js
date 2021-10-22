
'use strict';

import logger from "debug"; const debug = logger('homeserver:device:mqttutilities');

import { Device } from "@homeserver-js/device-js";

export class MQTTTopicList extends Device {
    constructor(name) {
        super(name);
        this.topics = {};
    }

    receive(receiver, state) {
        this.topics[state.topic] = new Date();
    }
}

export class MQTTSubscribersList extends Device {
    constructor(name) {
        super(name);
        this.subscribers = {};
    }

    receive(receiver, state) {
        // This is a little confusing because the MQTT Message we're receiving is JSON

        // normally the passed state is {topic: <whatever>, message: <whatever>}
        // from all MQTTReceiver subclasses (by convention).  This is still true, but in this case
        // state.message contains a JSON string of the form 
        // { "clientId": "client-name", "topic": "topic/they/subscribed/to" }
        // which we parse into the variable subs_msg in this method

        let subs_msg = this.parse_json(state.message);
        if (subs_msg && !this.subscribers[subs_msg.clientId]) {
            this.subscribers[subs_msg.clientId] = [];
        }

        this.subscribers[subs_msg.clientId].push(subs_msg.topic);
    }
}

