
'use strict';

import dbg from "debug"; const debug = dbg('ble2mqtt');
import mqtt from "mqtt";
import util from "util";
import uuid from "uuid";
import noble from '@abandonware/noble';


/**
 * A Bluetooth Low-Energy (BLE) advertisement to MQTT gateway.  This class listens for
 * advertisements using @abandonware/noble and forwards them to an MQTT broker.
 *
 * @export
 * @class BLE2MQTT
 */
export class BLE2MQTT {

    constructor(config) {

        this.qos = 0;
        this.config = config;
        this.last_seen = {};
        this.highest_rssi = {};

        this.mqtt_client = mqtt.connect(this.config.ble2mqtt_broker_url);

        this.subscribe();

        this.noble = noble;

        this.noble.on('stateChange', (state) => {
            if (state === 'poweredOn') {
                this.noble.startScanning([], true);
            }
        });

        this.noble.on('discover', (peripheral) => {
            this.receive_discovery(peripheral);
        });

        this.noble.on('warning', (message) => {
            debug("warning", util.inspect(message));
        });
    }

    iBeacon_info(manufacturerData) {
        let output = {};

        if (manufacturerData instanceof Buffer && manufacturerData.length >= 25) {
            let hex = manufacturerData.toString('hex');
            if (hex.substr(0, 8) === "4c000215") { // Apple iBeacon header
                output.uuid = `${hex.substr(8, 8)}-${hex.substr(16, 4)}-${hex.substr(20, 4)}-${hex.substr(24, 4)}-${hex.substr(28, 12)}`;
                output.major = hex.substr(40, 4);
                output.minor = hex.substr(44, 4);
                output.tx_power = hex.substr(48, 2);
                return output;
            }
        }
        return undefined;
    }

    get_ibeacon_id(discovery) {
        let id;

        // If its an iBeacon, we use uuid-major-minor as the beacon_id

        let iBeacon = this.iBeacon_info(discovery.manufacturerData);

        if (iBeacon) {
            id = `${iBeacon.uuid}-${iBeacon.major}-${iBeacon.minor}`;
        }

        return id;
    }

    allowed_by_lists(topics) {
        // Check if it is blacklisted or whitelisted

        // Whitelist takes precedence over blacklist

        if (this.config.whitelist.length > 0) {
            if (topics.some(r => this.config.whitelist.includes(r))) {
                debug(`${topics} is whitelisted`);
                return true;
            }
        }

        if (this.config.blacklist.length > 0) {
            if (topics.some(r => this.config.blacklist.includes(r))) {
                debug(`${topics} is blacklisted`);
                return false;
            }
        }

        return true;
    }

    sanitize(text) {
        return text.replace(/[^A-Za-z0-9_-]/g, '_');
    }

    get_topics(discovery) {

        // Get a list of all the topics that describe this ble beacon

        let topics = [`mac/${discovery.address}`];

        if (discovery.ibeacon_id !== undefined) {
            topics.push(`ibeacon/${discovery.ibeacon_id}`);
        }

        if (discovery.manufacturerData instanceof Buffer) {
            topics.push(`manufacturer/${discovery.manufacturerData.toString('hex')}`);
        }

        if (discovery.localName !== undefined) {
            topics.push(`local_name/${this.sanitize(discovery.localName)}`);
        }

        // After we've come up with all the topics that fit, we
        // check for an alias and add it too.  Only one alias
        // match per beacon!

        topics.some((item) => {
            if (this.config.aliases[item] !== undefined) {

                // Add the alias to the discovery packet (messy, I know!)
                discovery.alias = this.config.aliases[item];

                topics.push(discovery.alias);

                return true;
            }
        });

        return topics;
    }

    /**
     * Get a discovery event from noble.  Extract information and call publish_discovery() if 
     * the signal is strong enough.
     *
     * @param {*} peripheral
     * @memberof BLE2MQTT
     */

    receive_discovery(peripheral) {
        let timestamp = new Date();
        let discovery = {};
        let json_payload = "";

        debug(`Got ble packet ${peripheral.address} at rssi ${peripheral.rssi}`);

        discovery.timestamp = timestamp.toISOString();
        discovery.epoch = timestamp.getTime();

        try {
            ['id', 'uuid']
                .forEach((item) => discovery["noble_" + item] = peripheral[item]);

            ['address', 'addressType', 'connectable', 'rssi']
                .forEach((item) => discovery[item] = peripheral[item]);

            ['localName', 'txPowerLevel', 'serviceUuids', 'serviceData', 'manufacturerData']
                .forEach((item) => discovery[item] = peripheral.advertisement[item]);

        }
        catch (error) {
            debug(`Couldn't receive discovery: ${error}`);
        }

        discovery.ibeacon_id = this.get_ibeacon_id(discovery);

        // Remove the .toJSON() method from the JS Buffers in the structure
        BLE2MQTT.convert_buffers(discovery);

        // Generate a unique identifier for the packet (not for the BLE device)

        discovery.beacon_uuid = uuid.v4();

        let topics = this.get_topics(discovery);

        // discovery.alias is set by get_topics

        json_payload = JSON.stringify(discovery, BLE2MQTT.stringify_buffers);

        let allowed = this.allowed_by_lists(topics);

        debug(`Received payload at rssi: ${discovery.rssi} for topics ${topics} allowed: ${allowed}`);

        // Only send it if the received discovery RSSI is at or stronger than the minimum

        if (allowed && discovery.rssi >= this.config.min_rssi) {
            topics.forEach((topic) => {
                if (topic.match(this.config.topic_publish_filter)) {
                    this.publish_discovery(topic, json_payload);
                }
            });
        }
    }

    /**
     * Send out the received discovery via mqtt
     *
     * @param {*} id
     * @param {*} payload
     * @memberof BLE2MQTT
     */

    publish_discovery(id, payload) {

        let options = {
            qos: this.config.mqtt_qos,
            retain: this.config.mqtt_retain,
            dup: false
        };

        if (this.mqtt_client && this.config.mqtt_publish_topic) {
            this.mqtt_client.publish(
                `${this.config.mqtt_publish_topic}/${id}`,
                payload.toString(),
                options,
                () => {
                    debug(`Sent ${payload.toString()} to ${this.config.mqtt_publish_topic}/${id}`);
                }
            );
        }
    }

    subscribe() {
        let options = {
            qos: this.config.mqtt_subs_qos
        };

        this.mqtt_client.subscribe(this.config.mqtt_command_topic, options, (err) => {
            if (err) {
                debug(`Error subscribing to ${this.config.mqtt_command_topic}: ${err}`);
            }
        });

        this.mqtt_client.on('message', (topic, message) => {
            this.receive_mqtt_msg(topic, message.toString());
        });
    }

    receive_mqtt_msg(topic, value) {
        // Topic is in the format <command_topic>/:category/:key = value
        debug(topic, value);

        let matches = topic.match(this.config.mqtt_command_topic_regexp);

        if (matches instanceof Array && matches.length === 3) {
            let category = matches[1];
            let field = matches[2];

            // Special case for true and false

            if (value === "false") {
                value = false;
            }

            if (value === "true") {
                value = true;
            }

            // If the value can be converted to a Number and back and retains its
            // exact value, we set it as a Number in the state_delta

            if (value === Number(value).toString()) {
                debug("value is a number");
                value = Number(value);
            }

            debug(`Got a command category ${category} name ${field} value ${value}`);

            if (category === "config" && field === "min_rssi") {
                this.config.min_rssi = value;
            }
            else {
                debug(`Unrecognized category ${category}`);
            }

        }

    }

    // STATIC METHODS

    /**
     * We want to use JSON.stringify to make the Buffers just string of Hex bytes.
     * But by the time the replace function gets the data, JSON.stringify has already
     * run .toJSON() on any object that has that property, which Buffers do have.  They
     * have been converted to {type: '<typename>', data: [<array of byte values>]} before
     * we ever get to process them!  It is possible that an object
     * being stringified would just happen to have that structure in it (and not be a JS
     * Buffer), so we preprocess the Buffers (in the static method BLE2MQTT.convert_buffers()).
     *
     * @static
     * @param {*} key
     * @param {*} val
     * @memberof BLE2MQTT
     */

    static stringify_buffers(key, val) {
        if (val instanceof Buffer) {
            return Buffer.from(val).toString('hex');
        }
        else if (val === undefined) {
            return null;
        }
        else {
            return val;
        }
    }
    /**
     * Recursively "override" Buffer.prototype.toJSON() with the instance.toJSON()
     * method (which is set to undefined so that JSON.stringify() won't use it).
     * 
     * Convert any Buffer found in a deep inspection of the passed Object into a 
     * cloned Buffer without the toJSON method.  This is needed because toJSON() is called by JSON.stringify()
     * BEFORE passing the object to the replacer function, which means we lose the 
     * opportunity to modify the object in the replacer if it has a toJSON() method.
     *
     * @static
     * @param {*} param
     * @returns {void}
     * @memberof BLE2MQTT
     */

    static convert_buffers(param) {
        if (param instanceof Buffer) {
            // This overrides the toJSON method (defined in Buffer.prototype)
            // for this Buffer instance.
            param.toJSON = undefined;
        }
        // recursively find all Buffers (won't work on circular structures!)
        else if (param instanceof Array) {
            param.forEach((item) => BLE2MQTT.convert_buffers(item));
        }
        else if (param instanceof Object) {
            Object.values(param).forEach((item) => BLE2MQTT.convert_buffers(item));
        }
    }
}

