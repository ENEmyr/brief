# Uploading an image

`image` block names image API already holds. Upload each file first, put returned `imageId` in block, then create brief.

```bash
curl -sS -X POST https://brief-api.algoryth.me/api/image \
  -H 'content-type: image/png' \
  --data-binary @screenshot.png
```

Body = raw file bytes via `--data-binary`, not form or JSON. Set `content-type` header to file's image type. API not trust header - reads file's first bytes instead. Accepts PNG, JPEG, GIF, WEBP only. SVG refused. Max 5242880 bytes (5 MiB) per file.

| Status | Body | What to do |
| --- | --- | --- |
| 201 | `{ "imageId": "img_Vb7kQ2nR9xLm4TzA", "contentType": "image/png", "bytes": 48213 }` | Put `imageId` in `image` block as-is. |
| 400 | `{ "error": "Image body is empty." }` | Send file bytes with `--data-binary @file`. |
| 413 | `{ "error": "Image exceeds 5242880 bytes." }` | Shrink/crop image, or save as JPEG or WEBP. |
| 415 | `{ "error": "Unsupported image type. Upload PNG, JPEG, WebP or GIF." }` | Convert to one of those four formats. SVG must become PNG. |
| 429 | `{ "error": "Rate limit exceeded. Try again in a minute." }` | Ten uploads per 60 seconds per IP. Wait a minute, upload rest. |

Upload held unlinked. Brief links it when `POST /api/session` creates brief naming the `imageId` in `image` block (top level of section or inside `details`) within one hour of upload. Upload no brief names within that hour: can't be linked, never served, daily purge job deletes it. Linked image lives and expires with its brief. One upload links to one brief only - upload again for second brief. Max 50 linked images per brief.

Until brief links it, API never serves image, so `GET /api/image/<imageId>` returns 404 `{ "error": "Image not found or expired." }` right after upload. Expected; no retry. Brief naming unknown, expired, or already-linked id still publishes; reader shows "Image is missing or has expired." in that block.
