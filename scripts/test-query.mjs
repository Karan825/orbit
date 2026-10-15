import { Client } from "@modelcontextprotocol/client";
import { StreamableHTTPClientTransport } from "@modelcontextprotocol/client";

async function main() {
    const rawKey = "urk_901b0dc7_b0T6oHNAEDY3rkcUpJBgJs6r84aZWFg2MllUUBsAu8k";
    // Connect with apiKey directly in the URL (URL + Key only, zero custom headers)
    const url = `http://app.localtest.me:8080/mcp?apiKey=${rawKey}`;
    const transport = new StreamableHTTPClientTransport(new URL(url));

    const client = new Client(
        { name: "inspector-simulator", version: "1.0.0" },
        { capabilities: {} }
    );

    await client.connect(transport);
    console.log("SUCCESS: Connected via URL query param apiKey!");

    const toolsResult = await client.listTools();
    console.log(`SUCCESS: Discovered ${toolsResult.tools.length} tools!`);
    console.log("Tools:", toolsResult.tools.map((t) => t.name).join(", "));

    await client.close();
    console.log("TEST PASSED!");
}

main().catch((err) => {
    console.error("Test failed:", err);
    process.exit(1);
});
