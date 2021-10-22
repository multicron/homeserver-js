
'use strict';

import logger from "debug"; const debug = logger('otto:hosts');
import fs from "fs";
import parse from "csv-parse/lib/sync.js";

import { Device } from "@homeserver-js/device-js";

export class HostFileUpdater extends Device {
    constructor(name, file) {
        super(name);

        this.config_file_dir = "/home/auto/otto/config_files";

        this.hosts_csv_name = `${this.config_file_dir}/hosts.csv`;
        this.hosts_file_name = `${this.config_file_dir}/hosts`;
        this.ethers_file_name = `${this.config_file_dir}/ethers`;
        this.dhcp_static_name = `${this.config_file_dir}/dhcp_static_leases.conf`;
        this.static_lease_time = 4271; // 1 Hour 11 Minutes 11 Seconds

        this.run();
    }

    run() {
        this.load_records();
        this.write_files();
    }

    load_records() {
        this.csv_data = fs.readFileSync(this.hosts_csv_name).toString();
        // Read the content

        // const content = await fs.promises.readFile(this.hosts_csv_name);

        const content = this.csv_data;

        // Parse the CSV content
        this.records = parse(content, {
            delimiter: '\t',
            columns: ["ip", "mac", "hostname", "comment", "port"],
            comment: "#",
            trim: true,
            skip_empty_lines: true,
            skip_lines_with_empty_values: true,
            skip_lines_with_error: true
        });

        debug(this.records);

        this.emit('records_loaded');

    }

    async write_files() {

        this.write_hosts_file();
        this.write_ethers_file();
        this.write_dhcp_file();
    }

    async write_hosts_file() {

        let data = this.records.map((record) => `${record.ip}\t${record.hostname}`).join('\n');

        fs.promises.writeFile(this.hosts_file_name, data + '\n');
    }

    async write_ethers_file() {

        let data = this.records.map((record) => `${record.mac}\t${record.hostname}`).join('\n');

        fs.promises.writeFile(this.ethers_file_name, data + '\n');
    }

    async write_dhcp_file() {

        // b8:70:f4:e2:95:fe,timeline,192.168.5.100,infinite

        let data = this.records.map((record) => `${record.mac},${record.hostname},${record.ip},${this.static_lease_time}`).join('\n');

        fs.promises.writeFile(this.dhcp_static_name, data + '\n');
    }
}
