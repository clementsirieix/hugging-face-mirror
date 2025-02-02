import * as matchers from "aws-sdk-client-mock-jest";
import "aws-sdk-client-mock-jest/vitest";
import { describe, it, expect, beforeEach, afterEach } from "vitest";
import { mockClient } from "aws-sdk-client-mock";
import { S3Client, PutObjectCommand } from "@aws-sdk/client-s3";
import { connectToStorage, disconnectFromStorage, uploadFolder } from "./storage";
import { mkdir, rm, writeFile } from "fs/promises";
import path from "path";

expect.extend(matchers);

describe("storage", () => {
    const s3Mock = mockClient(S3Client);
    const testBucket = "test-bucket";
    const tempDir = path.join(__dirname, "test-temp");

    beforeEach(async () => {
        await mkdir(tempDir, { recursive: true });
        s3Mock.reset();
    });

    afterEach(async () => {
        await rm(tempDir, { recursive: true, force: true });
        disconnectFromStorage();
    });

    describe("connectToStorage", () => {
        it("should create a new S3 client on first connection", () => {
            const client = connectToStorage();
            expect(client).toBeDefined();
        });

        it("should reuse existing client on subsequent connections", () => {
            const client1 = connectToStorage();
            const client2 = connectToStorage();
            expect(client1).toBe(client2);
        });
    });

    describe("uploadFolder", () => {
        it("should upload files maintaining directory structure", async () => {
            await mkdir(path.join(tempDir, "nested"), { recursive: true });
            await writeFile(path.join(tempDir, "test.txt"), "test content");
            await writeFile(path.join(tempDir, "nested/file.txt"), "nested content");

            s3Mock.on(PutObjectCommand).resolves({});

            const s3 = connectToStorage();
            await uploadFolder(s3, testBucket, "prefix", tempDir);

            const putObjectCalls = s3Mock.commandCalls(PutObjectCommand);

            expect(putObjectCalls).toHaveLength(2);

            expect(s3Mock).toHaveReceivedCommandWith(PutObjectCommand, {
                Bucket: testBucket,
                Key: "prefix/test.txt",
            });
            expect(s3Mock).toHaveReceivedCommandWith(PutObjectCommand, {
                Bucket: testBucket,
                Key: "prefix/nested/file.txt",
            });
        });

        it("should handle PutObject errors", async () => {
            await writeFile(path.join(tempDir, "test.txt"), "test content");
            s3Mock.on(PutObjectCommand).rejects(new Error("Upload failed"));

            const s3 = connectToStorage();
            await expect(uploadFolder(s3, testBucket, "prefix", tempDir)).rejects.toThrow(
                "Upload failed"
            );
        });
    });
});
