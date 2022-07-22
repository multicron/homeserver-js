
'use strict';

import logger from "debug"; const debug = logger('homeserver:xcvr:mqtt');
const debug_ignore = logger('homeserver:xcvr:ignore');
import mqtt from "mqtt";
import { QoS } from "mqtt-packet";
import uuid from "uuid";
import { parse_json } from "@homeserver-js/utils";


import {
    Receiver,
    Transmitter,
    Configurator
} from "@homeserver-js/transceiver-js";

export class MQTTConfigurator extends Configurator {
    mqtt_client: mqtt.MqttClient;
    constructor(public broker: string, public topic: string, public value: any) {
        super();
        this.mqtt_client = mqtt.connect(this.broker, { clientId: "MQTTConfigurator_" + uuid.v4() });
    }

    configure() {
        if (this.mqtt_client && this.topic) {
            let options = {
                qos: 0 as QoS,
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
    protected mqtt_client;
    constructor(protected broker: string,
        protected field: string,
        protected topic: string) {
        super();
        this.mqtt_client = mqtt.connect(this.broker, { clientId: "MQTTTransmitter_" + uuid.v4() });
    }

    state_change(field: string, new_value: any, old_value: any) {
        if (this.field === field) {
            this.send(new_value);
        }
    }

    send(value: any) {
        if (this.mqtt_client && this.topic) {
            let options: mqtt.IClientPublishOptions = {
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
    protected mqtt_client: mqtt.MqttClient;
    protected ignore_count: number;

    constructor(
        protected broker: string,
        protected field: string | null,
        protected topic: string,
        protected qos: QoS = 0
    ) {
        super();
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

    receive_mqtt_msg(topic: string, message: string) {
        debug(`Received unhandled message "${message}" from topic ${topic}`);
    }

    ignore_first(how_many: number) {
        debug_ignore("Ignore count set to", how_many);
        this.ignore_count = how_many || 0;
        return this;
    }
}

export class MQTTBooleanReceiver extends MQTTReceiver {
    protected inverted: boolean;
    protected true_regexp: RegExp;
    protected false_regexp: RegExp;
    constructor(
        protected broker: string,
        protected field: string,
        protected topic: string,
        protected qos: QoS = 0) {
        super(broker, field, topic, qos);
        this.true_regexp = new RegExp('^\s*(true|1|yes|on)\s*$', 'i');
        this.false_regexp = new RegExp('^\s*(false|0|no|off)\s*$', 'i');
        this.inverted = false;
    }

    booleanize(value: string, invert: boolean = false): boolean | null {
        if (this.true_regexp.test(value)) { return (invert ? false : true); }
        if (this.false_regexp.test(value)) { return (invert ? true : false); }
        return null;
    }

    receive_mqtt_msg(topic: string, message: string) {
        let values: { [index: string]: boolean } = {};
        let boolean_or_null = this.booleanize(message, this.inverted);
        if (boolean_or_null !== null) {
            values[this.field] = boolean_or_null;
            this.owner.receive(this, values);
        }
    }

    invert(flag: boolean) {
        this.inverted = flag ? true : false;
        return this;
    }
}

export class MQTTVerifiedBooleanReceiver extends MQTTBooleanReceiver {
    private ignore_transition_from_null: boolean = false;
    private last_value: boolean | null;
    constructor(
        protected broker: string,
        protected field: string,
        protected topic: string,
        protected qos: QoS = 0) {
        super(broker, field, topic, qos);
        this.last_value = null;
    }

    receive_mqtt_msg(topic: string, message: string) {
        let received_value = this.booleanize(message, this.inverted);
        if (received_value !== this.last_value) {
            // TODO: This is pretty confused logic!
            if (this.last_value === null) {
                this.last_value = received_value;
                return;
            }
            this.last_value = received_value;
            let values: { [index: string]: any } = {};
            values[this.field] = received_value;
            this.owner.receive(this, values);
        }
    }

    ignore_first(how_many: number | null) {
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
    constructor(
        protected broker: string,
        protected field: string,
        protected topic: string,
        protected required_message: string | number) {
        super(broker, field, topic);
    }

    // When the messages is received, the Boolean value of the field
    // in the owner's state is complemented if the required_message
    // is received as the message (or required_message was not specified).

    receive_mqtt_msg(topic: string, message: string) {
        if (this.required_message === undefined || this.required_message === "" || this.required_message == message) {
            let delta = { [this.field]: !this.owner.state()[this.field] };
            this.owner.receive(this, delta);
        }
    }
}

export class MQTTValueReceiver extends MQTTReceiver {
    constructor(
        protected broker: string,
        protected field: string,
        protected topic: string) {
        super(broker, field, topic);
    }

    receive_mqtt_msg(topic: string, message: string) {
        let delta: { [index: string]: any } = {};
        delta[this.field] = message;
        this.owner.receive(this, delta);
    }
}

export class MQTTJSONReceiver extends MQTTReceiver {
    constructor(
        protected broker: string,
        protected field: string,
        protected topic: string) {
        super(broker, field, topic);
    }

    receive_mqtt_msg(topic: string, message: string) {
        let values: { [index: string]: any } = {};

        let data = parse_json(message);

        values[this.field] = data

        this.owner.receive(this, values);
    }
}

export class MQTTAlexaReceiver extends MQTTReceiver {
    constructor(broker: string) {
        super(broker, null, "alexa/#");
    }

    receive_mqtt_msg(topic: string, message: string) {
        this.owner.receive(this, { topic: topic, message: message });
    }
}

export class MQTTEverythingReceiver extends MQTTReceiver {
    constructor(broker: string) {
        super(broker, null, "#");
    }

    receive_mqtt_msg(topic: string, message: string) {
        this.owner.receive(this, { topic: topic, message: message });
    }
}

export class MQTTSystemReceiver extends MQTTReceiver {
    constructor(broker: string) {
        super(broker, null, "$SYS/#");
    }

    receive_mqtt_msg(topic: string, message: string) {
        this.owner.receive(this, { topic: topic, message: message });
    }
}

export class MQTTSubscribersReceiver extends MQTTReceiver {
    constructor(broker: string) {
        super(broker, null, "$SYS/+/new/subscribes");
    }

    receive_mqtt_msg(topic: string, message: string) {
        this.owner.receive(this, { topic: topic, message: message });
    }
}

// Triggers configuration of the owner Device when the specified topic is received

export class MQTTTopicConfTrigger extends MQTTReceiver {
    constructor(broker: string, topic: string) {
        super(broker, null, topic);
    }

    receive_mqtt_msg(topic: string, message: string) {
        this.owner.configure();
    }
}

export class MQTTConfTriggerPoll extends MQTTReceiver {
    private interval_id: NodeJS.Timer | null = null;
    private configure_run: boolean = false;
    private poll_transmitter: MQTTTransmitter;

    constructor(
        protected broker: string,
        protected receive_topic: string,
        protected poll_topic: string,
        protected poll_value: string,
        protected poll_period: number,
        protected poll_timeout: number) {

        super(broker, null, receive_topic);

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

    start(poll_period: number) {

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


    receive_mqtt_msg(receive_topic: string, message: string) {
        // If we receive the expected response, stop the timer and run the configurators
        // for the Device this is owned by.  this.owner.configure() is only ever called once
        // by this Transceiver.

        this.stop();

        if (!this.configure_run) {
            this.configure_run = true;
            this.owner.configure();
        }
    }
}

export class MQTTBooleanTransmitter extends MQTTTransmitter {
    constructor(
        protected broker: string,
        protected field: string,
        protected topic: string,
        protected on_value: string | number,
        protected off_value: string | number) {
        super(broker, field, topic);
    }

    send(value: boolean) {
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
    constructor(
        broker: string,
        field: string,
        topic: string) {
        super(broker, field, topic);
    }

}

export class MQTTShellyRelayTransmitter extends MQTTBooleanTransmitter {
    constructor(
        broker: string,
        topic: string
    ) {
        super(broker, "power", topic, "on", "off");
    }
}

export class MQTTShellySwitchReceiver extends MQTTBooleanReceiver {
    constructor(
        broker: string,
        topic: string
    ) {
        super(broker, "power", topic);
    }
}
