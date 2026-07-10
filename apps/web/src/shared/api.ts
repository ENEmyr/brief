// Base URL for the Brief API worker. Read once from the env at import time;
// every feature that talks to the API imports this instead of re-reading
// process.env, so the fallback host only needs to live in one place.
export const API_URL = process.env.NEXT_PUBLIC_API_URL ?? 'http://localhost:8787'
