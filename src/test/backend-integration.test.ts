// @vitest-environment node
import { describe, it, expect, afterAll } from "vitest";
import { checkSystemHealth } from "../server/index";
import { dbPool, query } from "../server/db/connection";
import { s3Client } from "../server/storage/s3-service";
import { serverEnv } from "../server/config/env";
import { PutObjectCommand, GetObjectCommand } from "@aws-sdk/client-s3";
import { GeminiClinicalService, classifySpeakerRole } from "../server/services/gemini-clinical.service";
import { handleApiRequest } from "../server/api/router";

describe("SOAPI Enterprise Backend Verification", () => {
  afterAll(async () => {
    await dbPool.end();
  });

  it("should accurately classify clinical dialogue roles via heuristic and Gemini", async () => {
    // 1. Doctor inquiry
    expect(classifySpeakerRole("Selamat pagi Bapak hari ini keluhannya apa ya pak")).toBe("Dokter");
    // 2. Patient symptom
    expect(classifySpeakerRole("saya pusing dong", "Dokter")).toBe("Pasien");
    // 3. Patient symptom continuation
    expect(classifySpeakerRole("Kepala saya pusing", "Pasien")).toBe("Pasien");
    // 4. Doctor active reflection
    expect(classifySpeakerRole("Oh jadi pusing ya pak", "Pasien")).toBe("Dokter");
  });

  it("should classify turns via handleApiRequest /api/voice/classify-turn", async () => {
    const req = new Request("http://localhost:8080/api/voice/classify-turn", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        text: "Oh jadi pusing ya pak",
        context: [
          { speaker: "Dokter", text: "Selamat pagi Bapak hari ini keluhannya apa ya pak" },
          { speaker: "Pasien", text: "saya pusing dong" },
          { speaker: "Pasien", text: "Kepala saya pusing" },
        ],
      }),
    });

    const res = await handleApiRequest(req);
    expect(res).not.toBeNull();
    const json = await res!.json();
    expect(json.success).toBe(true);
    expect(json.speaker).toBe("Dokter");
  });

  it("should report healthy status for both PostgreSQL and S3", async () => {
    const health = await checkSystemHealth();
    expect(health.status).toBe("healthy");
    expect(health.services.postgresql.status).toBe("healthy");
    expect(health.services.objectStorage.status).toBe("healthy");
  });

  it("should query seeded patients from PostgreSQL", async () => {
    const res = await query(
      "SELECT nama, nomor_rekam_medis FROM pasien WHERE nomor_rekam_medis = $1",
      ["RM-2024-00831"]
    );
    expect(res.rows.length).toBe(1);
    expect(res.rows[0].nama).toBe("Budi Santoso");
  });

  it("should perform S3 PutObject and GetObject operations", async () => {
    const testKey = `test/ping-${Date.now()}.txt`;
    const content = "SOAPI S3 Integration Test Audio Payload";

    await s3Client.send(
      new PutObjectCommand({
        Bucket: serverEnv.S3_BUCKET_NAME,
        Key: testKey,
        Body: Buffer.from(content),
        ContentType: "text/plain",
      })
    );

    const getRes = await s3Client.send(
      new GetObjectCommand({
        Bucket: serverEnv.S3_BUCKET_NAME,
        Key: testKey,
      })
    );

    const bodyStr = await getRes.Body?.transformToString();
    expect(bodyStr).toBe(content);
  });
});
