import { defineConfig } from "drizzle-kit";

export default defineConfig({
    schema: "./src/db/schema.ts",
    out: "./drizzle",
    dialect: "postgresql",
    dbCredentials: {
        url:
            process.env.DATABASE_URL ||
            "postgres://urumi:urumi_secure_password_2026@127.0.0.1:5432/urumi",
    },
});
