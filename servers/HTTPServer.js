
'use strict';

import logger from "debug"; const debug = logger('otto:httpserver');
import http from "http";
import spdy from "spdy";
import ipaddr from "ipaddr.js";
import express from "express";
import basicAuth from "express-basic-auth";
import fs from "fs";

import { Server } from "@homeserver-js/core";

export class HTTPServer extends Server {

    constructor(registry) {
        super(registry);

        this.app = express();
        this.http = http.Server(this.app);

        this.spdy = spdy.createServer({
            key: fs.readFileSync(registry.Configuration.spdy_priv_key_file),
            cert: fs.readFileSync(registry.Configuration.spdy_cert_file)
        }, this.app);

        this.clean_shutdown = (signal) => {
            console.log("Shutting down http/1.1 server");
            this.http.close(() => {
                console.log("http/1.1 server shut down");
            });
            console.log("Shutting down http/2 server");
            this.spdy.close(() => {
                console.log("http/2 server shut down");
            });
        };

        // Set up Express application

        // Require login

        this.app.use(basicAuth({
            challenge: true,
            users: registry.Configuration.http_users
        }));


        this.app.get('/status', (req, res) => {
            registry.StatusReport.build_report();
            res.send("<PRE>" + registry.StatusReport.get_report() + "</PRE>");
        });

        // This code isn't actually used by much; most everything talks MQTT.  But it could be handy
        // for interfacing with other devices that only do REST requests.  For instance,
        // there are Android widgets that fire off HTTP requests when you hit their
        // home screen icons, which can be used for ultra-convenient access to some
        // device in your home automation system.

        this.app.get('/device/:deviceName/:key/:value', (req, res) => {
            let device_name = req.params.deviceName;
            let key = req.params.key;
            let value = req.params.value;

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

            let state_delta = {};
            state_delta[key] = value;


            if (registry.HomeServer[device_name]) {
                registry.HomeServer[device_name].modify(state_delta);
                res.send(200, "OK");
                debug("OK: ", device_name, key, value);
            }
            else {
                debug("No such device", device_name, key, value);
                res.send(401, "ERROR: No such device " + device_name);
            }
        });

        this.app.get('/video/:device_name', (server_request, server_response) => {
            debug("Got request");

            let camera_url = this.resolve_camera_url(server_request.params.device_name);

            debug(server_request.params);

            if (!registry.HomeServer.Cameras.state().power) {
                server_response.sendStatus(404);
            }
            // else if (this.is_local_request(server_request)) {
            //     debug(`Redirecting to ${camera_url}video`);
            //     server_response.redirect(`${camera_url}video`);
            // }
            else {
                this.forward_video_connection(camera_url, server_response);
            }
        });

        this.app.get('/shot/:device_name', (server_request, server_response) => {

            let camera_url = this.resolve_camera_url(server_request.params.device_name);

            debug(server_request.params);

            if (!registry.HomeServer.Cameras.state().power) {
                server_response.sendStatus(404);
            }
            else if (this.is_local_request(server_request)) {
                debug(`Redirecting to ${camera_url}shot.jpg`);
                server_response.redirect(`${camera_url}shot.jpg?r=${Math.random()}`);
            }
            else {
                this.forward_shot_connection(camera_url, server_response);
            }
        });

        // For any route that is used within the react app, we need to serve up the react app in case the
        // user hits "reload" while at the URL.

        this.app.get('/Panel/*', (req, res) => res.sendFile('/home/auto/ottoreact/build/index.html'));

        // Requests to all other URLs return the react build directory, which contains all static resources,
        // including the favicon.ico and other such files, and the react /static directory built by yarn build,
        // which contains css, js, and media subdirectories.

        this.app.use(express.static('/home/auto/ottoreact/build'));

        this.http.listen(
            registry.Configuration.HTTPServer_port,
            registry.Configuration.HTTPServer_address,
            () => {
                debug(`HTTP/1.1 Server listening on ${registry.Configuration.HTTPServer_address}: ${registry.Configuration.HTTPServer_port}`);
                registry.on('SIGINT', this.clean_shutdown);
                registry.on('SIGTERM', this.clean_shutdown);
                registry.on('SIGHUP', this.clean_shutdown);
            });

        this.spdy.listen(
            registry.Configuration.HTTPServer_port + 1,
            registry.Configuration.HTTPServer_address,
            () => {
                debug(`HTTP/2 Server listening on ${registry.Configuration.HTTPServer_address}: ${registry.Configuration.HTTPServer_port + 1}`);
            });
    }

    is_local_request(request) {
        let ip_address = request.connection.remoteAddress;

        if (request.headers && request.headers['x-forwarded-for']) {
            [ip_address] = request.headers['x-forwarded-for'].split(',');
        }

        return ipaddr.process(ip_address).range() === "private";
    }

    forward_video_connection(camera_url, server_response) {
        let camera_request = http.request(camera_url + 'video', (camera_response) => {

            // Pipe camera_response to this server's response

            debug("Server response highwatermark:", server_response);

            server_response.writeHead(200, {
                "Content-Type": "multipart/x-mixed-replace;boundary=Ba4oTvQMY8ew04N8dcnM"
            });

            camera_response.pipe(server_response).on('error', (err) => {
                debug("Pipe error", err);
                camera_request.abort();
                server_response.end();
            });

            server_response.on('close', () => { debug("Server Response closed"); camera_request.abort(); });
        });

        camera_request.on('error', (err) => {
            debug("camera Request error", err);
            server_response.end();
        });

        camera_request.end();
    }

    forward_shot_connection(camera_url, server_response) {
        let camera_request = http.request(camera_url + 'shot.jpg', (camera_response) => {

            // Pipe camera_response to this server's response

            server_response.writeHead(200, {
                "Content-Type": "image/jpeg"
            });

            camera_response.pipe(server_response).on('error', (err) => {
                debug("Pipe error", err);
                camera_request.abort();
                server_response.end();
            });

            server_response.on('close', () => { debug("Server Response closed"); camera_request.abort(); });
        });

        camera_request.on('error', (err) => {
            debug("camera Request error", err);
            server_response.end();
        });

        camera_request.end();
    }

    resolve_camera_url(name) {
        if (name === "Cat_Door") {
            return "http://camera-room-2.home:8080/";
        }
        else if (name === "Cat_Door_2") {
            return "http://camera-catdoor-2.home:8080/";
        }
        else if (name === "Room_1") {
            return "http://camera-room-1.home:8080/";
        }
        else if (name === "Hallway") {
            return "http://frontdoorcam.home:8080/";
        }
        else {
            return undefined;
        }
    }
}
