
'use strict';

import logger from "debug"; const debug = logger('homeserver:device');
const debug_emit = logger('homeserver:emit');
const debug_state = logger('homeserver:state');
const debug_modify = logger('homeserver:device:modify');
const debug_composite = logger('homeserver:device:composite');
const debug_automatic = logger('homeserver:device:automatic');
import EventEmitter from "events";
import cron from "cron"; const CronJob = cron.CronJob;
import uuid from "uuid";
import util from "util";

import {
	Transmitter,
	Receiver,
	Configurator,
} from "@homeserver-js/tranceiver-js";

import {
	HTTPGetPollParsed
} from "@homeserver-js/tranceiver-core";

import {
	StatePublisher
} from "@homeserver-js/core";

export class Device extends EventEmitter {
	constructor(name) {
		super();
		if (name === undefined || name === null || name === "") {
			// This underscore prevents the state of a device from
			// being published via MQTT.
			this.name = "_" + uuid.v4();
		}
		else {
			this.name = name;
		}
		this.receivers = [];
		this.transmitters = [];
		this.configurators = [];
		this.tags = [];

		this.stateholder = new StatePublisher(this.variable_name());
		this.stateholder.add(
			{
				_device_name: name,
				_device_class: this.constructor.name
			}
		);
		debug_state("Initial stateholder state", this.stateholder.get());
	}

	close() {
		this.emit("close");

		this.receivers.forEach((item) => item.close());
		this.transmitters.forEach((item) => item.close());
		this.configurators.forEach((item) => item.close());
	}

	configure() {
		debug("Running configurators for", this.name);
		this.configurators.forEach((configurator) => configurator.configure());
		return this;
	}

	configure_after_delay(delay) {
		setTimeout(() => this.configure(), delay).unref();

		return this;
	}

	/**
	 * Returns the name of the Device formatted as a property name
	 *
	 * @returns {String} The name of the device with non-alpha-numeric characters replaced with "_"
	 * @memberof Device
	 */

	variable_name() {
		return this.name.replace(/[^A-Za-z0-9_]/g, "_");
	}

	/**
	 *
		 * Adds the single specified Tranceiver to the Device
		 *
		 * @param {Tranceiver} items - The single Tranceiver instance to add to the Device
		 * @returns - The Device instance, for method chaining
		 * @memberof Device
	 */

	with(item) {
		return this.add(item);
	}

	/**
	 * Adds the specified Tranceivers to the Device
	 *
	 * @param {Tranceiver} items - The Tranceiver instances to add to the Device
	 * @returns - The Device instance, for method chaining
	 * @memberof Device
	 */

	add(...items) {
		items.forEach((item) => {
			if (item instanceof Transmitter) { return this.add_transmitter(item); }
			if (item instanceof Receiver) { return this.add_receiver(item); }
			if (item instanceof Configurator) { return this.add_configurator(item); }

			throw new Error("Unknown object type in Device.add()");
		});

		return this;
	}

	// A Transmitter sends the state to a physical (or another logical) object.
	// Initially, it does this on any state change

	add_transmitter(transmitter) {
		transmitter.owner = this;
		this.transmitters.push(transmitter);

		// This is too much notification for most Transmitters.  They have
		// to check to see if the field applies to themselves.

		this.on("stateChange", (field, new_value, old_value) => {
			transmitter.state_change(field, new_value, old_value);
		});

		return this;
	}

	// A Configurator configures a physical (or another logical) object.
	// This happens when Device.configure() is called (usually at server startup).


	add_configurator(configurator) {
		configurator.owner = this;
		this.configurators.push(configurator);
		return this;
	}

	// A receiver gets state from a physical (or another logical) object.
	// When it receives a state change, it calls this.receive.

	add_receiver(receiver) {
		receiver.owner = this;
		this.receivers.push(receiver);
		return this;
	}

	tagged(key) {
		this.tags.push(key);
		return this;
	}

	// this.receive() receives a state change from a receiver.  It calls this.modify().

	receive(receiver, state) {
		if (receiver._prevent_events) {
			debug("Modifying state for", this.name, "without emitting events because of prevent_events");
			this.modify_without_events(state);
		}
		else {
			this.modify(state);
		}
	}

	modify_without_events(state) {
		this.stateholder.modify(state);

		return this;
	}

	// Change the state of the device and emit events for any changes

	modify(values) {
		// Save the old values to check for changes
		let old_values = Object.assign({}, this.state());

		debug_modify(`Modifying ${this.name} `, old_values, "with", values);

		// Ask the StateHolder to modify the store.  This 
		// calls redux dispatch, but also publishes the state via MQTT
		this.stateholder.modify(values);

		// Devices are EventEmitters so you can say .on('change_power') and such
		// Emit "set_*" events first (even if the value doesn't change)
		// If event handlers modify the state recursively, this.state()
		// will be modified here (in the "parent" of the recursion) also!

		this.emit_sets(values, old_values, this.state());

		// Emit "change_*", "stateNew", and "stateChange" events

		this.emit_changes(values, old_values, this.state());

		debug_modify('New state: ', util.inspect(this.state(), false, 100));

		return this;
	}

	// Get the state of the device

	state() {
		return this.stateholder.get();
	}

	// Emit set events

	emit_sets(values, old_state, new_state) {
		Object.keys(values).forEach((field) => {
			debug_emit(this.name, "set_" + field);
			this.emit("set_" + field, new_state[field], old_state[field]);
		});
	}

	emit_changes(values, old_state, new_state) {
		Object.keys(values).forEach((field) => {
			// Didn't exist before
			if (!old_state.hasOwnProperty(field)) {
				debug_emit(this.name, "stateNew", field);
				this.emit("stateNew", field, new_state[field], old_state[field]);
			}
			if (values[field] !== old_state[field]) {
				debug_emit(this.name, "stateChange", field);
				debug_emit(this.name, "change_" + field);

				this.emit("stateChange", field, new_state[field], old_state[field]);
				this.emit("change_" + field, new_state[field], old_state[field]);
			}
			// TODO: stateDelete.
		});

		return this.state;
	}

	power(value) {
		value = !!value;
		this.modify({ power: value });
	}
}

export class Switch extends Device {
	constructor(name) {
		super(name);
	}
}

export class PrioritizedSwitch extends Switch {
	constructor(name) {
		super(name);
		this.timeout_callback = null;
		this.clear_priority();
	}

	// A switch with multiple levels of control:  each greater priority can control the switch
	// only if a higher priority setting is not already in force.  This switch shouldn't be
	// controlled by directly modifying its power field, because that would bypass the priorities.

	// Priority 4 sets power true with timeout null (locks changes below 4)
	// Priority 6 sets power true with timeout 5s
	// Priority 5 sets ... before the timeout, it is ignored
	// Priority 7 sets power false with timeout null

	power_priority(value, my_priority, timeout) {
		timeout = timeout || 0;
		if (this.state().priority === null || this.state().priority <= my_priority) {
			this.modify({
				priority: my_priority,
				power: value,
				start: Date.now(),
				timeout: timeout
			});

			clearTimeout(this.timeout_callback);
			if (timeout) {
				this.timeout_callback = setTimeout(() => { this.clear_priority(my_priority) }, timeout).unref();
			}
		}
	}

	power(value) {
		this.power_priority(value, 0, null);
	}

	clear_priority(which_priority) {
		if (this.state().priority === which_priority) {
			this.modify({ priority: null });
		}
	}
}

export class Relay extends Device {
	constructor(name) {
		super(name);
	}
}

export class LightBulb extends Device {
	constructor(name) {
		super(name);
	}
}

export class Outlet extends Device {
	constructor(name) {
		super(name);
	}
}

export class DataCollector extends Device {
	constructor(name) {
		super(name);
	}
}

export class Database extends Device {
	constructor(name) {
		super(name);
	}
}

export class Scene extends Device {
	constructor(name) {
		super(name);
	}

	activate() {
		this.modify({ activate: true });
	}

}

export class CompositeDevice extends Device {
	constructor(name, ...devices) {
		super(name);
		this.devices = devices.filter((item) => (typeof item === "object"));

		// When we get a state change on any field, we forward it to all of the
		// subdevices

		this.on("stateChange", (field, new_value) => {
			this.devices.forEach((device) => {
				debug_composite(`Modifying ${device.name} with `, { [field]: new_value });
				device.modify({ [field]: new_value });
			});
		});
	}
}

// This device configures one or more settings on a physical device.  It expects a receiver that will query
// the current value of the setting and a configurator that will set it to the proper value, but only if it
// is not currently set correctly.

export class SmartSetup extends Device {
	constructor(name, field) {
		super(name);

		this.field = field;
		this.test_if_already_set = () => false;

		this.on('change_' + this.field, () => this.configure());
	}

	test(fn) {
		this.test_if_already_set = fn;

		return this;
	}

	receive(receiver, state) {
		if (this.test_if_already_set(state[this.field])) {
			debug("Device is already configured properly:", state[this.field]);
			this.modify_without_events(state);
		}
		else {
			debug("Device requires configuration:", state[this.field]);
			super.receive(receiver, state)
		}
	}
}

export class PingableDevice extends Device {
	constructor(name) {
		super(name);
	}
}

export class TextDisplay extends Device {
	constructor(name) {
		super(name);
	}
}

export class Shelly1PMPolling extends Device {
	constructor(name, url, period) {
		super(name);

		this.period = period;
		this.pollable_receiver = new HTTPGetPollParsed({ url: url }, 0, 'watts', (data) => this.parse_power(data));
		this.with(this.pollable_receiver);

		this.on('change_enable', (new_value) => {
			if (new_value) {
				this.start();
			}
			else {
				this.stop();
			}
		});
	}

	start() {
		this.stop();
		this.interval_id = setInterval(() => {
			this.pollable_receiver.poll();
		}, this.period).unref();
	}

	stop() {
		if (this.interval_id) {
			clearInterval(this.interval_id);
			this.interval_id = null;
		}
	}

	parse_power(data) {
		let parsed = parse_json(data);

		let watts = parsed.meters[0].power;

		debug("Power from Shelly PM", watts);

		return watts;
	}
}

export class OpenCloseSwitch extends Device {
	constructor(name, open_switch, close_switch, delay) {
		super(name);

		this.open_switch = open_switch;
		this.close_switch = close_switch;
		this.delay = delay;

		this.on('change_power', new_value => this.change_power(new_value));
	}

	change_power(new_value) {
		if (new_value) {
			this.close_switch.power(0);
			setTimeout(() => this.open_switch.power(1), this.delay).unref();
		}
		else {
			this.open_switch.power(0);
			setTimeout(() => this.close_switch.power(1), this.delay).unref();
		}
	}
}

export class PowerMonitoredSwitch extends Device {
	constructor(name, subdevice, monitor, field, limit) {
		super(name);

		this.subdevice = subdevice;
		this.monitor = monitor;
		this.field = field;
		this.limit = limit;

		this.on('change_power', (new_value) => this.subdevice.modify({ power: new_value }));

		monitor.on('change_' + field, (new_value) => {
			if (new_value > this.limit) {
				debug("Over-power condition for", name);
				this.power(true);
			}
		});
	}
}

export class AutomaticSwitch extends Device {
	constructor(name, subdevice, timeout) {
		super(name);

		// This device is used to automatically turns on or off the subdevice, but only if it hasn't
		// been manually commanded within the last timeout ms.

		this.subdevice = subdevice;
		this.timeout = timeout;
		this.subdevice_last_commanded_change = null;
		this.next_change_is_automatic = false;

		// When the subdevice's power field is changed, we update our local record of when it
		// happened, unless it was this device that caused the change (is there a race condition here?)

		this.subdevice.on('change_power', () => {
			// 'this' is the AutomaticSwitch, not the subdevice
			if (!this.next_change_is_automatic) {
				debug_automatic(this.name, " Recording time of last commanded change");
				this.subdevice_last_commanded_change = Date.now();
			}
			else {
				debug_automatic(this.name, " power change forwarded from AutomaticSwitch");
				this.next_change_is_automatic = false;
			}
		});

		// When our power field is changed, we pass it on, unless the timeout hasn't been reached

		this.on('change_power', (new_value) => {
			if (this.subdevice_last_commanded_change + this.timeout < Date.now()) {
				debug_automatic(this.name, " Timeout reached; forwarding power change request");
				this.next_change_is_automatic = true;
				this.subdevice.power(new_value);
			}
			else {
				debug_automatic(this.name, " Ignoring power change request, timeout left =",
					Date.now() - (this.subdevice_last_commanded_change + this.timeout));
			}
		});
	}
}

export class AutoOffSwitch extends Device {
	constructor(name, subdevice, field, timeout) {
		super(name);

		this.subdevice = subdevice;
		this.field = field;
		this.current_callback = null;

		this.modify({
			timeout: timeout,
			start_time: null
		});
	}

	modify(values) {
		super.modify(values);

		// If we are setting the monitored field to true, turn on the timer.

		if (values[this.field] === true) {
			this.subdevice.modify({ [this.field]: true });
			this.timer_on();
		}

		// If we are setting the monitored field to false, turn off the timer and the subdevice.

		if (values[this.field] === false) {
			this.subdevice.modify({ [this.field]: false });
			this.timer_off();
		}

	}

	subdevice_changed() {
		this.timer_off();
	}

	timer_on() {
		// Only one timeout at a time is allowed.  Clear the timer if it is set.
		this.clear_callback();

		this.modify_self({
			[this.field]: true,
			start_time: Date.now()
		});

		debug(`Setting turnoff for now + ${this.state().timeout}`);

		this.current_callback = setTimeout(() => this.timer_expired(), this.state().timeout * 1000).unref();

		// If anyone changes the subdevice, clear the timer, but don't change the state of the subdevice.

		this.subdevice.once('change_' + this.field, (new_value, old_value) => this.subdevice_changed());

	}

	timer_off() {
		this.clear_callback();

		this.modify_self({
			[this.field]: false,
			start_time: null
		});
	}

	modify_self(values) {
		return super.modify(values);
	}

	clear_callback() {
		// Clear the timer if it is set

		if (this.current_callback) {
			clearTimeout(this.current_callback);
			this.current_callback = null;
		}
	}

	timer_expired() {
		debug("Timer expired: ", this.name);

		this.subdevice.modify({ [this.field]: false });

		this.timer_off();
	}
}

export class RateLimitingSwitch extends Device {
	constructor(name, field, ratelimit) {
		super(name);

		this.field = field;
		this.current_callback = null;
		this.ratelimit = ratelimit;

	}

	modify(values) {
		if (values.hasOwnProperty(this.field)) {
			if (this.limiting) {
				debug("Not modifying because ratelimiting is on");
				delete values[this.field];
			}
			else {
				debug("Turning on ratelimiting timer");
				this.timer_on();
			}
		}

		super.modify(values);
	}

	timer_on() {
		this.clear_callback();

		this.limiting = true;

		this.current_callback = setTimeout(() => this.timer_off(), this.ratelimit).unref();
	}

	timer_off() {
		this.clear_callback();

		this.limiting = false;
	}

	clear_callback() {

		if (this.current_callback) {
			clearTimeout(this.current_callback);
			this.current_callback = null;
		}
	}
}

export class Flasher extends Device {
	constructor(name, device) {
		super(name);
		debug("Created Flasher", name);
		this.device = device;
		this.flash_interval_id = null;
	}

	start(period, initial_state) {

		let flipflop = !!initial_state;

		this.flash_interval_id = setInterval(() => {
			this.device.modify({ power: flipflop });
			flipflop = !flipflop;
		}, period / 2).unref();

	}

	stop(final_state) {

		if (this.flash_interval_id) {
			clearInterval(this.flash_interval_id);
			this.flash_interval_id = null;
			this.device.modify({ power: !!final_state });
		}
	}

	flash_once(period, initial_state) {

		let flipflop = !!initial_state;

		this.modify({ power: flipflop });

		setTimeout(() => {
			flipflop = !flipflop;
			this.device.modify({ power: flipflop });
		},
			period / 2).unref();

	}
}

export class KeepAlive extends Device {
	constructor(name, period) {
		super(name);
		this.interval_id = null;
		this.period = period;

		this.on('change_enable', (new_value) => {
			if (new_value) {
				this.start();
			}
			else {
				this.stop();
			}
		});
	}

	start() {
		this.stop();
		this.interval_id = setInterval(() => {
			this.send_keep_alive();
		}, this.period).unref();
	}

	stop() {
		if (this.interval_id) {
			clearInterval(this.interval_id);
			this.interval_id = null;
		}
	}

	send_keep_alive() {
		this.transmitters.forEach((transmitter) => transmitter.send(""));
		this.configurators.forEach((configurator) => configurator.configure());
	}
}
