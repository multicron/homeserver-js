
'use strict';

import net from "net";
import { Socket } from "net";
import http from "http";
import ws from "websocket-stream";
import aedes from "aedes";
import util from "util";

import logger from "debug";
const debug_mqtt = logger('homeserver:mqtt');
const debug_aedes = logger('homeserver:mqtt:aedes');
const debug_mqtt_data = logger('homeserver:mqtt:data');
const debug = logger('homeserver:aedes');
const debug_auth = logger('homeserver:auth');

import { Server } from "@homeserver-js/core";

export class MQTTServer extends Server {

    private clients: any = {};
    private topics: any = {};
    private ips: any = {};
    private aedes: aedes.Aedes;
    private aedes_mqtt_server: net.Server;
    private aedes_ws_server: http.Server;

    constructor(registry) {

        super(registry);

        const config = registry.Configuration;

        debug("Creating Aedes server");

        this.aedes = aedes();

        // A server to listen for MQTT connections

        this.aedes_mqtt_server = net.createServer(this.aedes.handle)

        // A server to listen for WS connections

        this.aedes_ws_server = http.createServer()
        //@ts-expect-error
        ws.createServer({ server: this.aedes_ws_server }, this.aedes.handle)

        this.aedes_mqtt_server.listen(
            {
                port: config.mqtt_server_mqtt_listen_port,
                ip: config.mqtt_server_mqtt_listen_ip,
            })
            .on('listening', () => {
                debug_aedes(`Aedes MQTT listening on ${config.mqtt_server_mqtt_listen_ip}:${config.mqtt_server_mqtt_listen_port}`);
                registry.on('SIGINT', this.clean_shutdown);
                registry.on('SIGTERM', this.clean_shutdown);
                registry.on('SIGHUP', this.clean_shutdown);
            });

        this.aedes_ws_server.listen(
            {
                port: config.mqtt_server_ws_listen_port,
                ip: config.mqtt_server_mqtt_listen_ip,
            })
            .on('listening', () => {
                debug_aedes(`Aedes MQTT-WS listening on ${config.mqtt_server_mqtt_listen_ip}:${config.mqtt_server_ws_listen_port}`);
                this.aedes.publish(
                    {
                        cmd: 'publish',
                        topic: 'aedes/hello',
                        payload: `Aedes broker up and running id ${this.aedes.id}`,
                        qos: 0,
                        dup: false,
                        retain: false
                    },
                    () => { });
            });

        this.aedes.on('clientReady', (client) => {
            debug_mqtt('clientReady', client.id, "at ip", util.inspect((client.conn as Socket).remoteAddress));
            this.clients[client.id] = new Date();
            this.ips[client.id] = (client.conn as Socket).remoteAddress;
        });

        // fired when a message is received and forwarded
        this.aedes.on('publish', (packet, client) => {
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
        this.aedes.on('clientDisconnect', (client) => {
            debug_mqtt('clientDisconnect');
        });

        // fired when a client subscribes
        this.aedes.on('subscribe', (subscriptions, client) => {
            debug_mqtt('subscribe', subscriptions.map((item) => item.topic).join(","));
        });

        // fired when a client unsubscribes
        this.aedes.on('unsubscribe', (unsubscriptions, client) => {
            debug_mqtt('unsubscribe', unsubscriptions.join(","));
        });

        // Accepts the connection if the username and password are valid
        this.aedes['authenticate'] = function (client, username, password, callback) {

            debug(`Aedes server authenticating ${client} ${username} ${password}`);

            // Check the Username and Password

            let remote_addr = (client.conn as Socket).remoteAddress || "";

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

            debug_auth("Preauthorized client?", authorized, client.id, username, password, client.conn.remoteAddress);

            if (username === config.mqtt_broker_login && password.toString() === config.mqtt_broker_password) {
                authorized = true;
            }

            if (authorized) {
                debug_auth("Authorizing client", authorized, client.id, username, password?.toString(), client.conn.remoteAddress);
                client.user = username;
            }
            else {
                debug_auth("Rejecting client", authorized, client.id, username, password?.toString(), client.conn.remoteAddress);
                debug_auth(config);
            }

            callback(null, authorized);
        };

    }

    clean_shutdown(signal) {
        console.log("Shutting down aedes servers", signal);
        this.aedes.close(() => {
            console.log("aedes.close() succeeded");
        });
        this.aedes_mqtt_server.close(() => {
            console.log("aedes mqtt server shut down");
        });
        this.aedes_ws_server.close(() => {
            console.log("aedes ws server shut down");
        });
    };

}

