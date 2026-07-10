# 0001: Client-side end-to-end encryption for protected sessions

Brief is a public, unauthenticated documentation platform: anyone holding a session URL can read the session, and some published documents contain sensitive analysis. We decided that protection means the server can never read the content, so encryption and decryption happen only in the browser: PBKDF2-SHA256 with 600000 iterations derives an AES-256-GCM key from a reader-chosen password, and the server stores only the ciphertext and the encryption parameters, never the password or a derived key.

## Consequences

A lost password means the content is permanently unrecoverable; there is no reset or recovery path because the server holds nothing that could decrypt the session.

The `/raw` markdown export returns 403 for a protected session, since the server cannot render ciphertext. An agent that needs continued access to a document must keep its own copy of the payload.

The title is blanked server-side at encrypt time. The title is payload content, not metadata, so the server must not retain a readable copy of it next to the ciphertext.

Reader state becomes memory-only on the client. At encrypt time the server purges the plaintext state blob from KV, because it contains document excerpts (highlighted text, notes, ask questions), and it rejects any further state writes for the session with 403 so a stale client cannot re-create a plaintext copy.

The ciphertext cap of 1950000 characters, chosen to sit under D1's row size ceiling with base64 overhead, bounds encryptable documents to roughly 1.4 MB of payload JSON. Larger documents can be published and saved but not protected.

No server-side search or indexing of protected content is possible, now or later; any future feature that needs to read session content will exclude protected sessions by construction.
