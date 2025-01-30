import { Mutex } from "async-mutex";
import dayjs from "dayjs";
import { Collection, Db, InsertOneResult } from "mongodb";
import cron, { ScheduledTask } from "node-cron";
import { Worker } from "worker_threads";
import { env } from "./env";

export enum JobStatus {
    Pending = "pending",
    Failed = "failed",
    Completed = "completed",
}

type Job = {
    key: string;
    startTime: string;
    endTime?: string;
    log?: string;
    status: JobStatus;
};

export class Scheduler {
    private jobs: Collection<Job>;
    private cronJob?: ScheduledTask;
    private jobWorker?: Worker;
    private mutex: Mutex;

    constructor(
        private key: string,
        private intervalMs: number,
        private jobFileName: string,
        db: Db,
        private jobTimeoutMs: number = 10800000 // 3h
    ) {
        this.jobs = db.collection<Job>("jobs");
        this.mutex = new Mutex();
    }

    async start() {
        if (this.cronJob) {
            return;
        }
        await this.runJob();

        const cronExpression = `*/${Math.floor(this.intervalMs / (1000 * 60))} * * * *`;

        this.cronJob = cron.schedule(cronExpression, async () => {
            await this.runJob();
        });
    }

    async stop() {
        this.cronJob?.stop();
        this.cronJob = undefined;
        this.jobWorker?.terminate();
        this.jobWorker = undefined;
    }

    private async runJob() {
        const release = await this.mutex.acquire();
        let job: InsertOneResult<Job> | null = null;

        try {
            const lastJob = await this.jobs.findOne({ key: this.key }, { sort: { startTime: -1 } });
            const hasPassedInterval =
                !!lastJob &&
                Math.abs(dayjs(lastJob.startTime).diff(dayjs())) >= this.intervalMs * 0.9;

            if (lastJob?.status === JobStatus.Pending && !hasPassedInterval) {
                console.log("Previous job is still running. Skipping this run.");
                return;
            }
            if (lastJob?.status === JobStatus.Completed && !hasPassedInterval) {
                console.log("Previous job has been completed before interval. Skipping this run.");
                return;
            }

            job = await this.jobs.insertOne({
                key: this.key,
                startTime: dayjs().toISOString(),
                status: JobStatus.Pending,
            });

            await this.executeJob(job.insertedId.toString());

            await this.jobs.updateOne(
                { _id: job.insertedId },
                {
                    $set: {
                        endTime: dayjs().toISOString(),
                        status: JobStatus.Completed,
                    },
                }
            );
        } catch (error) {
            if (job) {
                await this.jobs.updateOne(
                    { _id: job.insertedId },
                    {
                        $set: {
                            endTime: dayjs().toISOString(),
                            status: JobStatus.Failed,
                            log: error instanceof Error ? error.message : "Unknown error",
                        },
                    }
                );
            }
        } finally {
            release();
        }
    }

    private async executeJob(jobId: string) {
        return new Promise((resolve, reject) => {
            this.jobWorker = env.isDev
                ? new Worker(`require('ts-node/register'); require('${this.jobFileName}');`, {
                      eval: true,
                      workerData: { jobId },
                  })
                : new Worker(this.jobFileName, {
                      workerData: { jobId },
                  });
            const timeout = setTimeout(() => {
                this.jobWorker?.terminate().then(() => {
                    reject(new Error(`Job timed out after ${this.jobTimeoutMs} ms`));
                });
            }, this.jobTimeoutMs);

            this.jobWorker.on("message", (message) => {
                console.log(`Worker message: ${message}`);
            });
            this.jobWorker.on("error", (error) => {
                clearTimeout(timeout);
                reject(error);
            });
            this.jobWorker.on("exit", (code) => {
                clearTimeout(timeout);
                if (code !== 0) {
                    reject(new Error(`Worker stopped with exit code ${code}`));
                } else {
                    resolve(undefined);
                }
            });
        });
    }
}
