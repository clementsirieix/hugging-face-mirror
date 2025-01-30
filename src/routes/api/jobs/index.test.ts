import { describe, it, expect, vi, beforeEach } from "vitest";
import { Request, Response } from "express";
import { Collection, ObjectId } from "mongodb";
import { getJobModels, getJobs } from ".";
import { JobStatus } from "../../../lib/scheduler";

describe("/jobs", () => {
    let mockCollection: Partial<Collection> & {
        sort: (...params: any[]) => void;
        skip: (...params: any[]) => void;
        limit: (...params: any[]) => void;
        toArray: (...params: any[]) => any[];
    };
    let mockReq: Partial<Request>;
    let mockRes: Partial<Response>;

    beforeEach(() => {
        mockCollection = {
            find: vi.fn().mockReturnThis(),
            sort: vi.fn().mockReturnThis(),
            skip: vi.fn().mockReturnThis(),
            limit: vi.fn().mockReturnThis(),
            toArray: vi.fn().mockResolvedValue([]),
            countDocuments: vi.fn().mockResolvedValue(0),
        };
        mockRes = {
            json: vi.fn(),
            status: vi.fn().mockReturnThis(),
        };
        mockReq = {
            query: {},
            app: {
                get: vi.fn().mockReturnValue({
                    collection: () => mockCollection,
                }),
            } as any,
        };
    });

    it("should return jobs with default pagination", async () => {
        await getJobs(mockReq as Request, mockRes as Response);

        expect(mockCollection.find).toHaveBeenCalledWith({});
        expect(mockCollection.sort).toHaveBeenCalledWith({ startTime: -1 });
        expect(mockCollection.skip).toHaveBeenCalledWith(0);
        expect(mockCollection.limit).toHaveBeenCalledWith(10);
        expect(mockRes.json).toHaveBeenCalledWith({
            data: [],
            pagination: {
                total: 0,
                page: 1,
                limit: 10,
                pages: 0,
            },
        });
    });

    it("should apply key filter when provided", async () => {
        mockReq.query = { key: "test-job" };

        await getJobs(mockReq as Request, mockRes as Response);

        expect(mockCollection.find).toHaveBeenCalledWith({ key: "test-job" });
    });

    it("should apply status filter when provided", async () => {
        mockReq.query = { status: JobStatus.Completed };

        await getJobs(mockReq as Request, mockRes as Response);

        expect(mockCollection.find).toHaveBeenCalledWith({ status: JobStatus.Completed });
    });

    it("should handle custom pagination", async () => {
        mockReq.query = { page: "2", limit: "5" };

        await getJobs(mockReq as Request, mockRes as Response);

        expect(mockCollection.skip).toHaveBeenCalledWith(5);
        expect(mockCollection.limit).toHaveBeenCalledWith(5);
    });

    it("should handle errors gracefully", async () => {
        const error = new Error("Database error");
        mockCollection.find = vi.fn().mockImplementation(() => {
            throw error;
        });

        await getJobs(mockReq as Request, mockRes as Response);

        expect(mockRes.status).toHaveBeenCalledWith(500);
        expect(mockRes.json).toHaveBeenCalledWith({
            error: "Failed to fetch jobs",
            details: "Database error",
        });
    });
});

describe("/jobs/:jobId/models", () => {
    let mockCollection: Partial<Collection> & {
        sort: (...params: any[]) => void;
        skip: (...params: any[]) => void;
        limit: (...params: any[]) => void;
        toArray: (...params: any[]) => any[];
        countDocuments: (...params: any[]) => number;
    };
    let mockReq: Parameters<typeof getJobModels>[0];
    let mockRes: Parameters<typeof getJobModels>[1];
    const validJobId = "507f1f77bcf86cd799439011";

    beforeEach(() => {
        mockCollection = {
            find: vi.fn().mockReturnThis(),
            sort: vi.fn().mockReturnThis(),
            skip: vi.fn().mockReturnThis(),
            limit: vi.fn().mockReturnThis(),
            toArray: vi.fn().mockResolvedValue([]),
            countDocuments: vi.fn().mockResolvedValue(0),
        };
        mockRes = {
            json: vi.fn(),
            status: vi.fn().mockReturnThis(),
        } as any;
        mockReq = {
            params: { jobId: validJobId },
            query: {},
            app: {
                get: vi.fn().mockReturnValue({
                    collection: () => mockCollection,
                }),
            } as any,
        } as any;
    });

    it("should return models with default pagination", async () => {
        await getJobModels(mockReq, mockRes);

        expect(mockCollection.find).toHaveBeenCalledWith({
            jobId: new ObjectId(validJobId),
        });
        expect(mockCollection.skip).toHaveBeenCalledWith(0);
        expect(mockCollection.limit).toHaveBeenCalledWith(10);
        expect(mockRes.json).toHaveBeenCalledWith({
            data: [],
            pagination: {
                total: 0,
                page: 1,
                limit: 10,
                pages: 0,
            },
        });
    });

    it("should handle custom pagination", async () => {
        mockReq.query = { page: "2", limit: "20" };

        await getJobModels(mockReq, mockRes);

        expect(mockCollection.skip).toHaveBeenCalledWith(20);
        expect(mockCollection.limit).toHaveBeenCalledWith(20);
    });

    it("should handle ascending sort", async () => {
        mockReq.query = { sort: "trendingScore" };

        await getJobModels(mockReq, mockRes);

        expect(mockCollection.sort).toHaveBeenCalledWith({
            trendingScore: 1,
        });
    });

    it("should handle descending sort", async () => {
        mockReq.query = { sort: "-trendingScore" };

        await getJobModels(mockReq, mockRes);

        expect(mockCollection.sort).toHaveBeenCalledWith({
            trendingScore: -1,
        });
    });

    it("should return 400 for invalid jobId", async () => {
        mockReq.params = { jobId: "invalid-id" };

        await getJobModels(mockReq, mockRes);

        expect(mockRes.status).toHaveBeenCalledWith(400);
        expect(mockRes.json).toHaveBeenCalledWith({
            error: expect.any(Error),
        });
    });

    it("should handle database errors gracefully", async () => {
        const error = new Error("Database error");
        mockCollection.find = vi.fn().mockImplementation(() => {
            throw error;
        });

        await getJobModels(mockReq, mockRes);

        expect(mockRes.status).toHaveBeenCalledWith(500);
        expect(mockRes.json).toHaveBeenCalledWith({
            error: "Failed to fetch job models",
            details: "Database error",
        });
    });

    it("should handle data with correct pagination calculation", async () => {
        vi.mocked(mockCollection.toArray).mockResolvedValue([
            { id: 1, name: "Model 1" },
            { id: 2, name: "Model 2" },
        ]);
        vi.mocked(mockCollection.countDocuments).mockResolvedValue(15);
        mockReq.query = { limit: "5" };

        await getJobModels(mockReq, mockRes);

        expect(mockRes.json).toHaveBeenCalledWith({
            data: [
                { id: 1, name: "Model 1" },
                { id: 2, name: "Model 2" },
            ],
            pagination: {
                total: 15,
                page: 1,
                limit: 5,
                pages: 3,
            },
        });
    });
});
