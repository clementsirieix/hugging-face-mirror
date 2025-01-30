import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { sleep } from "./time";

describe("sleep", () => {
    beforeEach(() => {
        vi.useFakeTimers();
    });

    afterEach(() => {
        vi.useRealTimers();
    });

    it("should wait for the specified time", async () => {
        const ms = 1000;
        const sleepPromise = sleep(ms);

        await vi.advanceTimersByTimeAsync(ms);

        await expect(sleepPromise).resolves.toBeUndefined();
    });

    it("should not resolve before the specified time", async () => {
        const ms = 1000;
        const sleepPromise = sleep(ms);

        await vi.advanceTimersByTimeAsync(ms - 1);

        let resolved = false;
        sleepPromise.then(() => {
            resolved = true;
        });

        await Promise.resolve();

        expect(resolved).toBe(false);
    });
});
