
'use strict';

import { StatePublisher } from "./State.js";
import { Section } from "./Section.js";

import logger from "debug"; const debug = logger('homeserver:stateupdater');

/**
 * This section runs last during startup and restores the state from the
 * previous run.
 *
 * @export
 * @class StatePersistence
 */
export class StatePersistence extends Section {
    constructor(registry) {
        super(registry);

        this.stateholder = new StatePublisher();

        // The state store is saved periodically into a file.  Here we load
        // the state back in, to resume where we left off.

        this.stateholder.load_state_store(registry.Configuration.state_store_file);

        // We periodically send the whole state out via MQTT as a retained
        // message so that newly created subscribers will see it.

        // this.stateholder.periodically_publish_state_store(30000);

        // We also send the initial state loaded above out immediately.

        this.stateholder.publish_state_store();

        // And here we setup the periodic saving of the state store into the file
        // so that it can be reloaded on restart.

        this.stateholder.periodically_save_state_store(registry.Configuration.state_store_file, 1000);
    }
}

