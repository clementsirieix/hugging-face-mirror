import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { Collection, Db } from "mongodb";
import { Scheduler } from "./scheduler";
import { Worker } from "worker_threads";
import dayjs from "dayjs";
import cron from "node-cron";

vi.mock("worker_threads");
vi.mock("node-cron");
vi.mock("./config", () => ({
    config: {
        isDev: false,
    },
}));

describe("Scheduler", () => {
    let mockCollection: Partial<Collection>;
    let scheduler: Scheduler;

    beforeEach(() => {
        vi.clearAllMocks();

        vi.mocked(Worker).mockImplementation(
            () =>
                ({
                    on: (event: string, callback: any) => {
                        if (event === "exit") {
                            setTimeout(() => callback(0), 0);
                        }
                    },
                    terminate: vi.fn(),
                }) as unknown as Worker
        );
        mockCollection = {
            findOne: vi.fn().mockResolvedValue(null),
            insertOne: vi.fn().mockResolvedValue({ insertedId: "test-id" }),
            updateOne: vi.fn().mockResolvedValue({}),
        };

        scheduler = new Scheduler("test-job", 300000, "test-worker.ts", {
            collection: () => mockCollection,
        } as unknown as Db);
    });

    afterEach(() => {
        vi.resetModules();
    });

    describe("start", () => {
        it("should schedule a cron job and run initial job", async () => {
            const mockSchedule = vi.fn().mockReturnValue({ stop: vi.fn() });
            vi.mocked(cron.schedule).mockImplementation(mockSchedule);

            await scheduler.start();

            expect(mockSchedule).toHaveBeenCalledWith("*/5 * * * *", expect.any(Function));
            expect(mockCollection.findOne).toHaveBeenCalled();
        });

        it("should not create multiple cron jobs", async () => {
            const mockSchedule = vi.fn().mockReturnValue({ stop: vi.fn() });
            vi.mocked(cron.schedule).mockImplementation(mockSchedule);

            await scheduler.start();
            await scheduler.start();

            expect(mockSchedule).toHaveBeenCalledTimes(1);
        });
    });

    describe("runJob", () => {
        it("should skip if previous job is pending and within interval", async () => {
            const now = dayjs();
            vi.mocked(mockCollection.findOne)?.mockResolvedValue({
                key: "test-job",
                startTime: now.toISOString(),
                status: "pending",
            });

            await scheduler.start();

            expect(mockCollection.insertOne).not.toHaveBeenCalled();
        });

        it("should skip if previous job is completed and within interval", async () => {
            const now = dayjs();
            vi.mocked(mockCollection.findOne)?.mockResolvedValue({
                key: "test-job",
                startTime: now.toISOString(),
                status: "completed",
            });

            await scheduler.start();

            expect(mockCollection.insertOne).not.toHaveBeenCalled();
        });

        it("should run job if previous job is completed but interval passed", async () => {
            const oldDate = dayjs().subtract(10, "minute");
            vi.mocked(mockCollection.findOne)?.mockResolvedValue({
                key: "test-job",
                startTime: oldDate.toISOString(),
                status: "completed",
            });
            vi.mocked(Worker).mockImplementation(
                () =>
                    ({
                        on: (event: string, cb: (...value: unknown[]) => void) => {
                            if (event === "exit") setTimeout(() => cb(0), 0);
                        },
                    }) as unknown as Worker
            );
            vi.mocked(mockCollection.insertOne)?.mockResolvedValue({
                insertedId: "test-id",
            } as any);

            await scheduler.start();

            expect(mockCollection.insertOne).toHaveBeenCalled();
            expect(mockCollection.updateOne).toHaveBeenCalledWith(
                { _id: "test-id" },
                {
                    $set: {
                        endTime: expect.any(String),
                        status: "completed",
                    },
                }
            );
        });

        it("should handle worker failure", async () => {
            vi.mocked(mockCollection.findOne)?.mockResolvedValue(null);
            vi.mocked(Worker).mockImplementation(
                () =>
                    ({
                        on: (event: string, cb: (...value: unknown[]) => void) => {
                            if (event === "exit") setTimeout(() => cb(1), 0);
                        },
                    }) as unknown as Worker
            );
            vi.mocked(mockCollection.insertOne)?.mockResolvedValue({
                insertedId: "test-id",
            } as any);

            await scheduler.start();

            expect(mockCollection.updateOne).toHaveBeenCalledWith(
                { _id: "test-id" },
                {
                    $set: {
                        endTime: expect.any(String),
                        status: "failed",
                        log: expect.any(String),
                    },
                }
            );
        });
    });

    describe("stop", () => {
        it("should stop the cron job", async () => {
            const stopFn = vi.fn();
            const mockSchedule = vi.fn().mockReturnValue({ stop: stopFn });
            vi.mocked(cron.schedule).mockImplementation(mockSchedule);

            await scheduler.start();
            await scheduler.stop();

            expect(stopFn).toHaveBeenCalled();
        });
    });
});
