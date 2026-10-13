
import { Hono } from "hono";
import { serve } from "@hono/node-server";

// 1. Create the Hono application
const app = new Hono();

// 2. Define a health-check route
app.get("/healthz", (c) => {
  return c.json({ status: "ok" });
});

// 3. Start the HTTP server
serve({
  fetch: app.fetch,
  port: 3001,
});

