
'use strict';

import logger from "debug"; const debug = logger('otto:xcvr:http');
import request from "request";

import {
    Receiver,
    Transmitter,
    Configurator
} from "@homeserver-js/tranceiver-js";

/**
 * Utility Function Asynchronously fetches data from a URL with request.get 
 * (including optional Basic Auth header if options[username] and options[password] are passed)
 *
 * @param {Object} options
 * @param {Function} callback
 * @returns request.get() response
 */

function HTTPGet(options, callback) {
    let my_options = Object.assign({}, options);
    let username = options.username;
    let password = options.password;
    if (username || password) {
        let auth = 'Basic ' + Buffer.from(username + ':' + password).toString('base64');

        var new_header = { 'Authorization': auth };

        let my_headers = Object.assign({}, my_options.headers, new_header);

        my_options.headers = my_headers;
    }

    debug("HTTPGet", my_options);

    return request.get(my_options, callback);
}

export class HTTPGetPoll extends Receiver {
    constructor(options, period, field) {
        super();
        this.period = Math.abs(period);
        this.field = field;
        this.options = options;
        this.interval = null;

        if (period > 0) {
            this.poll();
        }

        debug("Period is", this.period);

        if (period != 0) {
            this.interval = setInterval(() => this.poll(), this.period * 1000).unref();
        }
    }

    poll() {
        let options = Object.assign({}, this.options);

        HTTPGet(options, (err, res, body) => {
            if (err) {
                debug(err);
            }
            else {
                this.receive_http_msg(body);
            }
        });

        return this;
    }

    receive_http_msg(body) {
        debug("HTTPGetPoll got data: ", body);
        let values = {};
        values[this.field] = body;
        this.owner.receive(this, values);
    }
}

export class HTTPGetPollParsed extends HTTPGetPoll {
    constructor(options, period, field, parser) {
        super(options, period, field);

        if (!parser) {
            throw new Error("parser must be specified");
        }

        this.parser = parser;
    }

    receive_http_msg(body) {
        let values = {};
        let parsed = {};

        debug("HTTPGetPoll got data: ", body);

        try {
            parsed = this.parser(body);
        }
        catch (err) {
            debug("Bad Parse: ", err, body);
        }
        values[this.field] = parsed;

        this.owner.receive(this, values);
    }
}

export class HTTPGetPollJSON extends HTTPGetPollParsed {
    constructor(options, period, field) {
        super(options, period, field, (json) => this.parse_json(json));
    }
}

export class HTTPGetPollDDWRT extends HTTPGetPollParsed {
    constructor(options, period, field) {
        super(options, period, field, (data) => this.parse_ddwrt(data));
        this.ddwrt = {};
    }

    parse_ddwrt(data) {
        let items_regexp = /(\{[^}]+\})/g;
        let items = data.match(items_regexp);
        if (items === null) {
            items = [];
        }
        items.forEach((item) => this.parse_item(item));

        if (this.ddwrt.arp_table) {
            let array = this.parse_array(this.ddwrt.arp_table);
            //let table = this.parse_table_named(array, 'mac', ['hostname', 'ip', 'mac', 'unknown']);
            // For Newer versions of DDWRT:
            let table = this.parse_table_named(array, 'mac', ['hostname', 'ip', 'mac', 'unknown', 'interface']);
            this.ddwrt.arp_table = table;
        }
        if (this.ddwrt.dhcp_leases) {
            let array = this.parse_array(this.ddwrt.dhcp_leases);
            let table = this.parse_table_named(array, 'mac', ['hostname', 'ip', 'mac', 'expires', 'length']);
            this.ddwrt.dhcp_leases = table;
        }
        if (this.ddwrt.active_wireless) {
            let array = this.parse_array(this.ddwrt.active_wireless);
            // let table = this.parse_table_named(array, 'mac', ['mac', 'interface', 'uptime',
            // 	'tx_rate', 'rx_rate', 'signal', 'noise', 'snr', 'quality']);
            // For Newer versions of DDWRT:
            let table = this.parse_table_named(array, 'mac', ['mac', 'radioname', 'interface', 'uptime',
                'tx_rate', 'rx_rate', 'info', 'signal', 'noise', 'snr', 'quality']);
            this.ddwrt.active_wireless = table;
        }

        return this.ddwrt;

        // return { data: data, items: items, ddwrt: this.ddwrt };
    }

    // Convert a flat array to a hash of arrays

    parse_table(array, columns, key_index) {
        let row = [];
        let table = {};
        array.forEach((item) => {
            row.push(item);
            if (row.length === columns) {
                table[row[key_index]] = row;
                row = [];
            }
        });
        return table;
    }

    // Convert a flat array to a hash of hashes

    parse_table_named(array, key_col, cols) {
        let index = 0;
        let row = {};
        let table = {};
        array.forEach((item) => {
            row[cols[index++]] = item;
            if (index === cols.length) {
                table[row[key_col]] = row;
                row = {};
                index = 0;
            }
        });
        return table;
    }

    parse_array(data) {
        let match = data.match(/'(.*)'/);
        if (!match) {
            throw new Error("Array data in bad format");
        }
        let new_data = match[1];

        let array = new_data.split(/'\s*,\s*'/);
        return array;
    }

    parse_item(data) {
        let [match, key, value] = data.match(/\{(.+)::(.*)\}/);
        this.ddwrt[key] = value;
    }
}
export class HTTPConfigurator extends Configurator {
    constructor(url) {
        super();
        this.url = url;
    }

    configure() {
        request(this.url, (err, res, body) => {
            if (err) {
                debug(err);
            }
            else {
                debug(body);
            }
        });
    }
}

export class HTTPTransmitter extends Transmitter {
    constructor(url, field) {
        super();
        this.url = url;
        this.field = field;
    }

    state_change(field, new_value, old_value) {
        if (this.field === field) {
            this.send(new_value);
        }
    }

    send(value) {
        if (this.url) {

            request(`${this.url}${value}`, (err, res, body) => {
                if (err) {
                    debug(err);
                }
                else {
                    debug(body);
                }
            });

        }
    }
}

export class HTTPBooleanTransmitter extends HTTPTransmitter {
    constructor(url, field, on_value, off_value) {
        super(url, field);
        this.on_value = on_value;
        this.off_value = off_value;
    }

    send(value) {
        if (value) {
            super.send(this.on_value);
        }
        else {
            super.send(this.off_value);
        }
    }
}

