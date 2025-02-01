import path from "path";
import { env } from "../lib/env";
import { readdir, readFile, stat } from "fs/promises";

export function getWorkerFilePath(fileName: string): string {
    const baseDir = env.isDev ? "src" : "dist";
    const fileExtension = env.isDev ? ".ts" : ".js";
    const baseName = fileName.replace(/\.(js|ts)$/, "");

    return path.resolve(process.cwd(), baseDir, "workers", `${baseName}${fileExtension}`);
}

export async function getDirSize(dirPath: string): Promise<number> {
    let total = 0;
    const entries = await readdir(dirPath, { withFileTypes: true });

    for (const entry of entries) {
        const fullPath = path.join(dirPath, entry.name);

        if (entry.isDirectory()) {
            total += await getDirSize(fullPath);
        } else if (entry.isFile()) {
            const { size } = await stat(fullPath);
            const content = await readFile(fullPath, "utf8");

            if (content.startsWith("version https://git-lfs.github.com/spec/v1")) {
                const sizeMatch = content.match(/^size (\d+)/m);
                if (sizeMatch && sizeMatch[1]) {
                    total += parseInt(sizeMatch[1], 10);
                    continue;
                }
            }
            total += size;
        }
    }

    return total;
}
