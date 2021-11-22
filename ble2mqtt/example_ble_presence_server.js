
'use strict';

import logger from "debug"; const debug = logger('homeserver:bleserver');

import { BLE2MQTT } from "@homeserver-js/ble2mqtt";
import os from "os";

let hostname = os.hostname();

let config = {
    min_rssi: -999,
    mqtt_publish_topic: `ble2mqtt/${hostname}/discovery`,
    mqtt_command_topic: `ble2mqtt/${hostname}/command/#`,
    mqtt_command_topic_regexp: `ble2mqtt/${hostname}/command/([a-zA-Z0-9_]+)/([a-zA-Z0-9_]+)`,
    ble2mqtt_broker_url: "mqtt://192.168.5.100/",
    mqtt_broker_login: undefined,
    mqtt_broker_password: undefined,
    mqtt_broker_port: 1883,
    mqtt_qos: 0,
    mqtt_subs_qos: 0,
    mqtt_retain: false,
    topic_publish_filter: /^(alias|mac|local_name)/,
    aliases: {
        "mac/38:3c:9c:5d:1b:66": "alias/laundry-1",
        "mac/38:3c:9c:5d:1d:4c": "alias/laundry-2",
        "mac/38:3c:9c:5d:1c:96": "alias/laundry-3",
        "mac/38:3c:9c:5d:1a:1b": "alias/laundry-4",
        "mac/f0:b1:19:12:6a:96": "alias/rachel-keys-tile",
        "mac/fd:b6:a4:9d:08:8b": "alias/rachel-wallet-tile",
        "mac/c9:50:76:44:c6:7e": "alias/jarv-big-shot",
        "mac/a4:c1:38:e1:b6:06": "alias/ihome-strip-lights",
        "ibeacon/fda50693-a4e2-4fb1-afcf-c6eb07647825-2751-65c1": "alias/cat-neck-fob",
        "local_name/_LG__webOS_TV_OLED55B7A": "alias/living-room-tv",
        "local_name/_TV__Samsung_7_Series__43_": "alias/bedroom-tv",
    },
    blacklist: [
        "alias/laundry-1",
        "alias/laundry-2",
        "alias/laundry-3",
        "alias/laundry-4",
    ],
    whitelist: [
    ],

};

new BLE2MQTT(config);
