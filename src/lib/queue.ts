import {
    DeleteMessageCommand,
    DeleteMessageCommandOutput,
    ReceiveMessageCommand,
    ReceiveMessageCommandOutput,
    SendMessageCommand,
    SendMessageCommandOutput,
    SQS,
} from "@aws-sdk/client-sqs";
import { Worker } from "worker_threads";
import { env } from "./env";

let client: SQS | null = null;
let workers: Worker[] = [];

export function connectToQueue(): SQS {
    if (client) {
        return client;
    }

    client = new SQS({
        endpoint: env.sqsEndpoint,
        region: env.sqsRegion,
        credentials: {
            accessKeyId: env.sqsAccessKeyId,
            secretAccessKey: env.sqsSecretAccessKey,
        },
    });

    return client;
}

export function disconnectFromQueue() {
    if (client) {
        client.destroy();
        client = null;
    }
}

export function stopWorkers() {
    for (const worker of workers) {
        worker?.terminate();
    }
}

export async function sendEvent(
    client: SQS,
    payload: Record<string, unknown>
): Promise<SendMessageCommandOutput> {
    if (!client) {
        throw new Error("Queue client is not connected");
    }

    try {
        return await client.send(
            new SendMessageCommand({
                QueueUrl: env.sqsQueueUrl,
                MessageBody: JSON.stringify(payload),
            })
        );
    } catch (error) {
        console.error("Error sending message:", error);
        throw error;
    }
}

export async function receiveEvent(client: SQS): Promise<ReceiveMessageCommandOutput> {
    if (!client) {
        throw new Error("Queue client is not connected");
    }

    try {
        return await client.send(
            new ReceiveMessageCommand({
                QueueUrl: env.sqsQueueUrl,
                MaxNumberOfMessages: 1,
                WaitTimeSeconds: 20,
            })
        );
    } catch (error) {
        console.error("Error receiving message:", error);
        throw error;
    }
}

export async function deleteEvent(
    client: SQS,
    receiptHandle: string
): Promise<DeleteMessageCommandOutput> {
    if (!client) {
        throw new Error("Queue client is not connected");
    }

    try {
        return await client.send(
            new DeleteMessageCommand({
                QueueUrl: env.sqsQueueUrl,
                ReceiptHandle: receiptHandle,
            })
        );
    } catch (error) {
        console.error("Error deleting message:", error);
        throw error;
    }
}

export function startConsumerWorkers(fileName: string, numberOfWorkers = 3) {
    for (let i = 0; i < numberOfWorkers; i++) {
        if (workers[i]) {
            workers[i].terminate();
            delete workers[i];
        }
        workers[i] = env.isDev
            ? new Worker(`require('ts-node/register'); require('${fileName}');`, {
                  eval: true,
                  workerData: { workerId: i },
              })
            : new Worker(fileName, {
                  workerData: { workerId: i },
              });

        workers[i].on("message", (message) => {
            console.log(`Worker ${i} message:`, message);
        });

        workers[i].on("error", (error) => {
            console.error(`Worker ${i} error:`, error);
        });

        workers[i].on("exit", (code) => {
            if (code !== 0) {
                console.error(`Worker ${i} stopped with exit code ${code}`);
            }
        });
    }
}
