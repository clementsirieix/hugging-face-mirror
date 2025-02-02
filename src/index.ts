import express from "express";
import { env } from "./lib/env";
import { connectToDatabase, disconnectFromDatabase } from "./lib/db";
import routes from "./routes";
import { Scheduler } from "./lib/scheduler";
import { getWorkerFilePath } from "./utils/system";
import { disconnectFromStorage } from "./lib/storage";
import { disconnectFromQueue, startConsumerWorkers, stopWorkers } from "./lib/queue";
import { connectToElasticsearch, initMapping } from "./lib/es";
import path from "path";
import { logger } from "./lib/logger";

const app = express();
let scheduler: Scheduler | null = null;

app.use(routes);

app.use(express.static(path.join(__dirname, "./client")));

app.get("*", (_req, res) => {
    res.sendFile(path.join(__dirname, "./client/index.html"));
});

async function startServer() {
    try {
        const db = await connectToDatabase();
        app.set("db", db);
        logger.info("Connected to MongoDB");

        const esClient = connectToElasticsearch();
        await initMapping(esClient);
        logger.info("Connected to Elasticsearch");

        startConsumerWorkers(getWorkerFilePath("hf-repo-storage"));
        logger.info("Consumer workers started");

        scheduler = new Scheduler(
            "hf-backup",
            env.schedulerIntervalMs,
            getWorkerFilePath("hf-backup"),
            db
        );
        scheduler.start();
        logger.info("Scheduler started");

        app.listen(env.port, () => {
            logger.info(`Server is running on port ${env.port}`);
        });
    } catch (error) {
        logger.error("Failed to start server:", error);
        process.exit(1);
    }
}

process.on("SIGTERM", async () => {
    logger.info("SIGTERM received. Shutting down gracefully...");
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
