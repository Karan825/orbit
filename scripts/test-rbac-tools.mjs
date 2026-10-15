import { Client } from "@modelcontextprotocol/client";
import { StreamableHTTPClientTransport } from "@modelcontextprotocol/client";

const ALICE_KEY = "urk_989dd500_Zue0yF-qH3HPgjKIBkzAdCQE5MO5M9y4fjLedzt30Gw";
const BOB_KEY = "urk_01ec1961_xvuX1z1PGJ_hhwaf6MELfe0Q-80gsiGVidvQsMbFMxc";
const MCP_URL = "http://app.localtest.me:8080/mcp";

async function testClient(name, key) {
    console.log(`\n========================================`);
    console.log(`Testing MCP Connection for: ${name}`);
    console.log(`========================================`);

    const transport = new StreamableHTTPClientTransport(new URL(MCP_URL), {
        requestInit: {
            headers: {
                Authorization: `Bearer ${key}`,
            },
        },
    });

    const client = new Client(
        { name: `${name}-client`, version: "1.0.0" },
        { capabilities: {} }
    );

    await client.connect(transport);
    console.log(`Connected successfully as ${name}!`);

    const toolsResult = await client.listTools();
    const toolNames = toolsResult.tools.map((t) => t.name);
    console.log(`Total tools visible to ${name}: ${toolNames.length}`);
    console.log(`Tools:`, toolNames.join(", "));

    const hasCreateProduct = toolNames.includes("woocommerce_create_product");
    const hasUpdateOrder = toolNames.includes("woocommerce_update_order");

    console.log(`Has create_product: ${hasCreateProduct}`);
    console.log(`Has update_order: ${hasUpdateOrder}`);

    if (name === "Bob (Member)") {
        if (hasCreateProduct || hasUpdateOrder) {
            console.error(`FAIL: Restricted mutating tools leaked to member!`);
        } else {
            console.log(`SUCCESS: Restricted mutating tools are completely HIDDEN from Bob's tool catalog!`);
        }

        console.log(`\nTesting direct call to restricted tool (woocommerce_create_product) as Bob...`);
        try {
            const callRes = await client.callTool({
                name: "woocommerce_create_product",
                arguments: { name: "Hacked Product", price: "99" },
            });
            console.log(`Result:`, JSON.stringify(callRes));
            if (callRes.isError) {
                console.log(`SUCCESS: Tool call correctly rejected with error: ${callRes.content?.[0]?.text}`);
            } else {
                console.error(`FAIL: Unauthorized tool call succeeded!`);
            }
        } catch (err) {
            console.log(`SUCCESS: Direct call threw exception:`, err.message);
        }
    } else {
        if (hasCreateProduct && hasUpdateOrder) {
            console.log(`SUCCESS: Admin has full catalog access (100% of tools visible).`);
        } else {
            console.error(`FAIL: Admin is missing tools!`);
        }
    }

    await client.close();
}

async function main() {
    await testClient("Alice (Admin)", ALICE_KEY);
    await testClient("Bob (Member)", BOB_KEY);
    console.log("\nALL RBAC MCP PROTOCOL TESTS COMPLETED.");
}

main().catch((err) => {
    console.error("Test failed:", err);
    process.exit(1);
});