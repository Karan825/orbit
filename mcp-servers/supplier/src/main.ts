import { createMcpHandler, McpServer } from "@modelcontextprotocol/server";
import { Hono } from "hono";
import { serve } from "@hono/node-server";
import { z } from "zod";

// Supplier data models
interface Supplier {
  id: string;
  name: string;
  contact_email: string;
  phone: string;
  lead_time_days: number;
  rating: number;
  categories: string[];
}

interface InventoryItem {
  sku: string;
  product_name: string;
  supplier_id: string;
  stock_level: number;
  reorder_threshold: number;
  unit_cost: number;
}

interface RestockRequest {
  id: string;
  supplier_id: string;
  sku: string;
  quantity: number;
  status: "submitted" | "approved" | "in_transit" | "fulfilled";
  estimated_delivery_date: string;
  created_at: string;
  notes?: string;
}

// Mock Suppliers
const suppliers: Supplier[] = [
  {
    id: "SUP-001",
    name: "Apex Apparel Mills",
    contact_email: "orders@apexapparel.example.com",
    phone: "+1-555-0199",
    lead_time_days: 4,
    rating: 4.8,
    categories: ["apparel", "clothing"],
  },
  {
    id: "SUP-002",
    name: "Nordic Ceramic Works",
    contact_email: "wholesale@nordicceramics.example.com",
    phone: "+44-20-7946-0123",
    lead_time_days: 7,
    rating: 4.6,
    categories: ["home", "drinkware"],
  },
  {
    id: "SUP-003",
    name: "Pacific Tech & Accessories",
    contact_email: "b2b@pacifictech.example.com",
    phone: "+1-555-0144",
    lead_time_days: 3,
    rating: 4.9,
    categories: ["accessories", "electronics"],
  },
];

// Mock Inventory
const inventory: InventoryItem[] = [
  {
    sku: "SKU-TSHIRT-BLK",
    product_name: "Premium Cotton T-Shirt (Black)",
    supplier_id: "SUP-001",
    stock_level: 45,
    reorder_threshold: 20,
    unit_cost: 9.5,
  },
  {
    sku: "SKU-HOODIE-GRY",
    product_name: "Fleece Hoodie (Grey)",
    supplier_id: "SUP-001",
    stock_level: 8,
    reorder_threshold: 15,
    unit_cost: 22.0,
  },
  {
    sku: "SKU-MUG-CER",
    product_name: "Ceramic Coffee Mug (12oz)",
    supplier_id: "SUP-002",
    stock_level: 120,
    reorder_threshold: 30,
    unit_cost: 4.25,
  },
  {
    sku: "SKU-BOTTLE-STEEL",
    product_name: "Insulated Stainless Bottle",
    supplier_id: "SUP-003",
    stock_level: 5,
    reorder_threshold: 25,
    unit_cost: 11.0,
  },
];

// Mock Restock Requests history
const restockRequests: RestockRequest[] = [
  {
    id: "REQ-2001",
    supplier_id: "SUP-001",
    sku: "SKU-HOODIE-GRY",
    quantity: 50,
    status: "in_transit",
    estimated_delivery_date: "2026-10-15T00:00:00Z",
    created_at: "2026-10-11T10:00:00Z",
    notes: "Urgent seasonal replenishment",
  },
];

// Create the Hono application.
const app = new Hono();

// Create the MCP handler and register tools.
const mcpHandler = createMcpHandler(() => {
  const mcpServer = new McpServer({
    name: "supplier-mcp",
    version: "1.0.0",
  });

  // Tool 1: list_suppliers
  mcpServer.registerTool(
    "list_suppliers",
    {
      description: "List all approved suppliers and their details",
      inputSchema: {
        category: z
          .string()
          .optional()
          .describe("Filter suppliers by product category (e.g. apparel, drinkware, accessories)"),
      },
    },
    async ({ category }) => {
      let results = suppliers;

      if (category) {
        const catLower = category.toLowerCase();
        results = results.filter((s) =>
          s.categories.some((c) => c.toLowerCase().includes(catLower)),
        );
      }

      return {
        content: [
          {
            type: "text",
            text: JSON.stringify(results),
          },
        ],
      };
    },
  );

  // Tool 2: check_inventory
  mcpServer.registerTool(
    "check_inventory",
    {
      description: "Check inventory levels and stock status from suppliers",
      inputSchema: {
        sku: z
          .string()
          .optional()
          .describe("Filter by specific SKU (e.g. SKU-TSHIRT-BLK)"),
        low_stock_only: z
          .boolean()
          .default(false)
          .describe("Return only items whose stock level is at or below the reorder threshold"),
      },
    },
    async ({ sku, low_stock_only }) => {
      let items = inventory;

      if (sku) {
        items = items.filter((i) => i.sku.toLowerCase() === sku.toLowerCase());
      }

      if (low_stock_only) {
        items = items.filter((i) => i.stock_level <= i.reorder_threshold);
      }

      const results = items.map((item) => {
        let status: "out_of_stock" | "low_stock" | "in_stock" = "in_stock";
        if (item.stock_level === 0) {
          status = "out_of_stock";
        } else if (item.stock_level <= item.reorder_threshold) {
          status = "low_stock";
        }

        return {
          ...item,
          status,
          needs_reorder: item.stock_level <= item.reorder_threshold,
        };
      });

      return {
        content: [
          {
            type: "text",
            text: JSON.stringify(results),
          },
        ],
      };
    },
  );

  // Tool 3: create_restock_request
  mcpServer.registerTool(
    "create_restock_request",
    {
      description: "Create a restock purchase request to a supplier",
      inputSchema: {
        supplier_id: z
          .string()
          .trim()
          .min(1)
          .describe("Supplier ID (e.g. SUP-001)"),
        sku: z
          .string()
          .trim()
          .min(1)
          .describe("Product SKU to reorder"),
        quantity: z
          .number()
          .int()
          .positive()
          .describe("Quantity to order"),
        notes: z
          .string()
          .optional()
          .describe("Optional notes or delivery instructions"),
      },
    },
    async ({ supplier_id, sku, quantity, notes }) => {
      const supplier = suppliers.find(
        (s) => s.id.toLowerCase() === supplier_id.toLowerCase(),
      );

      if (!supplier) {
        return {
          isError: true,
          content: [
            {
              type: "text",
              text: `Supplier not found for ID: "${supplier_id}"`,
            },
          ],
        };
      }

      const item = inventory.find(
        (i) => i.sku.toLowerCase() === sku.toLowerCase(),
      );

      const leadDays = supplier.lead_time_days || 5;
      const estimatedDelivery = new Date(
        Date.now() + leadDays * 24 * 60 * 60 * 1000,
      ).toISOString();

      const newRequest: RestockRequest = {
        id: `REQ-${2000 + restockRequests.length + 1}`,
        supplier_id: supplier.id,
        sku: item ? item.sku : sku,
        quantity,
        status: "submitted",
        estimated_delivery_date: estimatedDelivery,
        created_at: new Date().toISOString(),
        notes,
      };

      restockRequests.push(newRequest);

      const totalCost = item ? item.unit_cost * quantity : undefined;

      return {
        content: [
          {
            type: "text",
            text: JSON.stringify({
              request: newRequest,
              supplier_name: supplier.name,
              product_name: item?.product_name,
              estimated_total_cost: totalCost,
              message: "Restock request submitted successfully",
            }),
          },
        ],
      };
    },
  );

  return mcpServer;
});

// Expose the MCP endpoint.
app.all("/mcp", (c) => {
  return mcpHandler.fetch(c.req.raw);
});

// Health-check endpoint for Kubernetes / orchestration.
app.get("/healthz", (c) => {
  return c.json({ status: "ok" });
});

// Start the HTTP server.
serve({
  fetch: app.fetch,
  port: Number(process.env.PORT) || 3003,
});
