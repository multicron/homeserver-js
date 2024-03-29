
'use strict';

import logger from "debug"; const debug = logger('homeserver:xcvr:mqtt');
const debug_ignore = logger('homeserver:xcvr:ignore');
import mqtt from "mqtt";
import uuid from "uuid";
import { parse_json } from "@homeserver-js/utils";


import {
    Receiver,
    Transmitter,
    Configurator
} from "@homeserver-js/tranceiver-js";

export class MQTTConfigurator extends Configurator {
    constructor(broker, topic, value) {
        super();
        this.broker = broker;
        this.topic = topic;
        this.value = value;
        this.mqtt_client = mqtt.connect(this.broker, { clientId: "MQTTConfigurator_" + uuid.v4() });
    }

    configure() {
        if (this.mqtt_client && this.topic) {
            let options = {
                qos: 0,
                retain: false,
                dup: false
            };

            this.mqtt_client.publish(this.topic, this.value.toString(), options, () => {
                debug(`Sent ${this.value.toString()} to ${this.topic}`);
            });
        }
    }
}

export class MQTTTransmitter extends Transmitter {
    constructor(broker, field, topic) {
        super();
        this.broker = broker;
        this.topic = topic;
        this.field = field;
        this.mqtt_client = mqtt.connect(this.broker, { clientId: "MQTTTransmitter_" + uuid.v4() });
    }

    state_change(field, new_value, old_value) {
        if (this.field === field) {
            this.send(new_value);
        }
    }

    send(value) {
        if (this.mqtt_client && this.topic) {
            let options = {
                qos: 0,
                retain: false,
                dup: false
            };

            this.mqtt_client.publish(this.topic, value.toString(), options, () => {
                debug(`Sent ${value.toString()} to ${this.topic}`);
            });
        }
    }
}

export class MQTTReceiver extends Receiver {
    constructor(broker, field, topic, qos) {
        super();
        this.true_regexp = new RegExp('^\s*(true|1|yes|on)\s*$', 'i');
        this.false_regexp = new RegExp('^\s*(false|0|no|off)\s*$', 'i');
        this.broker = broker;
        this.topic = topic;
        this.qos = qos || 0;
        this.field = field;
        this.mqtt_client = mqtt.connect(broker, { clientId: "MQTTReceiver_" + uuid.v4() });
        this.ignore_count = 0;

        this.mqtt_client.on('connect', () => {
            this.mqtt_client.subscribe(topic, { qos: this.qos }, (err) => {
                if (err) {
                    debug(`Error subscribing to topic "${topic}": ${err}`);
                }
            });
        });

        this.mqtt_client.on('message', (topic, message) => {
            if (this.ignore_count) {
                debug_ignore(`Ignoring mqtt ${topic} ${message} because of ignorecount ${this.ignore_count}`);
                this.ignore_count--;
            }
            else {
                this.receive_mqtt_msg(topic, message.toString());
            }
        });
    }

    booleanize(value, invert) {
        if (this.true_regexp.test(value)) { return (invert ? false : true); }
        if (this.false_regexp.test(value)) { return (invert ? true : false); }
        return null;
    }

    receive_mqtt_msg(topic, message) {
        debug(`Received unhandled message "${message}" from topic ${topic}`);
    }

    ignore_first(how_many) {
        debug_ignore("Ignore count set to", how_many);
        this.ignore_count = how_many || 0;
        return this;
    }
}

export class MQTTBooleanReceiver extends MQTTReceiver {
    constructor(broker, field, topic, qos) {
        super(broker, field, topic, qos);
        this.true_regexp = new RegExp('^\s*(true|1|yes|on)\s*$', 'i');
        this.false_regexp = new RegExp('^\s*(false|0|no|off)\s*$', 'i');
        this.inverted = false;
    }

    receive_mqtt_msg(topic, message) {
        let values = {};
        values[this.field] = this.booleanize(message, this.inverted);
        this.owner.receive(this, values);
    }

    invert(flag) {
        this.inverted = flag ? true : false;
        return this;
    }
}

export class MQTTVerifiedBooleanReceiver extends MQTTBooleanReceiver {
    constructor(broker, field, topic, qos) {
        super(broker, field, topic, qos);
        this.last_value = null;
    }

    receive_mqtt_msg(topic, message) {
        let received_value = this.booleanize(message, this.inverted);
        if (received_value !== this.last_value) {
            if (this.last_value === null) {
                this.last_value = received_value;
                return;
            }
            this.last_value = received_value;
            let values = {};
            values[this.field] = received_value;
            this.owner.receive(this, values);
        }
    }

    ignore_first(how_many) {
        if (how_many === null) {
            debug_ignore("Ignore_transition_from_null set");
            this.ignore_transition_from_null = true;
            return this;
        }
        else {
            return super.ignore_first(how_many);
        }
    }
}

export class MQTTFlipFlopReceiver extends MQTTReceiver {
    constructor(broker, field, topic, required_message) {
        super(broker, field, topic);

        this.required_message = required_message;
    }

    // When the messages is received, the Boolean value of the field
    // in the owner's state is complemented if the required_message
    // is received as the message (or required_message was not specified).

    receive_mqtt_msg(topic, message) {
        if (this.required_message === undefined || this.required_message == message) {
            let values = { [this.field]: !this.owner.state()[this.field] };
            this.owner.receive(this, values);
        }
    }
}

export class MQTTValueReceiver extends MQTTReceiver {
    constructor(broker, field, topic) {
        super(broker, field, topic);
    }

    receive_mqtt_msg(topic, message) {
        let values = {};
        values[this.field] = message;
        this.owner.receive(this, values);
    }
}

export class MQTTJSONReceiver extends MQTTReceiver {
    constructor(broker, field, topic) {
        super(broker, field, topic);
    }

    receive_mqtt_msg(topic, message) {
        let values = {};

        let data = parse_json(message);

        values[this.field] = data

        this.owner.receive(this, values);
    }
}

export class MQTTAlexaReceiver extends MQTTReceiver {
    constructor(broker) {
        super(broker, null, "alexa/#");
    }

    receive_mqtt_msg(topic, message) {
        this.owner.receive(this, { topic: topic, message: message });
    }
}

export class MQTTEverythingReceiver extends MQTTReceiver {
    constructor(broker) {
        super(broker, null, "#");
    }

    receive_mqtt_msg(topic, message) {
        this.owner.receive(this, { topic: topic, message: message });
    }
}

export class MQTTSystemReceiver extends MQTTReceiver {
    constructor(broker) {
        super(broker, null, "$SYS/#");
    }

    receive_mqtt_msg(topic, message) {
        this.owner.receive(this, { topic: topic, message: message });
    }
}

export class MQTTSubscribersReceiver extends MQTTReceiver {
    constructor(broker) {
        super(broker, null, "$SYS/+/new/subscribes");
    }

    receive_mqtt_msg(topic, message) {
        this.owner.receive(this, { topic: topic, message: message });
    }
}

// This only works with the built-in mqtt server; mosquitto doesn't publish this topic

export class MQTTClientConfTrigger extends MQTTReceiver {
    constructor(broker, client_name) {
        super(broker, null, "$SYS/+/new/clients");
        this.client_name = client_name;
    }

    receive_mqtt_msg(topic, message) {
        if (message === this.client_name) {
            this.owner.configure();
        }
    }
}

// Triggers configuration of the owner Device when the specified topic is received

export class MQTTTopicConfTrigger extends MQTTReceiver {
    constructor(broker, topic) {
        super(broker, null, topic);
    }

    receive_mqtt_msg(topic, message) {
        this.owner.configure();
    }
}

export class MQTTConfTriggerPoll extends MQTTReceiver {
    constructor(broker, receive_topic, poll_topic, poll_value, poll_period, poll_timeout) {
        super(broker, null, receive_topic);

        this.interval_id = null;
        this.poll_topic = poll_topic;
        this.poll_value = poll_value;
        this.configure_run = false;

        // A separate Transmitter to send the MQTT poll to the device

        this.poll_transmitter = new MQTTTransmitter(broker, 'unused', poll_topic);

        // Don't keep polling forever unless poll_timeout is specifically set to 0

        if (poll_timeout === undefined) {
            poll_timeout = poll_period * 50;
        }

        if (poll_timeout > 0) {
            setTimeout(() => this.stop(), poll_timeout).unref();
        }

        // You can specify the period in the call or call .start(poll_period)

        if (poll_period) {
            this.start(poll_period);
        }
    }

    start(poll_period) {

        // Can only have one timer going at a time

        this.stop();

        // Send the MQTT poll every n seconds, until stop() is called

        this.poll_period = poll_period;

        this.interval_id = setInterval(() => {
            this.send_poll();
        }, this.poll_period).unref();

        return this;
    }

    stop() {
        // Clear the timer, if set

        if (this.interval_id) {
            clearInterval(this.interval_id);
            this.interval_id = null;
        }

        return this;
    }

    send_poll() {
        // Send a single MQTT poll

        this.poll_transmitter.send(this.poll_value);
    }


    receive_mqtt_msg(receive_topic, message) {
        // If we receive the expected response, stop the timer and run the configurators
        // for the Device this is owned by.  this.owner.configure() is only ever called once
        // by this Tranceiver.

        this.stop();

        if (!this.configure_run) {
            this.configure_run = true;
            this.owner.configure();
        }
    }
}

export class MQTTBooleanTransmitter extends MQTTTransmitter {
    constructor(broker, field, topic, on_value, off_value) {
        super(broker, field, topic);
        this.on_value = on_value;
        this.off_value = off_value;
    }

    send(value) {
        debug(`MQTTBooleanTransmitter.send() got ${value}`);
        if (value) {
            super.send(this.on_value);
        }
        else {
            super.send(this.off_value);
        }
    }
}

export class MQTTValueTransmitter extends MQTTTransmitter {
    constructor(broker, field, topic) {
        super(broker, field, topic);
    }

}

export class MQTTShellyRelayTransmitter extends MQTTBooleanTransmitter {
    constructor(broker, topic) {
        super(broker, "power", topic, "on", "off");
    }
}

export class MQTTShellySwitchReceiver extends MQTTBooleanReceiver {
    constructor(broker, topic) {
        super(broker, "power", topic);
    }
}
