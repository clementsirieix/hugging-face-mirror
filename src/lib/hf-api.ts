import { ObjectId } from "mongodb";
import { sleep } from "../utils/time";
import { env } from "./env";

type PaginatedResponse<T> = {
    data: T[];
    nextCursor: string | null;
};

export type Model = {
    _id: ObjectId;
    id: string;
    author: string;
    gated: boolean | string;
    inference: string;
    likes: number;
    trendingScore: number;
    private: boolean;
    sha: string;
    downloads: number;
    tags: string[];
    pipeline_tag: string;
    library_name: string;
    createdAt: string;
    modelId: string;
    siblings: Record<string, unknown>[];
};

export async function fetchModels(
    params: {
        cursor?: string;
        direction?: number;
        limit?: number;
        sort?: string;
    } = {}
): Promise<PaginatedResponse<Model>> {
    const url = new URL("https://huggingface.co/api/models");

    for (const [key, value] of Object.entries(params)) {
        if (value == null) {
            continue;
        }
        url.searchParams.set(key, value.toString());
    }
    url.searchParams.set("full", "full");

    const response = await fetch(url, {
        headers: {
            Authorization: `Bearer ${env.hfToken}`,
        },
    });
    const models = (await response.json()) as Model[];
    let nextCursor: string | null = null;

    if (response.headers.has("link")) {
        const match = response.headers.get("link")?.match(/cursor=([^&>]+)/);

        if (match != null && match[1]) {
            nextCursor = decodeURIComponent(match[1]);
        }
    }

    return { data: models, nextCursor };
}

const RETRY_CONFIG = {
    maxAttempts: 5,
    initialDelayMs: 10000,
    maxDelayMs: 3600000,
    backoffFactor: 4,
} as const;

export async function retryWithBackoff<T>(
    operation: () => Promise<T>,
    options: typeof RETRY_CONFIG = RETRY_CONFIG,
    attempt = 1
): Promise<T> {
    try {
        const result = await operation();

        if (result && typeof result === "object" && "error" in result) {
            throw new Error(result.error as any);
        }

        return result;
    } catch (error) {
        console.log(error);
        if (attempt >= options.maxAttempts) {
            throw error;
        }

        const delayMs = Math.min(
            options.initialDelayMs * Math.pow(options.backoffFactor, attempt - 1),
            options.maxDelayMs
        );

        await sleep(delayMs);

        return retryWithBackoff(operation, options, attempt + 1);
    }
}
