import { AssetInput } from "./media_pipeline.ts";
const accepted = AssetInput.safeParse({ creatorId: "writer-7", filename: "hero.jpg", contentType: "image/jpeg", image: new Uint8Array([1]), width: 800, height: 450 });
if (!accepted.success) throw new Error("valid creator asset was rejected");
const rejected = AssetInput.safeParse({ creatorId: "", filename: "hero.jpg", contentType: "image/jpeg", image: new Uint8Array([1]), width: 800, height: 450 });
if (rejected.success) throw new Error("empty creator id should be rejected");
const emptyImage = AssetInput.safeParse({ creatorId: "writer-7", filename: "hero.jpg", contentType: "image/jpeg", image: new Uint8Array(), width: 800, height: 450 });
if (emptyImage.success) throw new Error("empty image should be rejected");
console.log("asset boundary test passed");
