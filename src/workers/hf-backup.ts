import { workerData } from "worker_threads";
import { ObjectId } from "mongodb";
import { connectToDatabase } from "../lib/db";
import { env } from "../lib/env";
import { fetchModels, retryWithBackoff } from "../lib/hf-api";
import { sleep } from "../utils/time";
import { connectToQueue, sendEvent } from "../lib/queue";
import { ModelPosition } from "../types";
import { connectToElasticsearch } from "../lib/es";

export async function run() {
    console.log("Backup job started");
    const sqsClient = connectToQueue();
    const esClient = connectToElasticsearch();
    const jobId = workerData?.jobId;

    if (typeof jobId !== "string") {
        throw new Error("jobId is required");
    }

    const db = await connectToDatabase();
    const modelPositionsCollection = db.collection<ModelPosition>("model_positions");

    await modelPositionsCollection.createIndexes([
        {
            key: { jobId: 1, trendingScore: -1 },
            name: "job_trending_score_idx",
        },
    ]);

    let cursor: string | undefined = undefined;
    let count = 0;

    while (count < env.trendingModelsTotal) {
        const { data, nextCursor } = await retryWithBackoff(() =>
            fetchModels({
                cursor,
                limit: env.trendingModelsBatchSize,
                sort: "trendingScore",
                direction: -1,
            })
        );
        const modelPositionOperations = data.map((model) => {
            if (model.gated === false) {
                sendEvent(sqsClient, { modelId: model.id, jobId });
            }
            return {
                updateOne: {
                    filter: {
                        jobId: new ObjectId(jobId),
                        "model.id": model.id,
                    },
                    update: {
                        $set: {
                            jobId: new ObjectId(jobId),
                            trendingScore: model.trendingScore,
                            model: model,
                        },
                    },
                    upsert: true,
                },
            };
        });
        await modelPositionsCollection.bulkWrite(modelPositionOperations);

        await esClient.bulk({
            operations: data.flatMap((model) => [
                {
                    update: {
                        _index: "models",
                        _id: `${jobId}_${model.id}`,
                    },
                },
                {
                    doc: { jobId, modelId: model.modelId, trendingScore: model.trendingScore },
                    doc_as_upsert: true,
                },
            ]),
            refresh: true,
        });

        if (!nextCursor) {
            break;
        }
        cursor = nextCursor;
        count += data.length;

        await sleep(env.trendingModelsDelayMs);
    }

    console.log("Backup job completed");
}

if (!env.isTest) {
    run()
        .then(() => {
            process.exit(0);
        })
        .catch((error) => {
            console.error("Backup job failed:", error);
            process.exit(1);
        });
}
