
'use strict';

import tcp_ping from "tcp-ping";
import logger from "debug"; const debug = logger('otto:xcvr');
import child_process from "child_process";
import cron from "cron"; const CronJob = cron.CronJob;

import { Device } from "./Device";

import { BaseObject } from "./BaseObject.js";

export class Transceiver extends BaseObject {
	constructor() {
		super();
		// Having this.owner always populated with a Device
		// means that we don't have to worry about some
		// event coming in (which calls owner->receive()) 
		// before the owner is assigned.

		// This "new Device()" is always replaced with a
		// more configured one in Device.add_transmitter()
		// or Device.add_receiver().

		this.owner = new Device("Unconfigured Tranceiver Owner");
	}

	close() {
		this.emit('close');
	}
}

export class Transmitter extends Transceiver {
	constructor() {
		super();
	}
	_isa_transmitter() {
		return true;
	}

	// This method is called for every state change that happens on the owning device,
	// set up by Device.add_transmitter().

	state_change(field, new_value, old_value) {
		// Transmitters get notified on every state change and must
		// decide if they should actually transmit based on the field.

		// All Transmitters should override this method.

		debug(`Transmitter got state_change event for field ${field} from ${old_value} to ${new_value}`);

		this.send(new_value);
	}

	send(value) {
		debug(`Transmitter will send ${value} somewhere if you override the method Transmitter.send() in your subclass`);
	}
}

export class Receiver extends Transceiver {
	constructor() {
		super();
		this._prevent_events = false;
	}

	_isa_receiver() {
		return true;
	}

	prevent_events() {
		this._prevent_events = true;
		return this;
	}

	send_events() {
		this._prevent_events = false;
		return this;
	}
}

export class Configurator extends Transceiver {
	constructor() {
		super();
	}
	_isa_configurator() {
		return true;
	}
}

export class ScheduledReceiver extends Receiver {
	constructor(cron_times, callback) {
		super();

		let self = this;

		this.cronjob = new CronJob(
			/* Cron Time Spec */ cron_times,
			/* onTick         */ callback,
			/* onComplete     */ null,
			/* start          */ true,
			/* Timezone       */ "America/New_York",
			/* context        */ this,
			/* runOnInit      */ false
		);
	}
}

// export class SubprocessReceiver extends Receiver {
// 	constructor(command, options, period) {
// 		super();
// 		this.command = command;
// 		this.options = options;
// 		this.period = period || 10000;
// 		this.subprocess = null;

// 		setInterval(() => this.run(), this.period * 1000).unref();
// 	}

// 	run() {

// 		debug(`Running ${this.command}`, this.options);

// 		this.subprocess = child_process.spawn(this.command, this.options);

// 		this.subprocess.on('close', (code) => {
// 			debug(`${this.command} exited with status ${code}`);
// 			this.owner.receive(this, { code: code });
// 		});

// 		this.subprocess.stderr.on('data', (data) => debug(data.toString()));
// 		this.subprocess.stdout.on('data', (data) => debug(data.toString()));

// 	}
// }

// // export class ARPPingReceiver extends SubprocessReceiver {

// 	constructor(ip, period) {
// 		super("/sbin/arping", ['-f', '-c', '5', '-I', 'enp2s0', ip], period);
// 		this.ip = ip;
// 	}

// 	run() {

// 		debug(`Running ${this.command}`, this.options, "for", this.owner.name);

// 		this.subprocess = child_process.spawn(this.command, this.options);

// 		this.subprocess.on('close', (code) => {
// 			debug(`${this.command} exited with status ${code} for ${this.owner.name}`);
// 			this.owner.receive(this, { reachable: !code });
// 		});

// 		this.subprocess.stderr.on('data', (data) => debug(this.owner.name, data.toString()));
// 		this.subprocess.stdout.on('data', (data) => debug(this.owner.name, data.toString()));
// 	}
// }

// export class ARPPingReceiver extends Receiver {
// 	constructor(ip, period) {
// 		super();
// 		this.ip = ip;
// 		this.period = period || 10000;

// 		setInterval(() => this.probe(this.ip), this.period * 1000).unref();
// 	}

// 	probe(ip) {
// 		debug(`ARPPinging ${ip}`);
// 		arpping.arp([ip], (err, found, missing) => {
// 			if (!err && found[0] === ip) {
// 				debug("Got ARPPing reply");
// 				this.owner.receive(this, {
// 					reachable: true,
// 				});
// 			}
// 			else {
// 				this.owner.receive(this, {
// 					reachable: false
// 				});
// 			}
// 		});
// 	}
// }

// export class PingReceiver extends Receiver {
// 	constructor(ip, period) {
// 		super();
// 		this.ip = ip;
// 		this.period = period || 10000;

// 		setInterval(() => this.probe(this.ip), this.period * 1000).unref();
// 	}

// 	probe(ip) {
// 		debug(`Pinging ${ip}`);
// 		ping_session.pingHost(ip, (err, target, sent, received) => {
// 			if (!err) {
// 				this.owner.receive(this, {
// 					reachable: true
// 				});
// 			}
// 			else {
// 				this.owner.receive(this, {
// 					reachable: false
// 				});
// 			}
// 		});
// 	}
// }

// TODO:  This class triggers a fatal error due to a boundscheck in the protocol parsing, buried deep within
// the dhcp_listener.  Do not use!

// export class DHCPReceiver extends Receiver {
//     constructor(mac_addr) {
// 	super();
// 	this.mac_addr = mac_addr;
// 	this.dhcp_listener = dhcp.createBroadcastHandler();

// 	this.dhcp_listener.on('message', (data) => {
// 	    debug(data);
// 	    if (data.options[53] === dhcp.DHCPDISCOVER ||
// 		data.options[53] === dhcp.DHCPREQUEST) {
// 		if (data.chaddr === this.mac_addr) {
// 		    debug("DHCPReceiver noticed", this.mac_addr);
// 		    this.owner.receive(this, {
// 			reachable: true,
// 			last_seen: new Date(),
// 		    });
// 		}
// 	    }
// 	});

// 	this.dhcp_listener.listen();
//     }
// }

export class PortProbeReceiver extends Receiver {
	constructor(ip, port, period) {
		super();
		this.ip = ip;
		this.port = port || 80;
		this.period = period || 10;
		this.interval = null;

		// Start each one after a random delay up to
		// the value of the period, to avoid having
		// many of these created at once all firing
		// at the same time.

		setTimeout(() => {
			this.interval = setInterval(() => this.probe(), period * 1000).unref();
		}, Math.floor(Math.random() * period * 1000));
	}

	probe() {
		debug(`Probing ${this.ip}:${this.port}`);
		tcp_ping.probe(this.ip, this.port, (err, data) => {
			if (err || !data) {
				debug(`DOWN: ${this.ip}:${this.port}`);
				this.owner.receive(this, {
					reachable: false,
				});
			}
			else {
				debug(`UP: ${this.ip}:${this.port}`);
				this.owner.receive(this, {
					reachable: true,
					last_seen: new Date(),
				});
			}
		});
	}
}

// export class PlaySoundOnStateChange extends Transmitter {
// 	constructor(field, value, filename) {
// 		super();
// 		this.filename = filename;
// 		this.field = field;
// 		this.value = value;
// 	}

// 	state_change(field, new_value, old_value) {
// 		if (this.field === field && this.value === new_value && typeof old_value !== "undefined") {
// 			this.play();
// 		}
// 	}

// 	play() {
// 		fs.createReadStream(this.filename)
// 			.pipe(new lame.Decoder())
// 			.on('format', function (format) {
// 				this.pipe(new Speaker(format));
// 			});
// 	}
// }


