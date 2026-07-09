import { sqliteTable, text, integer, index } from 'drizzle-orm/sqlite-core'

export const sessions = sqliteTable(
  'sessions',
  {
    id: text('id').primaryKey(),
    // plain session: JSON string of Payload. protected session: base64 AES-GCM ciphertext.
    payload: text('payload').notNull(),
    title: text('title').notNull(),
    saved: integer('saved', { mode: 'boolean' }).notNull().default(false),
    encrypted: integer('encrypted', { mode: 'boolean' }).notNull().default(false),
    // JSON string {salt, iv, iterations} when encrypted, else null
    encParams: text('enc_params'),
    createdAt: integer('created_at').notNull(),
    lastOpenedAt: integer('last_opened_at').notNull(),
    expiresAt: integer('expires_at').notNull(),
  },
  (t) => [index('idx_sessions_expires').on(t.expiresAt)],
)
