import { mkdir, readFile, rm } from "fs/promises";
import { exec } from "child_process";
import { promisify } from "util";
import dayjs from "dayjs";
import { connectToStorage, downloadFolder, uploadFolder } from "../lib/storage";
import { env } from "../lib/env";
import { connectToQueue, deleteEvent, receiveEvent } from "../lib/queue";
import { workerData } from "worker_threads";
import { retryWithBackoff } from "../lib/hf-api";
import { sleep } from "../utils/time";
import { connectToElasticsearch } from "../lib/es";
import path from "path";

const execAsync = promisify(exec);

export async function upsertModel({ modelId, jobId }: { modelId: string; jobId: string }) {
    const s3 = connectToStorage();
    const esClient = connectToElasticsearch();
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
            await downloadFolder(s3, env.s3BucketName, modelId, tempDir);

            const { stdout: oldHash } = await execAsync("git rev-parse HEAD", { cwd: tempDir });
            await execAsync("git remote update", { cwd: tempDir });
            await execAsync("git reset --hard origin/main", { cwd: tempDir });
            await execAsync("GIT_LFS_SKIP_SMUDGE=1 git pull origin main", { cwd: tempDir });
            const { stdout: newHash } = await execAsync("git rev-parse HEAD", { cwd: tempDir });

            if (oldHash.trim() !== newHash.trim()) {
                await s3.deleteObject({
                    Bucket: env.s3BucketName,
                    Key: modelId,
                });
                await uploadFolder(s3, env.s3BucketName, modelId, tempDir);
            }
            return;
        }
        await execAsync(`GIT_LFS_SKIP_SMUDGE=1 git clone https://huggingface.co/${modelId} .`, {
            cwd: tempDir,
        });
        await uploadFolder(s3, env.s3BucketName, modelId, tempDir);
    } catch (error) {
        console.error(`Error processing model ${modelId}:`, error);
        throw error;
    } finally {
        try {
            const readme = await readFile(path.join(tempDir, "README.md"), "utf-8");

            if (readme) {
                await esClient.index({
                    index: "models",
                    id: `${jobId}_${modelId}`,
                    document: {
                        jobId,
                        modelId,
                        readme,
                    },
                    refresh: true,
                });
            }
            await rm(tempDir, { recursive: true, force: true });
        } catch (error) {
            console.error("Error during cleanup:", error);
        }
    }
}

async function run() {
    const sqsClient = connectToQueue();
    const { workerId } = workerData;
    console.log(`Worker ${workerId} started`);

    while (true) {
        await retryWithBackoff(async () => {
            const response = await receiveEvent(sqsClient);

            if (response.Messages && response.Messages.length > 0) {
                for (const message of response.Messages) {
                    if (!message.Body || !message.ReceiptHandle) {
                        continue;
                    }
                    const body = JSON.parse(message.Body);
                    console.log(`Starting to handle model: ${body.modelId}`);
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
            console.error("Storage consumer failed:", error);
            process.exit(1);
        });
}
