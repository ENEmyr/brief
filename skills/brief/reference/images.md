# Uploading an image

An `image` block names an image the API already holds. Upload each file first, then put the returned `imageId` in the block, then create the brief.

```bash
curl -sS -X POST https://brief-api.algoryth.me/api/image \
  -H 'content-type: image/png' \
  --data-binary @screenshot.png
```

Send the raw bytes of the file as the body, with `--data-binary`, not a form or JSON, and set the `content-type` header to the image type of the file. The API does not trust that header. It reads the first bytes of the file instead: it accepts PNG, JPEG, GIF, and WEBP, and nothing else. SVG is refused. A file may hold at most 5242880 bytes (5 MiB).

| Status | Body | What to do |
| --- | --- | --- |
| 201 | `{ "imageId": "img_Vb7kQ2nR9xLm4TzA", "contentType": "image/png", "bytes": 48213 }` | Put `imageId` in the `image` block as it is. |
| 400 | `{ "error": "Image body is empty." }` | Send the file bytes with `--data-binary @file`. |
| 413 | `{ "error": "Image exceeds 5242880 bytes." }` | Shrink or crop the image, or save it as JPEG or WEBP. |
| 415 | `{ "error": "Unsupported image type. Upload PNG, JPEG, WebP or GIF." }` | Convert the file to one of those four formats. An SVG must become a PNG. |
| 429 | `{ "error": "Rate limit exceeded. Try again in a minute." }` | Ten uploads per 60 seconds per IP. Wait a minute, then upload the rest. |

An upload is held unlinked. The brief links it when `POST /api/session` creates a brief that names the `imageId` in an `image` block, at the top level of a section or inside a `details`, within one hour of the upload. An upload that no brief names within that hour can no longer be linked and is never served, and the daily purge job deletes it. A linked image lives and expires with its brief, and one upload links to one brief only, so upload the file again for a second brief. The API links at most 50 images per brief.

Until a brief links it, the API never serves the image, so `GET /api/image/<imageId>` returns 404 `{ "error": "Image not found or expired." }` straight after the upload. That is expected; do not retry. A brief that names an unknown, expired, or already linked id still publishes, and the reader shows "Image is missing or has expired." in that block.
