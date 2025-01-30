import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { Db, ObjectId } from "mongodb";
import { connectToDatabase } from "../lib/db";
import { fetchModels, Model } from "../lib/hf-api";
import { sleep } from "../utils/time";

vi.mock("worker_threads", () => ({
    workerData: {
        jobId: "507f1f77bcf86cd799439011",
    },
}));

vi.mock("../lib/db", () => ({
    connectToDatabase: vi.fn(),
}));

vi.mock("../lib/env", async () => {
    const { env } = await vi.importActual("../lib/env");

    return {
        env: {
            ...(env as Record<string, unknown>),
            trendingModelsTotal: 100,
            trendingModelsBatchSize: 50,
            trendingModelsDelayMs: 2000,
        },
    };
});

vi.mock("../lib/hf-api", () => ({
    fetchModels: vi.fn(),
    retryWithBackoff: vi.fn((fn) => fn()),
}));

vi.mock("../utils/time", () => ({
    sleep: vi.fn(),
}));

vi.spyOn(process, "exit").mockImplementation(() => undefined as never);

describe("Backup Job", () => {
    const mockModelPositionsCollection = {
        createIndexes: vi.fn(),
        bulkWrite: vi.fn(),
    };

    const mockDb = {
        collection: vi.fn((name) => {
            if (name === "model_positions") {
                return mockModelPositionsCollection;
            }
            return null;
        }),
    } as unknown as Db;

    beforeEach(() => {
        vi.clearAllMocks();

        vi.mocked(connectToDatabase).mockResolvedValue(mockDb);
        vi.mocked(fetchModels).mockResolvedValue({
            data: [],
            nextCursor: null,
        });
    });

    afterEach(() => {
        vi.clearAllMocks();
    });

    it("should create required indexes", async () => {
        const { run } = await import("./hf-backup");

        await run();

        expect(mockModelPositionsCollection.createIndexes).toHaveBeenCalledWith([
            {
                key: { jobId: 1, trendingScore: -1 },
                name: "job_trending_score_idx",
            },
        ]);
    });

    it("should process models in batches", async () => {
        const mockModels = [
            { id: "model1", trendingScore: 100 },
            { id: "model2", trendingScore: 90 },
        ] as Model[];

        vi.mocked(fetchModels)
            .mockResolvedValueOnce({
                data: mockModels,
                nextCursor: "next-page",
            })
            .mockResolvedValueOnce({
                data: [],
                nextCursor: null,
            });

        const { run } = await import("./hf-backup");
        await run();

        expect(mockModelPositionsCollection.bulkWrite).toHaveBeenCalledWith(
            mockModels.map((model) => ({
                updateOne: {
                    filter: {
                        jobId: new ObjectId("507f1f77bcf86cd799439011"),
                        "model.id": model.id,
                    },
                    update: {
                        $set: {
                            jobId: new ObjectId("507f1f77bcf86cd799439011"),
                            trendingScore: model.trendingScore,
                            model: model,
                        },
                    },
                    upsert: true,
                },
            }))
        );
        expect(sleep).toHaveBeenCalled();
    });

    it("should stop when reaching trendingModelTotal", async () => {
        const mockModels = Array(60)
            .fill(null)
            .map((_, i) => ({
                id: `model${i}`,
                trendingScore: 100 - i,
            })) as Model[];

        vi.mocked(fetchModels)
            .mockResolvedValueOnce({
                data: mockModels.slice(0, 50),
                nextCursor: "next-page",
            })
            .mockResolvedValueOnce({
                data: mockModels.slice(50),
                nextCursor: "another-page",
            });

        const { run } = await import("./hf-backup");
        await run();

        expect(fetchModels).toHaveBeenCalledTimes(3);
    });
});
