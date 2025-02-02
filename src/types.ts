import { ObjectId } from "mongodb";

// DB entities
export enum JobStatus {
    Pending = "pending",
    Failed = "failed",
    Completed = "completed",
}

export type Job = {
    _id?: ObjectId;
    key: string;
    startTime: string;
    endTime?: string;
    log?: string;
    status: JobStatus;
};

export type ModelPosition = {
    jobId: ObjectId;
    trendingScore: number;
    dirSize?: number;
    model: Model;
};

export type Model = {
    _id: ObjectId;
    id: string;
    author: string;
    gated: boolean | string;
    inference: string;
    likes: number;
    trendingScore: number;
    private: boolean;
    sha: string;
    downloads: number;
    tags: string[];
    pipeline_tag: string;
    library_name: string;
    createdAt: string;
    modelId: string;
    siblings: Record<string, unknown>[];
    lastModified: string;
};

// ES entities
export type ModelIndex = {
    jobId: string;
    modelId: string;
    readme: string;
    dirSize: number;
};
