
'use strict';

import logger from "debug"; const debug_mqtt = logger('otto:mqtt');
const debug_mqtt_data = logger('otto:mqtt:data');
const debug = logger('otto:mosca');
const debug_auth = logger('otto:auth');

import mosca from "mosca";
import configuration from "../../configuration.js";

import { Server } from "lib/Server.js";

export class MQTTServer extends Server {

    constructor(registry) {

        super(registry);


        this.clients = {};
        this.topics = {};
        this.ips = {};
        this.mosca = new mosca.Server({
            port: 1883,
            ip: "192.168.5.100",
            http: {
                port: 3030,
                bundle: true,
                static: './'
            },
            persistence: {
                factory: mosca.persistence.Memory
            }
        });

        this.mosca.on('clientConnected', (client) => {
            debug_mqtt('clientConnected', client.id);
            this.clients[client.id] = new Date();
            this.ips[client.id] = client.connection.stream.remoteAddress;
        });

        // fired when a message is received and forwarded
        this.mosca.on('published', (packet, client) => {
            let value = packet.payload.toString();
            if (value.length <= 60) {
                debug_mqtt('Published', packet.topic, '=', value);
            }
            else {
                debug_mqtt('Published', packet.topic, "length", value.length);
            }
            debug_mqtt_data('Published', packet.topic, '=', value);
            this.topics[packet.topic] = new Date();
        });

        // fired when a client disconnects
        this.mosca.on('clientDisconnected', (client) => {
            debug_mqtt('clientDisconnected');
        });

        // fired when a client subscribes
        this.mosca.on('subscribed', (packet, client) => {
            debug_mqtt('Subscribed', packet.topic);
        });

        // fired when a client unsubscribes
        this.mosca.on('unsubscribed', (packet, client) => {
            debug_mqtt('unsubscribed', packet.topic);
        });

        this.mosca.on('ready', () => {
            debug('Mosca server is up and running');
        });

        // Accepts the connection if the username and password are valid
        this.mosca.authenticate = function (client, username, password, callback) {
            // Check the Username and Password

            let remote_addr = client.connection.stream.remoteAddress;

            let authorized = false;

            if (remote_addr === "::1") {
                authorized = true;
            }

            if (remote_addr === "::ffff:127.0.0.1") {
                authorized = true;
            }

            if (remote_addr === "::ffff:192.168.5.100") {
                authorized = true;
            }

            if (/::ffff:192\.168\.5.\d+/.exec(remote_addr)) {
                authorized = true;
            }

            if (remote_addr === "::ffff:192.168.5.1") {
                // All the NATted remote connections come in as this
                authorized = false;
            }

            if (remote_addr === undefined) {
                // TODO: What the heck are these?
                debug_auth("Undefined remote connection: ", client.id);
                authorized = true;
            }

            debug_auth("Preauthorized client?", authorized, client.id, username, password, client.connection.stream.remoteAddress);

            if (username === configuration.mqtt_broker_login && password.toString() === configuration.mqtt_broker_password) {
                authorized = true;
            }

            if (authorized) {
                debug_auth("Authorizing client", authorized, client.id, username, client.connection.stream.remoteAddress);
                client.user = username;
            }
            else {
                debug_auth("Rejecting client", authorized, client.id, username, client.connection.stream.remoteAddress);
                debug_auth(configuration);
            }

            callback(null, authorized);
        };
    }
}

