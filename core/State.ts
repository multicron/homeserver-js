
'use strict';

import redux from "redux";
import { Configuration } from "./Configuration.js";

import { DeviceState } from "@homeserver-js/device-js";

import EventEmitter from "events";

import logger from "debug"; const debug = logger('homeserver:state');

import mqtt from "mqtt";
import uuid from "uuid";
import fs from "fs";


// The global Redux store is a singleton, but we can instantiate as
// many StateHolder objects as we want.  They all reference the one
// global_store.  They also all communicate on the same global_mqtt_client.

// How expensive is an mqtt client?  I'm thinking perhaps each switch in the UI
// could have a separate one, which would simplify this code a bit.  Perhaps it
// was a premature optimization to have it be shared among the entire web app?

let global_store: any;
let global_mqtt_client: mqtt.MqttClient | undefined;
let global_mqtt_client_id: string | undefined;
let global_mqtt_is_subscribed_to_state_store = false;

const initial_state = {};

type Action = {
    timestamp: number;
    client_id: string;
    type: string;
    payload: any;
}

export const ADD_DEVICE = "ADD_DEVICE";
export const MODIFY_DEVICE = "MODIFY_DEVICE";
export const REPLACE_STORE = "REPLACE_STORE";

function rootReducer(state: any, action: Action) {
    if (state === undefined) {
        return initial_state;
    }

    if (action.type === ADD_DEVICE) {
        let payload = action.payload;
        return Object.assign({}, state, { [payload.device_name]: payload.device_state });
    }

    if (action.type === MODIFY_DEVICE) {
        let payload = action.payload;

        let current_device_state = state[payload.device_name];
        let new_device_state = Object.assign({}, current_device_state, payload.device_state);

        return Object.assign({}, state, { [payload.device_name]: new_device_state });
    }

    if (action.type === REPLACE_STORE) {
        let payload = action.payload;
        let parsed;

        try {
            parsed = JSON.parse(payload);
            return parsed;
        }
        catch (e) {
            debug("Can't parse JSON", e);
        }
    }

    return state;
}

// TODO: Topic should include name.

export class StateHolder extends EventEmitter {
    store: any;
    qos: number;
    mqtt_client_id: string;
    mqtt_client: any;
    name: string;
    state_store_topic: string;
    request_state_store_topic: string;
    dispatch_topic: string;
    uuid: string;
    server_time_offset: number;

    constructor(name: string) {
        super();

        const configuration = new Configuration();

        this.setMaxListeners(1000);

        if (global_store === undefined) {
            global_store = redux.createStore(rootReducer);
        }

        this.store = global_store;
        this.qos = 0;

        if (global_mqtt_client_id === undefined) {
            global_mqtt_client_id = "StateHolder_" + uuid.v4();
        }

        this.mqtt_client_id = global_mqtt_client_id;

        if (global_mqtt_client === undefined) {
            debug(`Global MQTT client connecting to ${configuration.global_mqtt_client_broker_url}`);
            global_mqtt_client = mqtt.connect(
                configuration.global_mqtt_client_broker_url,
                {
                    clientId: this.mqtt_client_id,
                    username: configuration.mqtt_broker_login,
                    password: configuration.mqtt_broker_password
                });

            global_mqtt_client.on('connect', () => {
                debug(`StateHolder global MQTT client connected`);
            });


            global_mqtt_client.setMaxListeners(1000);
        }

        this.mqtt_client = global_mqtt_client;

        this.name = name;
        this.state_store_topic = "homeserver/state";
        this.request_state_store_topic = "homeserver/request_state_store";
        this.dispatch_topic = "homeserver/dispatch";
        this.uuid = uuid.v4();
        this.server_time_offset = 0;
    }

    add(initial_state = {}) {
        debug("Adding", this.name);

        let action = {
            type: ADD_DEVICE,
            timestamp: Date.now(),
            client_id: this.mqtt_client_id,
            payload: {
                device_name: this.name,
                device_state: initial_state
            }
        };

        this.store.dispatch(action);

        return action;
    }

    modify(state_change: DeviceState) {
        debug("Modifying", this.name);

        let action = {
            type: MODIFY_DEVICE,
            timestamp: Date.now(),
            client_id: this.mqtt_client_id,
            payload: {
                device_name: this.name,
                device_state: state_change
            }
        };

        debug("Action is", action);

        this.store.dispatch(action);

        return action;
    }

    replace(new_state: string) {
        let action = {
            timestamp: Date.now(),
            type: REPLACE_STORE,
            client_id: this.mqtt_client_id,
            payload: new_state
        };

        this.store.dispatch(action);

        return action;
    }

    get() {
        let full_state = this.store.getState();

        return Object.assign({}, full_state[this.name] || {});
    }

    get_state_store() {
        return this.store.getState();
    }
}

export class StatePublisher extends StateHolder {
    static is_private_name(name: string) {
        return (name.substr(0, 1) === "_");
    }

    constructor(name: string) {
        super(name);
        debug("Creating StatePublisher");
    }

    add(initial_state: DeviceState = {}) {
        let action = super.add(initial_state);

        if (!StatePublisher.is_private_name(action.payload.device_name)) {
            this.publish_action(action);
        }

        return action;
    }

    modify(state_change: DeviceState) {
        let action = super.modify(state_change);

        if (!StatePublisher.is_private_name(action.payload.device_name)) {
            this.publish_action(action);
        }

        return action;
    }

    publish_action(action: Action) {
        let options = {
            qos: 0,
            retain: false,
            dup: false
        };

        let value = JSON.stringify(action);
        debug(`Publishing ${this.dispatch_topic} ${value}`);
        this.mqtt_client.publish(this.dispatch_topic, value, options, () => {
            debug(`StatePublisher sent ${value} to ${this.dispatch_topic}`);
        });
    }

    filter_state(state: DeviceState) {
        let filtered_state: DeviceState = {};

        let filtered_keys = Object.keys(state).filter((key) => !StatePublisher.is_private_name(key));

        filtered_keys.forEach((item) => { filtered_state[item] = state[item] });

        return filtered_state;
    }

    publish_state_store() {
        let options = {
            qos: 0,
            retain: true,
            dup: false
        };

        let filtered_state = this.filter_state(this.get_state_store());

        let json_filtered_state = JSON.stringify(filtered_state);

        this.mqtt_client.publish(this.state_store_topic, json_filtered_state, options, () => {
            debug(`Sent filtered state store to ${this.state_store_topic}`);
        });
    }

    save_state_store(filename: fs.PathOrFileDescriptor) {
        let value = JSON.stringify(this.get_state_store());
        fs.writeFile(filename, value, (err) => {
            if (err) {
                debug("Error writing state store: ", err);
            }
        });
    }

    load_state_store(filename: fs.PathOrFileDescriptor) {
        try {
            // Read the state store from the file

            let buffer = fs.readFileSync(filename);
            debug("Read state store", buffer.toString());

            // Parse it into an object
            let old_state = JSON.parse(buffer.toString());

            // Get the current state store
            let new_state = this.get_state_store();

            // Copy some fields from the saved state to the new state

            ['power', 'dimmer', 'color'].forEach((field) => {
                Object.keys(new_state).forEach((key) => {
                    debug(key, field, "OLD", old_state?.[key]?.[field], "NEW", new_state?.[key]?.[field]);
                    if (old_state?.[key]?.[field] !== undefined) {
                        new_state[key][field] = old_state[key][field];
                    }
                });
            });

            // Stringify it (because for some reason replace expects JSON?
            let new_state_json = JSON.stringify(new_state)
            debug("Replacing state with", new_state_json);

            // Replace it!
            this.replace(new_state_json);
            debug("State loaded from file");
        }
        catch (err) {
            debug("No valid state in file: ", err);
        }
    }

    periodically_publish_state_store(interval: number) {
        setInterval(this.publish_state_store.bind(this), interval).unref();
    }

    periodically_save_state_store(filename: fs.PathOrFileDescriptor, interval: number) {
        if (interval === undefined) interval = 10000;
        setInterval(() => this.save_state_store(filename), interval).unref();
    }
}
