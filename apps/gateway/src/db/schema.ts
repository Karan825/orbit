import {
    pgTable,
    uuid,
    text,
    timestamp,
    boolean,
    integer,
    bigserial,
    jsonb,
    index,
    uniqueIndex,
} from "drizzle-orm/pg-core";

// 1. Users Table (Admin & Members)
export const users = pgTable("users", {
    id: uuid("id").defaultRandom().primaryKey(),
    email: text("email").notNull().unique(),
    displayName: text("display_name").notNull(),
    passwordHash: text("password_hash").notNull(),
    role: text("role").$type<"admin" | "member">().notNull().default("member"),
    status: text("status").$type<"active" | "disabled">().notNull().default("active"),
    createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
});

// 2. API Keys Table
export const apiKeys = pgTable(
    "api_keys",
    {
        id: uuid("id").defaultRandom().primaryKey(),
        userId: uuid("user_id").references(() => users.id, { onDelete: "set null" }),
        name: text("name").notNull(),
        keyPrefix: text("key_prefix").notNull().unique(), // e.g., 'urk_a1b2c3d4' for fast indexed lookup
        keyHash: text("key_hash").notNull(), // HMAC-SHA256 hex string with pepper
        lastFour: text("last_four").notNull(),
        expiresAt: timestamp("expires_at", { withTimezone: true }),
        revokedAt: timestamp("revoked_at", { withTimezone: true }),
        revokedBy: uuid("revoked_by").references(() => users.id, { onDelete: "set null" }),
        lastUsedAt: timestamp("last_used_at", { withTimezone: true }),
        createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
    },
    (table) => [
        uniqueIndex("api_keys_prefix_idx").on(table.keyPrefix),
    ],
);

// 3. Web Dashboard Sessions
export const sessions = pgTable("sessions", {
    tokenHash: text("token_hash").primaryKey(), // SHA-256 of session cookie token
    userId: uuid("user_id").notNull().references(() => users.id, { onDelete: "cascade" }),
    expiresAt: timestamp("expires_at", { withTimezone: true }).notNull(),
    lastSeenAt: timestamp("last_seen_at", { withTimezone: true }).defaultNow().notNull(),
});

// 4. Upstream Servers (Registered MCP upstreams)
export const upstreamServers = pgTable(
    "upstream_servers",
    {
        id: uuid("id").defaultRandom().primaryKey(),
        slug: text("slug").notNull().unique(), // immutable identifier (e.g. 'woocommerce')
        displayName: text("display_name").notNull(),
        url: text("url").notNull(),
        authType: text("auth_type").$type<"none" | "bearer" | "header">().notNull().default("none"),
        authHeaderName: text("auth_header_name"),
        authCiphertext: text("auth_ciphertext"), // AES-256-GCM encrypted secret
        authKeyVersion: integer("auth_key_version").default(1),
        enabled: boolean("enabled").notNull().default(true),
        timeoutMs: integer("timeout_ms").notNull().default(15000),
        updatedAt: timestamp("updated_at", { withTimezone: true }).defaultNow().notNull(),
    },
    (table) => [
        uniqueIndex("upstream_servers_slug_idx").on(table.slug),
    ],
);

// 5. Audit Events Table (Immutable Call Logging)
export const auditEvents = pgTable(
    "audit_events",
    {
        id: bigserial("id", { mode: "number" }).primaryKey(),
        requestId: text("request_id").notNull(),
        kind: text("kind").$type<"tool_call" | "access_denied">().notNull(),
        startedAt: timestamp("started_at", { withTimezone: true }).defaultNow().notNull(),
        durationMs: integer("duration_ms"),
        userId: uuid("user_id").references(() => users.id, { onDelete: "set null" }),
        userEmail: text("user_email"),
        apiKeyId: uuid("api_key_id").references(() => apiKeys.id, { onDelete: "set null" }),
        channel: text("channel").$type<"mcp" | "chat">().notNull(),
        chatSessionId: uuid("chat_session_id"),
        serverId: uuid("server_id").references(() => upstreamServers.id, { onDelete: "set null" }),
        serverSlug: text("server_slug"),
        toolName: text("tool_name"),
        exposedName: text("exposed_name"),
        outcome: text("outcome").$type<
            "pending" | "success" | "tool_error" | "timeout" | "upstream_error" | "denied" | "unavailable" | "interrupted"
        >().notNull().default("pending"),
        errorCode: text("error_code"),
        errorMessage: text("error_message"),
        argsPreview: jsonb("args_preview"),
        resultBytes: integer("result_bytes"),
    },
    (table) => [
        index("audit_events_started_at_idx").on(table.startedAt),
        index("audit_events_user_idx").on(table.userId, table.startedAt),
        index("audit_events_server_idx").on(table.serverId, table.startedAt),
    ],
);
