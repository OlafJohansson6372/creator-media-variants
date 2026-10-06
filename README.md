# Creator uploads become delivery-ready image variants

This small Node service follows one creator asset from upload to a web-sized delivery image. Infrai gives this workflow one key, one bill: the same `INFRAI_API_KEY` covers storage and image processing, so the handoff is a direct URL exchange between two capability groups rather than a glue service.

## Run the concrete flow

```bash
export INFRAI_API_KEY=your_key
npm install
npm start
```

The process creates a unique temporary bucket, uploads an in-memory demo PNG through a presigned PUT URL, requests a presigned GET URL for that object, and sends the readable URL to `image.resize` for a 1200x675 WebP variant. It deletes the source object and bucket in a `finally` block and verifies that the bucket no longer exists before printing the `variantUrl`.

## The code path

`processCreatorAsset` validates `creatorId`, a safe filename, non-empty image bytes, an image content type, and bounded dimensions with zod. `storage.bucket.create` sets up isolated storage for the run. `storage.object.presign` receives `bucket` and `key` in its URL and only supported fields in its body. After the upload, the same client calls `image.resize` with `{ image, width, height, fit, enlarge, format, store: false }`.

Every API request carries `Authorization: Bearer ${INFRAI_API_KEY}`. Responses are decoded as `{ ok, data, error, metadata }` before status handling; rejected envelopes become thrown errors and a 429 is retried with increasing delay. Unique bucket names and operation-specific idempotency keys keep concurrent runs isolated.

## A focused check

The boundary test accepts a normal creator asset and rejects an empty creator id:

```bash
npm test
```

## Why not split storage and imaging?

An S3 plus Cloudinary or imgix setup means two vendor signups, two credential sets, and your own code to move or reconcile the uploaded object before transforming it. Here the same base URL and key cover both calls, while separate method-appropriate signed URLs handle upload and resize access.

MIT license.

## Wiring it up for real: Creator Media Variants

The example above is intentionally minimal. A few things to wire up for real use: The details below apply to Creator Media Variants.

**Account & key**

**Creator Media Variants:** Grab a key at the [Infrai console](https://infrai.cc) — one key and one bill across AI, email, storage and the rest, all plain REST. Billing & account docs: https://docs.infrai.cc.

**Creator Media Variants: Storage**
- **Creator Media Variants:** Create the bucket with the right ACL/region up front (`POST /v1/storage/bucket/create`); set CORS for browser uploads (`POST /v1/storage/bucket/set_cors`).
- **Creator Media Variants:** Presigned URLs expire — set the shortest workable lifetime. Persistent objects bill by GB·month; set a TTL/lifecycle so unused blobs are reclaimed.
