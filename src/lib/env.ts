import dotenv from "dotenv";

dotenv.config();

export const env = {
    hfToken: process.env.HF_TOKEN,
    dbName: process.env.DB_NAME || "",
    isDev: process.env.NODE_ENV === "development",
    isTest: process.env.TEST_ENV === "true",
    mongodb: {
        uri: process.env.MONGODB_URI || "mongodb://admin:password@localhost:27017",
    },
    port: parseInt(process.env.PORT || "3000", 10),
    trendingModelsTotal: parseInt(process.env.TRENDING_MODELS_TOTAL || "10", 10),
    trendingModelsBatchSize: parseInt(process.env.TRENDING_MODELS_BATCH_SIZE || "5", 10),
    trendingModelsDelayMs: parseInt(process.env.TRENDING_MODELS_DELAY_MS || "2000", 10),
    opIntervalMs: parseInt(process.env.OP_INTERVAL_MS || "2000", 10),
    schedulerIntervalMs: parseInt(process.env.SCHEDULER_INTERVAL_MS || "600000", 10),
    s3BucketName: process.env.S3_BUCKET_NAME || "my-bucket",
    s3Endpoint: process.env.S3_ENDPOINT || "http://localhost:4566",
    s3Region: process.env.S3_REGION || "eu-central-1",
    s3AccessKeyId: process.env.S3_ACCESS_KEY_ID || "test",
    s3SecretAccessKey: process.env.S3_SECRET_ACCESS_KEY || "test",
    sqsQueueName: process.env.SQS_QUEUE_NAME || "my-queue",
    sqsEndpoint: process.env.SQS_ENDPOINT || "http://localhost:4566",
    sqsQueueUrl: process.env.SQS_QUEUE_URL || "http://localhost:4566/000000000000/my-queue",
    sqsRegion: process.env.SQS_REGION || "eu-central-1",
    sqsAccessKeyId: process.env.SQS_ACCESS_KEY_ID || "test",
    sqsSecretAccessKey: process.env.SQS_SECRET_ACCESS_KEY || "key",
    esUrl: process.env.ES_URL || "http://localhost:9200",
};
