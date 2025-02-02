import { mkdir, readFile, rm } from "fs/promises";
import { exec } from "child_process";
import { promisify } from "util";
import dayjs from "dayjs";
import { connectToStorage, uploadFolder } from "../lib/storage";
import { env } from "../lib/env";
import { connectToQueue, deleteEvent, receiveEvent } from "../lib/queue";
import { workerData } from "worker_threads";
import { retryWithBackoff } from "../lib/hf-api";
import { sleep } from "../utils/time";
import { connectToElasticsearch } from "../lib/es";
import path from "path";
import { connectToDatabase } from "../lib/db";
import { ModelPosition } from "../types";
import { ObjectId } from "mongodb";
import { getDirSize } from "../utils/system";
import { logger } from "../lib/logger";

const execAsync = promisify(exec);

export async function upsertModel({ modelId, jobId }: { modelId: string; jobId: string }) {
    const s3 = connectToStorage();
    const esClient = connectToElasticsearch();
    const db = await connectToDatabase();
    const modelPositionsCollection = db.collection<ModelPosition>("model_positions");
    const tempDir = `/tmp/model-${encodeURIComponent(modelId)}-${dayjs().valueOf()}`;

    try {
        await mkdir(tempDir, { recursive: true });

        const { Contents = [] } = await s3.listObjectsV2({
            Bucket: env.s3BucketName,
            Prefix: modelId,
            MaxKeys: 1,
        });
        const hasModel = Contents?.length > 0;

        if (hasModel) {
            await s3.deleteObject({
                Bucket: env.s3BucketName,
                Key: modelId,
            });
        }
        await execAsync(`GIT_LFS_SKIP_SMUDGE=1 git clone https://huggingface.co/${modelId} .`, {
            cwd: tempDir,
        });
        await uploadFolder(s3, env.s3BucketName, modelId, tempDir);
    } catch (error) {
        logger.error(`Error processing model ${modelId}:`, error);
        throw error;
    } finally {
        try {
            const dirSize = await getDirSize(tempDir);
            const readme = await readFile(path.join(tempDir, "README.md"), "utf-8");

            if (readme) {
                await esClient.update({
                    index: "models",
                    id: `${jobId}_${modelId}`,
                    doc: {
                        jobId,
                        modelId,
                        readme,
                        dirSize,
                    },
                    doc_as_upsert: true,
                    refresh: true,
                });
            }
            await modelPositionsCollection.updateOne(
                { jobId: new ObjectId(jobId), "model.modelId": modelId },
                { $set: { dirSize } }
            );
            await rm(tempDir, { recursive: true, force: true });
        } catch (error) {
            logger.error("Error during cleanup:", error);
        }
    }
}

async function run() {
    const sqsClient = connectToQueue();
    const { workerId } = workerData;
    logger.info(`Worker ${workerId} started`);

    while (true) {
        await retryWithBackoff(async () => {
            const response = await receiveEvent(sqsClient);

            if (response.Messages && response.Messages.length > 0) {
                for (const message of response.Messages) {
                    if (!message.Body || !message.ReceiptHandle) {
                        continue;
                    }
                    const body = JSON.parse(message.Body);
                    logger.info(`Starting to handle model: ${body.modelId}`);
                    await upsertModel(body);

                    await deleteEvent(sqsClient, message.ReceiptHandle);
                }
                await sleep(env.opIntervalMs);
            }
        });
    }
}

if (!env.isTest) {
    run()
        .then(() => {
            process.exit(0);
        })
        .catch((error) => {
            logger.error("Storage consumer failed:", error);
            process.exit(1);
        });
}
