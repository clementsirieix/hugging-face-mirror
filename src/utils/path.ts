import path from "path";
import { env } from "../lib/env";

export function getWorkerFilePath(fileName: string): string {
    const baseDir = env.isDev ? "src" : "dist";
    const fileExtension = env.isDev ? ".ts" : ".js";
    const baseName = fileName.replace(/\.(js|ts)$/, "");

    return path.resolve(process.cwd(), baseDir, "workers", `${baseName}${fileExtension}`);
}
