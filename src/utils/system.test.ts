import { describe, it, expect, vi } from "vitest";
import path from "path";
import { env } from "../lib/env";

import { getWorkerFilePath } from "./system";

vi.mock("../lib/env", () => ({
    env: {
        isDev: true,
    },
}));

describe("getWorkerFilePath", () => {
    const baseCwd = process.cwd();

    it("should return the correct path in development mode for .ts files", () => {
        env.isDev = true;
        const result = getWorkerFilePath("example.ts");
        const expectedPath = path.resolve(baseCwd, "src", "workers", "example.ts");

        expect(result).toBe(expectedPath);
    });

    it("should return the correct path in development mode for .js files", () => {
        env.isDev = true;
        const result = getWorkerFilePath("example.js");
        const expectedPath = path.resolve(baseCwd, "src", "workers", "example.ts");

        expect(result).toBe(expectedPath);
    });

    it("should strip the file extension and add .ts in development mode", () => {
        env.isDev = true;
        const result = getWorkerFilePath("example.worker.js");
        const expectedPath = path.resolve(baseCwd, "src", "workers", "example.worker.ts");

        expect(result).toBe(expectedPath);
    });

    it("should return the correct path in production mode for .js files", () => {
        env.isDev = false;
        const result = getWorkerFilePath("example.ts");
        const expectedPath = path.resolve(baseCwd, "dist", "workers", "example.js");

        expect(result).toBe(expectedPath);
    });

    it("should strip the file extension and add .js in production mode", () => {
        env.isDev = false;
        const result = getWorkerFilePath("example.worker.ts");
        const expectedPath = path.resolve(baseCwd, "dist", "workers", "example.worker.js");

        expect(result).toBe(expectedPath);
    });

    it("should handle filenames without extensions correctly", () => {
        env.isDev = false;
        const result = getWorkerFilePath("example");
        const expectedPath = path.resolve(baseCwd, "dist", "workers", "example.js");

        expect(result).toBe(expectedPath);
    });
});
