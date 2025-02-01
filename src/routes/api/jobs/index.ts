import { Request, Response, Router } from "express";
import { Db, ObjectId } from "mongodb";
import { JobStatus, ModelIndex, ModelPosition } from "../../../types";
import { connectToElasticsearch } from "../../../lib/es";
import { QueryDslQueryContainer, Sort } from "@elastic/elasticsearch/lib/api/types";

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
            message: error instanceof Error ? error.message : "Unknown error",
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
    sizeLte?: string;
    sizeGte?: string;
};

export async function getJobModels(
    req: Request<JobUrlParams, any, any, JobModelsQueryParams>,
    res: Response
) {
    let jobObjectId: ObjectId;
    try {
        jobObjectId = new ObjectId(req.params.jobId);
    } catch (error) {
        res.status(400).json({ error: "Invalid jobId" });
        return;
    }
    const limit = Math.min(parseInt(req.query.limit || "10", 10), 50);
    const page = parseInt(req.query.page || "1", 10);
    const skip = (page - 1) * limit;
    const esClient = connectToElasticsearch();
    let filters: QueryDslQueryContainer[] = [{ term: { jobId: req.params.jobId } }];
    let query: QueryDslQueryContainer = {};
    let sort: Sort = [];

    if (req.query.sizeGte || req.query.sizeLte) {
        filters.push({
            range: {
                dirSize: {
                    ...(req.query.sizeGte ? { gte: parseInt(req.query.sizeGte, 10) } : {}),
                    ...(req.query.sizeLte ? { lte: parseInt(req.query.sizeLte, 10) } : {}),
                },
            },
        });
    }
    if (req.query.search) {
        query = {
            bool: {
                must: {
                    multi_match: {
                        query: req.query.search,
                        fields: ["readme"],
                    },
                },
                filter: filters,
            },
        };
    } else {
        query = { bool: { filter: filters } };
        const [, directionSign, field] = req.query.sort?.match(/(-)?(.*)/) || [
            ,
            "-",
            "trendingScore",
        ];
        sort.push({ [field]: { order: directionSign ? "desc" : "asc" } });
    }

    try {
        const { hits } = await esClient.search<ModelIndex>({
            index: "models",
            from: skip,
            size: limit,
            query,
            sort,
        });
        const modelIds = hits.hits.map((hit) => hit._source?.modelId);

        if (modelIds.length === 0) {
            res.json({
                data: [],
                pagination: { total: 0, page, limit, pages: 0 },
            });
            return;
        }
        const db = req.app.get("db") as Db;
        const modelPositionsCollection = db.collection<ModelPosition>("model_positions");
        const modelPositionsMap = (
            await modelPositionsCollection
                .find({ jobId: jobObjectId, "model.id": { $in: modelIds } })
                .toArray()
        ).reduce((acc: Record<string, ModelPosition>, doc: ModelPosition) => {
            acc[doc.model.id] = doc;
            return acc;
        }, {});
        const total = typeof hits.total === "number" ? hits.total : hits.total?.value || 0;

        res.json({
            data: modelIds
                .map((id) => (id ? modelPositionsMap[id]?.model : undefined))
                .filter(Boolean),
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
            message: error instanceof Error ? error.message : "Unknown error",
        });
    }
}

const router = Router();

router.get("/", getJobs);
router.get("/:jobId/models", getJobModels);

export default router;
