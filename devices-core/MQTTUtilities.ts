
'use strict';

import logger from "debug"; const debug = logger('homeserver:device:mqttutilities');

import { Device, DeviceState } from "@homeserver-js/device-js";

import { Receiver } from "@homeserver-js/transceiver-js";

import { parse_json } from "@homeserver-js/utils";

export class MQTTTopicList extends Device {
    protected topics: { [index: string]: Date } = {};

    constructor(name: string) {
        super(name);
    }

    receive(receiver: Receiver, state: DeviceState) {
        this.topics[state.topic] = new Date();
    }
}

export class MQTTSubscribersList extends Device {
    protected subscribers: { [index: string]: string[] } = {};
    constructor(name: string) {
        super(name);
    }

    receive(receiver: Receiver, state: DeviceState) {
        // This is a little confusing because the MQTT Message we're receiving is JSON

        // normally the passed state is {topic: <whatever>, message: <whatever>}
        // from all MQTTReceiver subclasses (by convention).  This is still true, but in this case
        // state.message contains a JSON string of the form 
        // { "clientId": "client-name", "topic": "topic/they/subscribed/to" }
        // which we parse into the variable subs_msg in this method

        let subs_msg = parse_json(state.message);
        if (subs_msg && !this.subscribers[subs_msg.clientId]) {
            this.subscribers[subs_msg.clientId] = [];
        }

        this.subscribers[subs_msg.clientId].push(subs_msg.topic);
    }
}

