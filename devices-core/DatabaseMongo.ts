
'use strict';

import logger from "debug"; const debug = logger('homeserver:database:ble');

import util from "util";

import mongodb from "mongodb";

const { MongoClient } = mongodb;

import {
    Database,
} from "@homeserver-js/device-js";

export class DatabaseMongo extends Database {
    protected client: any;
    protected db: any;

    constructor(
        public name: string,
        protected uri: string,
        protected db_name: string,
        protected collection: string,
        protected username?: string,
        protected password?: String
    ) {
        super(name);

        this.uri = uri;
        this.db_name = db_name;
        this.collection = collection;
        this.db = undefined;

        this.connect();

    }

    insert_document(data: any) {
        if (this.db) {
            this.db.collection(this.collection).insertOne(data);
        }
        else {
            debug("this.db is not ready for inserts");
        }
    }

    async connect() {
        this.client = new MongoClient(this.uri);

        await this.client.connect();

        await this.client.db("admin").command({ ping: 1 });

        debug("Connected to MongoDB");

        let db = await this.client.db(this.db_name);

        debug("Connected to MongoDB db", util.inspect(db, false, 3));

        this.db = db;

        return db;

    }
}
