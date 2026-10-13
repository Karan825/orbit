import { createMcpHandler, McpServer } from "@modelcontextprotocol/server";
import { Hono } from "hono";
import { serve } from "@hono/node-server";
import { z } from "zod";

// Shipment model interfaces
interface ShipmentItem {
  product_id: number;
  name: string;
  quantity: number;
}

interface Shipment {
  id: string;
  order_id: number;
  tracking_number: string;
  carrier: string;
  status: "pending" | "processing" | "in_transit" | "out_for_delivery" | "delivered" | "cancelled";
  destination: {
    name: string;
    street: string;
    city: string;
    state: string;
    postal_code: string;
    country: string;
  };
  items: ShipmentItem[];
  created_at: string;
  updated_at: string;
  estimated_delivery: string;
}

// In-memory mock shipments dataset
const shipments: Shipment[] = [
  {
    id: "SHP-1001",
    order_id: 101,
    tracking_number: "TRK982341123",
    carrier: "FedEx",
    status: "in_transit",
    destination: {
      name: "Alice Johnson",
      street: "742 Evergreen Terrace",
      city: "Springfield",
      state: "OR",
      postal_code: "97477",
      country: "US",
    },
    items: [
      { product_id: 1, name: "Premium Cotton T-Shirt", quantity: 2 },
    ],
    created_at: "2026-10-10T09:30:00Z",
    updated_at: "2026-10-11T14:15:00Z",
    estimated_delivery: "2026-10-14T18:00:00Z",
  },
  {
    id: "SHP-1002",
    order_id: 102,
    tracking_number: "TRK543219876",
    carrier: "UPS",
    status: "delivered",
    destination: {
      name: "Bob Smith",
      street: "221B Baker Street",
      city: "London",
      state: "Greater London",
      postal_code: "NW1 6XE",
      country: "UK",
    },
    items: [
      { product_id: 2, name: "Ceramic Coffee Mug", quantity: 4 },
      { product_id: 3, name: "Fleece Hoodie", quantity: 1 },
    ],
    created_at: "2026-10-08T11:00:00Z",
    updated_at: "2026-10-11T16:45:00Z",
    estimated_delivery: "2026-10-11T16:00:00Z",
  },
  {
    id: "SHP-1003",
    order_id: 103,
    tracking_number: "TRK112233445",
    carrier: "DHL",
    status: "pending",
    destination: {
      name: "Carol Danvers",
      street: "10880 Wilshire Blvd",
      city: "Los Angeles",
      state: "CA",
      postal_code: "90024",
      country: "US",
    },
    items: [
      { product_id: 3, name: "Fleece Hoodie", quantity: 2 },
    ],
    created_at: "2026-10-12T08:00:00Z",
    updated_at: "2026-10-12T08:00:00Z",
    estimated_delivery: "2026-10-16T18:00:00Z",
  },
];

// Create the Hono application.
const app = new Hono();

// Create the MCP handler and register tools.
const mcpHandler = createMcpHandler(() => {
  const mcpServer = new McpServer({
    name: "fulfillment-mcp",
    version: "1.0.0",
  });

  // Tool 1: list_shipments
  mcpServer.registerTool(
    "list_shipments",
    {
      description: "List all shipments with optional status or order ID filtering",
      inputSchema: {
        status: z
          .string()
          .optional()
          .describe("Filter shipments by status (e.g. pending, in_transit, out_for_delivery, delivered, cancelled)"),
        order_id: z
          .number()
          .optional()
          .describe("Filter shipments by order ID"),
        limit: z
          .number()
          .int()
          .min(1)
          .max(50)
          .default(10)
          .describe("Maximum number of shipments to return"),
      },
    },
    async ({ status, order_id, limit }) => {
      let filtered = shipments;

      if (status) {
        filtered = filtered.filter(
          (s) => s.status.toLowerCase() === status.toLowerCase(),
        );
      }

      if (order_id !== undefined) {
        filtered = filtered.filter((s) => s.order_id === order_id);
      }

      const results = filtered.slice(0, limit);

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

  // Tool 2: get_shipment
  mcpServer.registerTool(
    "get_shipment",
    {
      description: "Retrieve shipment details by shipment ID or tracking number",
      inputSchema: {
        id: z
          .string()
          .trim()
          .min(1)
          .describe("Shipment ID (e.g. SHP-1001) or tracking number"),
      },
    },
    async ({ id }) => {
      const shipment = shipments.find(
        (s) =>
          s.id.toLowerCase() === id.toLowerCase() ||
          s.tracking_number.toLowerCase() === id.toLowerCase(),
      );

      if (!shipment) {
        return {
          isError: true,
          content: [
            {
              type: "text",
              text: `Shipment not found for identifier: "${id}"`,
            },
          ],
        };
      }

      return {
        content: [
          {
            type: "text",
            text: JSON.stringify(shipment),
          },
        ],
      };
    },
  );

  // Tool 3: update_shipment_status
  mcpServer.registerTool(
    "update_shipment_status",
    {
      description: "Update the status of a shipment",
      inputSchema: {
        id: z
          .string()
          .trim()
          .min(1)
          .describe("Shipment ID (e.g. SHP-1001) or tracking number"),
        status: z
          .enum([
            "pending",
            "processing",
            "in_transit",
            "out_for_delivery",
            "delivered",
            "cancelled",
          ])
          .describe("New shipment status"),
      },
    },
    async ({ id, status }) => {
      const shipment = shipments.find(
        (s) =>
          s.id.toLowerCase() === id.toLowerCase() ||
          s.tracking_number.toLowerCase() === id.toLowerCase(),
      );

      if (!shipment) {
        return {
          isError: true,
          content: [
            {
              type: "text",
              text: `Shipment not found for identifier: "${id}"`,
            },
          ],
        };
      }

      shipment.status = status;
      shipment.updated_at = new Date().toISOString();

      return {
        content: [
          {
            type: "text",
            text: JSON.stringify({
              id: shipment.id,
              tracking_number: shipment.tracking_number,
              status: shipment.status,
              updated_at: shipment.updated_at,
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
  port: Number(process.env.PORT) || 3002,
});
