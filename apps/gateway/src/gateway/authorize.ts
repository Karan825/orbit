import type { userRole, Principal } from "../auth/principal.js";

/**
 * List of mutation/write tool base names that require the 'admin' role.
 * Any tool not in this set defaults to 'member' (read-only accessible).
 */
export const ADMIN_ONLY_TOOLS = new Set<string>([
    "create_product",
    "update_order",
    "update_order_status",
    "update_shipment",
    "update_shipment_status",
    "create_restock_request",
]);

/**
 * Extracts base tool name from exposed name (<slug>__<tool> or <slug>_<tool>)
 */
export function extractBaseToolName(name: string): string {
    if (name.includes("__")) {
        return name.split("__")[1];
    }
    // Fallback if single underscore was used
    const firstUnderscore = name.indexOf("_");
    if (firstUnderscore !== -1) {
        return name.substring(firstUnderscore + 1);
    }
    return name;
}

/**
 * Returns the minimum required role for a given tool.
 */
export function getRequiredRoleForTool(toolName: string): userRole {
    const baseName = extractBaseToolName(toolName);
    return ADMIN_ONLY_TOOLS.has(baseName) ? "admin" : "member";
}

/**
 * Checks whether a given role is permitted to call the tool.
 * - 'admin' can call everything.
 * - 'member' can only call tools that require 'member'.
 */
export function isToolAuthorized(role: userRole, toolName: string): boolean {
    if (role === "admin") {
        return true;
    }
    const requiredRole = getRequiredRoleForTool(toolName);
    return requiredRole === "member";
}

/**
 * Authorizes a tool call against the authenticated Principal.
 */
export function authorizeToolCall(
    principal: Principal,
    toolName: string,
): { allowed: true } | { allowed: false; error: string } {
    if (isToolAuthorized(principal.role, toolName)) {
        return { allowed: true };
    }

    return {
        allowed: false,
        error: `Forbidden: not permitted for role ${principal.role}`,
    };
}
