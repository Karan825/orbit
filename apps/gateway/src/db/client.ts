import pg from "pg";
import { drizzle } from "drizzle-orm/node-postgres";
import * as schema from "./schema.js";

const { Pool } = pg;

const connectionString =
    process.env.DATABASE_URL ||
    "postgres://urumi:urumi_secure_password_2026@127.0.0.1:5432/urumi";

export const pool = new Pool({
    connectionString,
    max: 10,
    idleTimeoutMillis: 30000,
});

export const db = drizzle(pool, { schema });
