import { eq } from "drizzle-orm";
import { db } from "./client.js";
import { users, upstreamServers } from "./schema.js";
import { ApiKeyStore, type GeneratedKey } from "../auth/api-keys.js";

export async function bootstrapSystem(apiKeyStore: ApiKeyStore): Promise<{ adminKey?: GeneratedKey }> {
    // 1. Ensure at least one Admin user exists
    const existingUsers = await db
        .select()
        .from(users)
        .where(eq(users.role, "admin"))
        .limit(1);

    let adminId: string;
    let createdAdminKey: GeneratedKey | undefined;

    if (existingUsers.length === 0) {
        const [newAdmin] = await db
            .insert(users)
            .values({
                email: process.env.BOOTSTRAP_ADMIN_EMAIL || "admin@urumi.local",
                displayName: "System Administrator",
                // In production, argon2 hash. For dev initial seed, a placeholder:
                passwordHash: "seed_admin_hash_must_rotate",
                role: "admin",
                status: "active",
            })
            .returning();

        adminId = newAdmin.id;
        console.log(`[Bootstrap] Created initial Admin user (${newAdmin.email})`);

        // Generate the initial Admin API Key
        createdAdminKey = await apiKeyStore.createKey({
            userId: adminId,
            name: "Initial Admin Master Key",
        });

        console.log(`\n==================================================`);
        console.log(`[Auth] Bootstrap Admin API Key generated:`);
        console.log(`       ${createdAdminKey.rawKey}`);
        console.log(`==================================================\n`);
    } else {
        adminId = existingUsers[0].id;
    }

    // 2. Idempotent seed for upstream servers
    const defaultServers = [
        {
            slug: "woocommerce",
            displayName: "WooCommerce (store-main)",
            url: process.env.WOO_MCP_URL || "http://127.0.0.1:3001/mcp",
            authType: "none" as const,
        },
        {
            slug: "fulfillment",
            displayName: "Fulfillment (3PL)",
            url: process.env.FULFILLMENT_MCP_URL || "http://127.0.0.1:3002/mcp",
            authType: "none" as const,
        },
        {
            slug: "supplier",
            displayName: "Supplier Network",
            url: process.env.SUPPLIER_MCP_URL || "http://127.0.0.1:3003/mcp",
            authType: "none" as const,
        },
    ];

    for (const s of defaultServers) {
        await db
            .insert(upstreamServers)
            .values(s)
            .onConflictDoNothing({ target: upstreamServers.slug });
    }

    return { adminKey: createdAdminKey };
}
