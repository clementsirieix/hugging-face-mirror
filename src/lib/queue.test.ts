import * as matchers from "aws-sdk-client-mock-jest";
import "aws-sdk-client-mock-jest/vitest";
import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";
import { mockClient } from "aws-sdk-client-mock";
import {
    SQS,
    SendMessageCommand,
    ReceiveMessageCommand,
    DeleteMessageCommand,
} from "@aws-sdk/client-sqs";
import { Worker } from "worker_threads";
import {
    connectToQueue,
    disconnectFromQueue,
    sendEvent,
    receiveEvent,
    deleteEvent,
    startConsumerWorkers,
    stopWorkers,
} from "./queue";
import { env } from "./env";

expect.extend(matchers);

vi.mock("worker_threads", () => ({
    Worker: vi.fn(),
}));

describe("queue", () => {
    const sqsMock = mockClient(SQS);
    const testQueueUrl = "https://test-queue-url";
    vi.mocked(Worker).mockImplementation(
        () =>
            ({
                on: vi.fn(),
                terminate: vi.fn(),
            }) as unknown as Worker
    );

    beforeEach(() => {
        sqsMock.reset();
        vi.clearAllMocks();
        env.sqsQueueUrl = testQueueUrl;
        env.sqsEndpoint = "http://localhost:4566";
        env.sqsRegion = "us-east-1";
        env.sqsAccessKeyId = "test";
        env.sqsSecretAccessKey = "test";
        env.isDev = true;
    });

    afterEach(() => {
        disconnectFromQueue();
        stopWorkers();
    });

    describe("connectToQueue", () => {
        it("should create a new SQS client on first connection", () => {
            const client = connectToQueue();
            expect(client).toBeDefined();
        });

        it("should reuse existing client on subsequent connections", () => {
            const client1 = connectToQueue();
            const client2 = connectToQueue();
            expect(client1).toBe(client2);
        });
    });

    describe("sendEvent", () => {
        it("should send message successfully", async () => {
            sqsMock.on(SendMessageCommand).resolves({
                MessageId: "test-message-id",
            });

            const client = connectToQueue();
            const payload = { test: "data" };
            const result = await sendEvent(client, payload);

            expect(result.MessageId).toBe("test-message-id");
            expect(sqsMock).toHaveReceivedCommandWith(SendMessageCommand, {
                QueueUrl: testQueueUrl,
                MessageBody: JSON.stringify(payload),
            });
        });

        it("should throw error when client is not connected", async () => {
            await expect(sendEvent(null as unknown as SQS, {})).rejects.toThrow(
                "Queue client is not connected"
            );
        });

        it("should handle send errors", async () => {
            sqsMock.on(SendMessageCommand).rejects(new Error("Send failed"));

            const client = connectToQueue();
            await expect(sendEvent(client, {})).rejects.toThrow("Send failed");
        });
    });

    describe("receiveEvent", () => {
        it("should receive message successfully", async () => {
            const testMessage = {
                Messages: [
                    {
                        MessageId: "test-message-id",
                        Body: JSON.stringify({ test: "data" }),
                        ReceiptHandle: "test-receipt",
                    },
                ],
            };

            sqsMock.on(ReceiveMessageCommand).resolves(testMessage);

            const client = connectToQueue();
            const result = await receiveEvent(client);

            expect(result).toEqual(testMessage);
            expect(sqsMock).toHaveReceivedCommandWith(ReceiveMessageCommand, {
                QueueUrl: testQueueUrl,
                MaxNumberOfMessages: 1,
                WaitTimeSeconds: 20,
            });
        });

        it("should throw error when client is not connected", async () => {
            await expect(receiveEvent(null as unknown as SQS)).rejects.toThrow(
                "Queue client is not connected"
            );
        });

        it("should handle receive errors", async () => {
            sqsMock.on(ReceiveMessageCommand).rejects(new Error("Receive failed"));

            const client = connectToQueue();
            await expect(receiveEvent(client)).rejects.toThrow("Receive failed");
        });
    });

    describe("deleteEvent", () => {
        it("should delete message successfully", async () => {
            sqsMock.on(DeleteMessageCommand).resolves({});

            const client = connectToQueue();
            const receiptHandle = "test-receipt";
            await deleteEvent(client, receiptHandle);

            expect(sqsMock).toHaveReceivedCommandWith(DeleteMessageCommand, {
                QueueUrl: testQueueUrl,
                ReceiptHandle: receiptHandle,
            });
        });

        it("should throw error when client is not connected", async () => {
            await expect(deleteEvent(null as unknown as SQS, "test")).rejects.toThrow(
                "Queue client is not connected"
            );
        });

        it("should handle delete errors", async () => {
            sqsMock.on(DeleteMessageCommand).rejects(new Error("Delete failed"));

            const client = connectToQueue();
            await expect(deleteEvent(client, "test")).rejects.toThrow("Delete failed");
        });
    });

    describe("startConsumerWorkers", () => {
        it("should start the specified number of workers", () => {
            const numberOfWorkers = 2;
            const fileName = "test-worker.js";

            startConsumerWorkers(fileName, numberOfWorkers);

            expect(Worker).toHaveBeenCalledTimes(numberOfWorkers);
            for (let i = 0; i < numberOfWorkers; i++) {
                expect(Worker).toHaveBeenCalledWith(
                    `require('ts-node/register'); require('${fileName}');`,
                    {
                        eval: true,
                        workerData: { workerId: i },
                    }
                );
            }
        });

        it("should terminate existing workers before starting new ones", () => {
            const mockTerminate = vi.fn();
            vi.mocked(Worker).mockImplementation(
                () =>
                    ({
                        on: vi.fn(),
                        terminate: mockTerminate,
                    }) as unknown as Worker
            );

            startConsumerWorkers("test.js");
            startConsumerWorkers("test.js");

            expect(mockTerminate).toHaveBeenCalled();
        });

        it("should set up event listeners for each worker", () => {
            const mockOn = vi.fn();
            vi.mocked(Worker).mockImplementation(
                () =>
                    ({
                        on: mockOn,
                        terminate: vi.fn(),
                    }) as unknown as Worker
            );

            startConsumerWorkers("test.js", 1);

            expect(mockOn).toHaveBeenCalledWith("message", expect.any(Function));
            expect(mockOn).toHaveBeenCalledWith("error", expect.any(Function));
            expect(mockOn).toHaveBeenCalledWith("exit", expect.any(Function));
        });
    });
});
