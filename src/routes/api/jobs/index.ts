import { Request, Response, Router } from "express";
import { Db, ObjectId } from "mongodb";
import { JobStatus } from "../../../lib/scheduler";
import { connectToElasticsearch, esSearch, ModelIndex } from "../../../lib/es";

type JobsQueryParams = {
    limit?: string;
    page?: string;
    key?: string;
    status?: JobStatus;
};

export async function getJobs(
    req: Request<unknown, unknown, unknown, JobsQueryParams>,
    res: Response
) {
    const db = req.app.get("db") as Db;
    const jobsCollection = db.collection("jobs");
    const limit = Math.min(parseInt(req.query.limit || "10", 10), 50);
    const page = parseInt(req.query.page || "1", 10);
    const skip = (page - 1) * limit;

    const query: Record<string, unknown> = {};
    if (req.query.key) {
        query.key = req.query.key;
    }
    if (req.query.status) {
        query.status = req.query.status;
    }

    try {
        const [data, total] = await Promise.all([
            jobsCollection.find(query).sort({ startTime: -1 }).skip(skip).limit(limit).toArray(),
            jobsCollection.countDocuments(query),
        ]);

        res.json({
            data,
            pagination: {
                total,
                page,
                limit,
                pages: Math.ceil(total / limit),
            },
        });
    } catch (error) {
        res.status(500).json({
            error: "Failed to fetch jobs",
            details: error instanceof Error ? error.message : "Unknown error",
        });
    }
}

type JobUrlParams = {
    jobId: string;
};

type JobModelsQueryParams = {
    limit?: string;
    page?: string;
    sort?: string;
    search?: string;
};

export async function getJobModels(
    req: Request<JobUrlParams, any, any, JobModelsQueryParams>,
    res: Response
) {
    const db = req.app.get("db") as Db;
    const modelPositionsCollection = db.collection("model_positions");
    let jobObjectId: ObjectId;

    try {
        jobObjectId = new ObjectId(req.params.jobId);
    } catch (error) {
        res.status(400).json({ error });
        return;
    }

    const limit = Math.min(parseInt(req.query.limit || "10", 10), 50);
    const page = parseInt(req.query.page || "1", 10);
    const skip = (page - 1) * limit;
    const [, directionSign, field] = req.query.sort?.match(/(-)?(.*)/) || [];
    let searchResult: string[] = [];

    if (req.query.search) {
        searchResult = (
            await esSearch<ModelIndex>(
                connectToElasticsearch(),
                "models",
                req.query.search,
                limit,
                skip,
                {
                    jobId: req.params.jobId,
                }
            )
        ).map((doc) => doc.modelId);

        if (searchResult.length === 0) {
            res.json({
                data: [],
                pagination: {
                    total: 0,
                    page,
                    limit,
                    pages: 0,
                },
            });
            return;
        }
    }
    const idQuery = searchResult.length > 0 ? { "model.id": { $in: searchResult } } : {};

    try {
        const query = { jobId: jobObjectId, ...idQuery };
        const [data, total] = await Promise.all([
            modelPositionsCollection
                .find(query)
                .sort({ [field]: directionSign ? -1 : 1 })
                .skip(skip)
                .limit(limit)
                .toArray(),
            modelPositionsCollection.countDocuments(query),
        ]);

        if (searchResult.length > 0) {
            data.sort(
                (a, b) => searchResult.indexOf(a.model.id) - searchResult.indexOf(b.model.id)
            );
        }

        res.json({
            data,
            pagination: {
                total,
                page,
                limit,
                pages: Math.ceil(total / limit),
            },
        });
    } catch (error) {
        res.status(500).json({
            error: "Failed to fetch job models",
            details: error instanceof Error ? error.message : "Unknown error",
        });
    }
}

const router = Router();

router.get("/", getJobs);
router.get("/:jobId/models", getJobModels);

export default router;
