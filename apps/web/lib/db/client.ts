import { drizzle, type DrizzleD1Database } from "drizzle-orm/d1";
import type { D1Database } from "@cloudflare/workers-types";
import * as schema from "./schema";

export type Db = DrizzleD1Database<typeof schema>;

export function createDb(binding: D1Database): Db {
  return drizzle(binding, { schema });
}
