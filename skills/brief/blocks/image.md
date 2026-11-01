# `image`

Picture agent uploaded first, e.g. bug screenshot or chart from other tool. Block holds only id image API returned - never URL, path, or inline data. Upload file with `POST /api/image` before creating brief, per `reference/images.md` in the skill folder.

| Field | Required | Type |
| --- | --- | --- |
| `type` | yes | `"image"` |
| `imageId` | yes | string matching `^[\w-]{8,64}$`: 8-64 letters, digits, `_`, or `-`. Use `imageId` from upload response as-is. URL or file path fails validation. |
| `alt` | yes | `label`, what image shows, for reader who cannot see it |
| `caption` | no | `label` |
| `width` | no | integer 1-10000, width in pixels |
| `height` | no | integer 1-10000, height in pixels |

Give `width` and `height` together: only then reader reserves box before image loads. Id unknown, never linked, or expired -> brief still publishes, block shows "Image is missing or has expired."

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

An annotated screenshot (numbered markers drawn on controls, with a table that maps each number to what it calls): match each marker to the control's event handler in the source, not to how the control looks, and check that the API allows every control the picture shows in the state shown. A picture of an enabled button that the API refuses in that state is a wrong fact.
