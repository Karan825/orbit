import { createMcpHandler, McpServer } from "@modelcontextprotocol/server";
import { Hono } from "hono";
import { serve } from "@hono/node-server";
import * as WooCommerceModule from "@woocommerce/woocommerce-rest-api";
import { z } from "zod";

// Describe the product fields we use from WooCommerce.
interface WooCommerceProduct {
  id: number;
  name: string;
  price: string;
}

// Describe the order fields we use from WooCommerce.
interface WooCommerceOrder {
  id: number;
  status: string;
  date_created: string;
  date_modified?: string;
  total: string;
  currency?: string;
  customer_id?: number;
  billing?: Record<string, unknown>;
  shipping?: Record<string, unknown>;
  payment_method?: string;
  payment_method_title?: string;
  line_items?: Array<{
    id: number;
    name: string;
    product_id: number;
    quantity: number;
    subtotal?: string;
    total: string;
  }>;
}

// Initialize the WooCommerce REST API client.
const WooCommerceRestApi = WooCommerceModule.default.default;

const wooCommerce = new WooCommerceRestApi({
  url: process.env.WC_STORE_URL!,
  consumerKey: process.env.WC_CONSUMER_KEY!,
  consumerSecret: process.env.WC_CONSUMER_SECRET!,
  version: "wc/v3",
});

// Create the Hono application.
const app = new Hono();

// Create the MCP handler and register our tools.
const mcpHandler = createMcpHandler(() => {
  const mcpServer = new McpServer({
    name: "woocommerce-mcp",
    version: "1.0.0",
  });

  // Tool 1: List products from the real WooCommerce store.
  mcpServer.registerTool(
    "list_products",
    {
      description: "List products available in the store",
    },
    async () => {
      const response = await wooCommerce.get("products", {
        per_page: 10,
      });

      const products = (
        response.data as WooCommerceProduct[]
      ).map(({ id, name, price }) => ({
        id,
        name,
        price,
      }));

      return {
        content: [
          {
            type: "text",
            text: JSON.stringify(products),
          },
        ],
      };
    },
  );

  // Tool 2: Create a product in WooCommerce.
  mcpServer.registerTool(
    "create_product",
    {
      description: "Create a product in the WooCommerce store",
      inputSchema: {
        name: z.string().trim().min(1).describe("Product name"),
        price: z
          .string()
          .regex(/^\d+(\.\d{1,2})?$/)
          .describe("Product price, e.g. 499 or 499.50"),
      },
    },
    async ({ name, price }) => {
      const response = await wooCommerce.post("products", {
        name,
        regular_price: price,
        status: "draft",
      });

      const product = response.data as WooCommerceProduct;

      return {
        content: [
          {
            type: "text",
            text: JSON.stringify({
              id: product.id,
              name: product.name,
              price: product.price,
            }),
          },
        ],
      };
    },
  );

  // Tool 3: List recent orders
  mcpServer.registerTool(
    "list_orders",
    {
      description: "List recent WooCommerce orders",
      inputSchema: {
        limit: z.number().int().min(1).max(50).default(10)
          .describe("Maximum number of orders to return"),
      },
    },
    async ({ limit }) => {
      const response = await wooCommerce.get("orders", {
        per_page: limit,
        orderby: "date",
        order: "desc",
      });

      const orders = response.data.map(
        (order: {
          id: number;
          status: string;
          date_created: string;
          total: string;
        }) => ({
          id: order.id,
          status: order.status,
          date_created: order.date_created,
          total: order.total,
        }),
      );

      return {
        content: [
          {
            type: "text",
            text: JSON.stringify(orders),
          },
        ],
      };
    },
  );

  // Tool 4: Retrieve one order by ID
  mcpServer.registerTool(
    "get_order",
    {
      description: "Retrieve one order by ID",
      inputSchema: {
        id: z.number().int().positive().describe("Order ID"),
      },
    },
    async ({ id }) => {
      const response = await wooCommerce.get(`orders/${id}`);
      const order = response.data as WooCommerceOrder;

      return {
        content: [
          {
            type: "text",
            text: JSON.stringify({
              id: order.id,
              status: order.status,
              date_created: order.date_created,
              total: order.total,
              currency: order.currency,
              customer_id: order.customer_id,
              billing: order.billing,
              shipping: order.shipping,
              payment_method: order.payment_method_title || order.payment_method,
              line_items: order.line_items?.map((item) => ({
                id: item.id,
                name: item.name,
                product_id: item.product_id,
                quantity: item.quantity,
                subtotal: item.subtotal,
                total: item.total,
              })),
            }),
          },
        ],
      };
    },
  );

  // Tool 5: Update an order's status
  mcpServer.registerTool(
    "update_order",
    {
      description: "Update an order's status",
      inputSchema: {
        id: z.number().int().positive().describe("Order ID"),
        status: z
          .string()
          .trim()
          .min(1)
          .describe("New order status (e.g. pending, processing, on-hold, completed, cancelled, refunded, failed)"),
      },
    },
    async ({ id, status }) => {
      const response = await wooCommerce.put(`orders/${id}`, { status });
      const order = response.data as WooCommerceOrder;

      return {
        content: [
          {
            type: "text",
            text: JSON.stringify({
              id: order.id,
              status: order.status,
              date_modified: order.date_modified,
              total: order.total,
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

// Health-check endpoint for Kubernetes.
app.get("/healthz", (c) => {
  return c.json({ status: "ok" });
});

// Start the HTTP server.
serve({
  fetch: app.fetch,
  port: 3001,
});
