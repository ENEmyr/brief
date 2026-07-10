import { drizzle, type DrizzleD1Database } from 'drizzle-orm/d1'
import { DAY_MS } from './time'

export const UNSAVED_TTL_MS = 7 * DAY_MS
export const SAVED_TTL_MS = 90 * DAY_MS

export function db(d1: D1Database): DrizzleD1Database {
  return drizzle(d1)
}

export function touchWindow(saved: boolean): number {
  return saved ? SAVED_TTL_MS : UNSAVED_TTL_MS
}
