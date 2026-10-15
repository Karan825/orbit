import { Client } from "@modelcontextprotocol/client";
import { StreamableHTTPClientTransport } from "@modelcontextprotocol/client";

async function main() {
    const rawKey = "urk_901b0dc7_b0T6oHNAEDY3rkcUpJBgJs6r84aZWFg2MllUUBsAu8k";
    const transport = new StreamableHTTPClientTransport(
        new URL("http://app.localtest.me:8080/mcp"),
        {
            requestInit: {
                headers: {
                    Authorization: `Bearer ${rawKey}`,
                },
            },
        }
    );

    const client = new Client(
        { name: "test-client", version: "1.0.0" },
        { capabilities: {} }
    );

    await client.connect(transport);
    console.log("SUCCESS: Connected to /mcp with Bearer key!");

    const toolsResult = await client.listTools();
    console.log(`SUCCESS: Discovered ${toolsResult.tools.length} tools!`);
    console.log("Tools:", toolsResult.tools.map((t) => t.name).join(", "));

    // Test calling a tool
    console.log("\nCalling woocommerce_list_products...");
    const callResult = await client.callTool({
        name: "woocommerce_list_products",
        arguments: {},
    });
    console.log("Tool call response:", JSON.stringify(callResult));

    await client.close();
    console.log("\nJourney 1: ALL TESTS PASSED!");
}

main().catch((err) => {
    console.error("Test failed:", err);
    process.exit(1);
});
