import { z } from "zod";
import { randomUUID } from "node:crypto";
import { infrai, InfraiError } from "./infrai.ts";

export const AssetInput = z.object({ creatorId: z.string().min(1), filename: z.string().regex(/^[a-zA-Z0-9._-]+$/), contentType: z.string().regex(/^image\/[a-zA-Z0-9.+-]+$/), image: z.instanceof(Uint8Array).refine(value => value.byteLength > 0), width: z.number().int().positive().max(4000), height: z.number().int().positive().max(4000) });

export async function processCreatorAsset(raw: unknown) {
  const input = AssetInput.parse(raw);
  const bucket = `creator-media-${randomUUID().replaceAll("-", "").slice(0, 20)}`;
  const key = `${input.creatorId}/${input.filename}`;
  let bucketCreated = false;
  try {
    await infrai.storage.bucket.create({ name: bucket });
    bucketCreated = true;
    const upload = await infrai.storage.object.presign(bucket, key, { op: "put", expires_seconds: 600, content_type: input.contentType, max_bytes: input.image.byteLength, idempotency_key: `${bucket}-put` });
    const uploaded = await fetch(upload.url, { method: "PUT", headers: { "Content-Type": input.contentType }, body: input.image });
    if (!uploaded.ok) throw new Error(`UPLOAD_FAILED: ${uploaded.status} ${uploaded.statusText}`);

    const source = await infrai.storage.object.presign(bucket, key, { op: "get", expires_seconds: 600, idempotency_key: `${bucket}-get` });
    const resized = await infrai.image.resize({ image: source.url, width: input.width, height: input.height, fit: "cover", enlarge: false, format: "webp", store: false });
    if (!resized.url) throw new Error("RESIZE_FAILED: image.resize returned no URL");
    return { key, variantUrl: resized.url };
  } finally {
    if (bucketCreated) {
      await infrai.storage.object.delete(bucket, key).catch(error => {
        if (!(error instanceof InfraiError && error.status === 404)) throw error;
      });
      await infrai.storage.bucket.delete(bucket);
      try {
        await infrai.storage.bucket.get(bucket);
        throw new Error(`CLEANUP_FAILED: bucket ${bucket} still exists`);
      } catch (error) {
        if (!(error instanceof InfraiError && error.status === 404)) throw error;
      }
    }
  }
}

if (process.argv[1]?.endsWith("media_pipeline.ts")) {
  const image = Buffer.from("iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mNk+A8AAQUBAScY42YAAAAASUVORK5CYII=", "base64");
  const result = await processCreatorAsset({ creatorId: "demo-creator", filename: "cover.png", contentType: "image/png", image, width: 1200, height: 675 });
  console.log(JSON.stringify(result, null, 2));
}
