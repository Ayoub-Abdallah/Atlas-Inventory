import { drizzle } from 'drizzle-orm/d1';
import * as schema from '../database/schema';

export { schema as tables };

// NuxtHub uses local SQLite in development mode (.data/hub/d1/default.sqlite)
// and Cloudflare D1 in production
export function useDB() {
  return drizzle(hubDatabase(), { schema });
}

export const useDrizzle = useDB;
