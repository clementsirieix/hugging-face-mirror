import { defineConfig } from "vitest/config";

export default defineConfig({
    test: {
        env: {
            TEST_ENV: "true",
        },
        globals: true,
    },
});
