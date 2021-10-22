
'use strict';

import logger from "debug"; const debug = logger('homeserver:testserver');
import net from "net";
import repl from "repl";

import { Server } from "@homeserver-js/core";

export class REPLServer extends Server {
    constructor(registry) {
        super(registry);

        let house = registry.HomeServer;
        let mqtt_broker = registry.Configuration.HomeServer_mqtt_broker;

        net.createServer((socket) => {

            const server = repl.start({
                prompt: '> ',
                input: socket,
                output: socket,
                terminal: true,
                useGlobal: false,
                replMode: repl.REPL_MODE_STRICT
            });

            server.on('exit', () => {
                socket.end();
            });

            server.context.socket = socket;
            server.context.house = house;
            server.context.mqtt_broker = mqtt_broker;
            server.context.registry = registry;
        }).listen(registry.Configuration.repl_server_port);
    }
}

