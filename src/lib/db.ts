import { MongoClient } from "mongodb";
import { env } from "./env";

let client: MongoClient | null = null;

export async function connectToDatabase() {
    if (client) {
        return client.db(env.dbName);
    }
    client = new MongoClient(env.mongodb.uri);

    await client.connect();

    return client.db(env.dbName);
}

export async function disconnectFromDatabase() {
    if (client) {
        await client.close();
        client = null;
    }
}
