import { describe, it, expect, vi } from "vitest";
import { Request, Response } from "express";
import { getHealth } from ".";

describe("Health Check API", () => {
    it("should return 200 and status ok", () => {
        const req = {} as Request;
        const res = {
            status: vi.fn().mockReturnThis(),
            json: vi.fn(),
        } as Partial<Response> as Response;

        getHealth(req, res);

        expect(res.status).toHaveBeenCalledWith(200);
        expect(res.json).toHaveBeenCalledWith({ status: "ok" });
    });
});
