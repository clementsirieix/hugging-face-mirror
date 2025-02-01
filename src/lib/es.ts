import { Client } from "@elastic/elasticsearch";

import { env } from "./env";

let client: Client | null = null;

export type ModelIndex = {
    jobId: string;
    modelId: string;
    readme: string;
};

export function connectToElasticsearch() {
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
    if (!client) {
        throw new Error("Elasticsearch client is not connected");
    }
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
                    },
                },
            },
        });
    }
}

export async function esSearch<T>(
    client: Client,
    index: string,
    query: string,
    limit: number,
    skip: number,
    filter: Record<string, unknown>
): Promise<T[]> {
    if (!client) {
        throw new Error("Elasticsearch client is not connected");
    }
    const response = await client.search<T>({
        index,
        from: skip,
        size: limit,
        query: {
            bool: {
                must: {
                    multi_match: {
                        query,
                        fields: ["readme"],
                    },
                },
                filter: {
                    term: filter,
                },
            },
        },
    });

    return response.hits.hits.map((hit) => hit._source).filter((hit) => !!hit) as T[];
}
