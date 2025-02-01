import { Client } from "@elastic/elasticsearch";

import { env } from "./env";

let client: Client | null = null;

export function connectToElasticsearch(): Client {
    if (!client) {
        client = new Client({
            node: env.esUrl,
        });
    }
    return client;
}

export function disconnectFromElasticsearch() {
    if (client) {
        client.close();
        client = null;
    }
}

export async function initMapping(client: Client) {
    if (!client) throw new Error("Elasticsearch client is not connected");
    const indexName = "models";

    if (!(await client.indices.exists({ index: indexName }))) {
        await client.indices.create({
            index: indexName,
            body: {
                mappings: {
                    properties: {
                        jobId: { type: "keyword" },
                        modelId: { type: "keyword" },
                        readme: { type: "text", analyzer: "standard" },
                        dirSize: { type: "long" },
                        trendingScore: { type: "float" },
                    },
                },
            },
        });
    }
}
