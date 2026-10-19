# `image`

A picture the agent uploaded first, such as a screenshot of a bug or a chart from another tool. The block holds only the id that the image API returned, never a URL, a path, or inline data. Upload the file with `POST /api/image` before you create the brief, as `reference/images.md` says.

| Field | Required | Type |
| --- | --- | --- |
| `type` | yes | `"image"` |
| `imageId` | yes | string matching `^[\w-]{8,64}$`: 8 to 64 letters, digits, `_`, or `-`. Use the `imageId` from the upload response as it is. A URL or a file path fails validation. |
| `alt` | yes | `label`, what the image shows, for a reader who cannot see it |
| `caption` | no | `label` |
| `width` | no | integer from 1 to 10000, the width in pixels |
| `height` | no | integer from 1 to 10000, the height in pixels |

Give `width` and `height` together: only then does the reader reserve the box before the image loads. If the id is unknown, was never linked, or has expired, the brief still publishes and the block shows "Image is missing or has expired."

```json
{
  "type": "image",
  "imageId": "img_Vb7kQ2nR9xLm4TzA",
  "alt": "The error page a client sees after its eleventh request in one minute",
  "caption": "429 page in production",
  "width": 1280,
  "height": 720
}
```
