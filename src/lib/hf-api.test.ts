import { describe, it, expect, vi, beforeEach } from "vitest";
import { sleep } from "../utils/time";
import { retryWithBackoff } from "./hf-api";

vi.mock("../utils/time", () => ({
    sleep: vi.fn(),
}));

describe("retryWithBackoff", () => {
    beforeEach(() => {
        vi.clearAllMocks();
    });

    it("should return result immediately on success", async () => {
        const operation = vi.fn().mockResolvedValue("success");

        const result = await retryWithBackoff(operation);

        expect(result).toBe("success");
        expect(operation).toHaveBeenCalledTimes(1);
        expect(sleep).not.toHaveBeenCalled();
    });

    it("should respect maxAttempts and eventually throw", async () => {
        const error = new Error("Persistent failure");
        const operation = vi.fn().mockRejectedValue(error);

        await expect(retryWithBackoff(operation)).rejects.toThrow(error);

        expect(operation).toHaveBeenCalledTimes(5);
        expect(sleep).toHaveBeenCalledTimes(4);
    });
});
