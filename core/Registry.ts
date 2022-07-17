
'use strict';

import logger from "debug"; const debug = logger('homeserver:registry');
import EventEmitter from "events";
import { Section } from "./Section";

/**
 * A class to use to group other code together while still allowing references
 * from one Registry entry to another.
 *
 * @export
 * @class Registry
 */

export class Registry extends EventEmitter {
    private sections: Section[] = [];
    [index: string]: any;

    constructor() {
        super();

        process.on('SIGINT', () => this.handle_signal('SIGINT'));
        process.on('SIGTERM', () => this.handle_signal('SIGTERM'));
        process.on('SIGHUP', () => this.handle_signal('SIGHUP'));
    }

    handle_signal(signal: any) {
        console.log("Got signal", signal);
        this.emit(signal, signal);
        this.close();
        console.log("Waiting 10 seconds for process to terminate");
        setTimeout(() => {
            console.log("Process exiting");
            process.exit(1);
        }, 10000);
    }

    add(name: string, item: Section) {
        if (!(item instanceof Section)) {
            throw (new Error("Only add Sections to Registry"));
        }
        this[name] = item;
        this.sections.push(item);

        return item;
    }

    close() {
        this.sections.forEach((item) => {
            item.close();
        });
    }

    remove(name: string) {
        let old_value = this[name];
        delete this[name];
        return old_value;
    }
}

