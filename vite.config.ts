import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";

export default defineConfig({
    plugins: [react()],
    root: "src/client",
    server: {
        proxy: {
            "/api": "http://localhost:3000",
        },
    },
    build: {
        outDir: "../../dist/client",
    },
});
