import express from "express";
import { env } from "./lib/env";
import { connectToDatabase, disconnectFromDatabase } from "./lib/db";
import routes from "./routes";
import { Scheduler } from "./lib/scheduler";
import { getWorkerFilePath } from "./utils/path";
import { disconnectFromStorage } from "./lib/storage";
import { disconnectFromQueue, startConsumerWorkers, stopWorkers } from "./lib/queue";

const app = express();
let scheduler: Scheduler | null = null;

app.use(routes);

async function startServer() {
    try {
        const db = await connectToDatabase();
        app.set("db", db);
        console.log("Connected to MongoDB");

        startConsumerWorkers(getWorkerFilePath("hf-repo-storage"));
        console.log("Consumer workers started");

        scheduler = new Scheduler(
            "hf-backup",
            env.schedulerIntervalMs,
            getWorkerFilePath("hf-backup"),
            db
        );
        scheduler.start();
        console.log("Scheduler started");

        app.listen(env.port, () => {
            console.log(`Server is running on port ${env.port}`);
        });
    } catch (error) {
        console.error("Failed to start server:", error);
        process.exit(1);
    }
}

process.on("SIGTERM", async () => {
    console.log("SIGTERM received. Shutting down gracefully...");
    await disconnectFromDatabase();
    disconnectFromStorage();
    disconnectFromQueue();
    stopWorkers();
    if (scheduler) {
        await scheduler.stop();
    }
    process.exit(0);
});

startServer();
