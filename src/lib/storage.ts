import { lstat, mkdir, readdir, readFile, writeFile } from "fs/promises";
import path from "path";
import { GetObjectCommand, ListObjectsV2Command, S3 } from "@aws-sdk/client-s3";
import { env } from "./env";

let client: S3 | null = null;

export function connectToStorage(): S3 {
    if (client) {
        return client;
    }
    client = new S3({
        endpoint: env.s3Endpoint,
        region: env.s3Region,
        credentials: {
            accessKeyId: env.s3AccessKeyId,
            secretAccessKey: env.s3SecretAccessKey,
        },
        forcePathStyle: true,
    });

    return client;
}

export function disconnectFromStorage() {
    if (client) {
        client.destroy();
        client = null;
    }
}

export async function downloadFolder(s3: S3, bucketName: string, prefix: string, localDir: string) {
    const listParams = {
        Bucket: bucketName,
        Prefix: prefix,
    };

    let continuationToken: string | undefined = undefined;
    do {
        const listCommand: ListObjectsV2Command = new ListObjectsV2Command({
            ...listParams,
            ContinuationToken: continuationToken,
        });

        const response = await s3.send(listCommand);
        continuationToken = response.NextContinuationToken;

        if (response.Contents) {
            for (const item of response.Contents) {
                if (!item.Key || item.Key.endsWith("/")) {
                    continue;
                }

                const localFilePath = path.join(localDir, item.Key.replace(prefix, ""));
                await mkdir(path.dirname(localFilePath), { recursive: true });

                const getObjectCommand = new GetObjectCommand({
                    Bucket: bucketName,
                    Key: item.Key,
                });
                const response = await s3.send(getObjectCommand);
                const buffer = await response?.Body?.transformToByteArray();

                if (buffer) {
                    await writeFile(localFilePath, buffer);
                }
            }
        }
    } while (continuationToken);
}

export async function uploadFolder(
    s3: S3,
    bucketName: string,
    baseKey: string,
    localDir: string,
    currentPath = ""
) {
    const files = await readdir(localDir);

    for (const file of files) {
        const filePath = path.join(localDir, file);
        const stat = await lstat(filePath);

        if (stat.isDirectory()) {
            const nextPath = currentPath ? path.join(currentPath, file) : file;
            await uploadFolder(s3, bucketName, baseKey, filePath, nextPath);
        } else {
            const s3Key = currentPath ? `${baseKey}/${currentPath}/${file}` : `${baseKey}/${file}`;

            await s3.putObject({
                Bucket: bucketName,
                Key: s3Key,
                Body: await readFile(filePath),
            });
        }
    }
}
