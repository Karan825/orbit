import {
  McpServer,
  McpTool,
  ApiKey,
  CreatedApiKeyResponse,
  AuditEvent,
  TeamMember,
  ChatSession,
  ChatMessage,
  GatewayStats,
} from '@/types/mcp-gateway';

const API_BASE = process.env.NEXT_PUBLIC_API_URL || '';

// In-memory mock store for standalone development
let mockServers: McpServer[] = [
  {
    id: 'srv-1',
    slug: 'woocommerce',
    name: 'WooCommerce (store-main)',
    url: 'http://woo-mcp.store-main.svc.cluster.local:8080/mcp',
    status: 'Connected',
    reason: null,
    lastCheckedAt: new Date(Date.now() - 1000 * 5).toISOString(),
    toolCount: 5,
    auth: { type: 'bearer', configured: true },
    timeoutMs: 15000,
    enabled: true,
  },
  {
    id: 'srv-2',
    slug: 'fulfillment',
    name: 'Fulfillment (3PL)',
    url: 'http://fulfillment-mcp.mcp-upstreams.svc.cluster.local:8080/mcp',
    status: 'Connected',
    reason: null,
    lastCheckedAt: new Date(Date.now() - 1000 * 8).toISOString(),
    toolCount: 3,
    auth: { type: 'bearer', configured: true },
    timeoutMs: 15000,
    enabled: true,
  },
  {
    id: 'srv-3',
    slug: 'supplier',
    name: 'Supplier API',
    url: 'http://supplier-mcp.mcp-upstreams.svc.cluster.local:8080/mcp',
    status: 'Connected',
    reason: null,
    lastCheckedAt: new Date(Date.now() - 1000 * 12).toISOString(),
    toolCount: 2,
    auth: { type: 'header', configured: true, headerName: 'X-Supplier-Key' },
    timeoutMs: 15000,
    enabled: true,
  },
];

let mockTools: Record<string, McpTool[]> = {
  'srv-1': [
    {
      serverId: 'srv-1',
      toolName: 'list_products',
      exposedName: 'woocommerce__list_products',
      description: 'List products with search, sku, status, pagination, and sorting',
      inputSchema: {
        type: 'object',
        properties: {
          search: { type: 'string', description: 'Search keywords' },
          per_page: { type: 'number', default: 20 },
        },
      },
      requiredRole: 'member',
    },
    {
      serverId: 'srv-1',
      toolName: 'create_product',
      exposedName: 'woocommerce__create_product',
      description: 'Create a new product with name, price, description, sku, and stock quantity',
      inputSchema: {
        type: 'object',
        required: ['name', 'regular_price'],
        properties: {
          name: { type: 'string' },
          regular_price: { type: 'string' },
          description: { type: 'string' },
        },
      },
      requiredRole: 'admin',
    },
    {
      serverId: 'srv-1',
      toolName: 'list_orders',
      exposedName: 'woocommerce__list_orders',
      description: 'List orders with date preset (today, yesterday, this_month) in store timezone',
      inputSchema: {
        type: 'object',
        properties: {
          date_preset: { type: 'string', enum: ['today', 'yesterday', 'last_7_days', 'this_month'] },
        },
      },
      requiredRole: 'member',
    },
    {
      serverId: 'srv-1',
      toolName: 'get_order',
      exposedName: 'woocommerce__get_order',
      description: 'Fetch detailed order information by order ID',
      inputSchema: {
        type: 'object',
        required: ['order_id'],
        properties: { order_id: { type: 'number' } },
      },
      requiredRole: 'member',
    },
    {
      serverId: 'srv-1',
      toolName: 'update_order_status',
      exposedName: 'woocommerce__update_order_status',
      description: 'Update the processing status of an order',
      inputSchema: {
        type: 'object',
        required: ['order_id', 'status'],
        properties: {
          order_id: { type: 'number' },
          status: { type: 'string', enum: ['pending', 'processing', 'on-hold', 'completed', 'cancelled'] },
        },
      },
      requiredRole: 'admin',
    },
  ],
  'srv-2': [
    {
      serverId: 'srv-2',
      toolName: 'list_orders',
      exposedName: 'fulfillment__list_orders',
      description: 'List orders queued for 3PL warehouse fulfillment',
      inputSchema: { type: 'object' },
      requiredRole: 'member',
    },
    {
      serverId: 'srv-2',
      toolName: 'quote_shipping',
      exposedName: 'fulfillment__quote_shipping',
      description: 'Calculate standard, express, and overnight shipping rates for destination',
      inputSchema: {
        type: 'object',
        required: ['country', 'postal_code'],
        properties: { country: { type: 'string' }, postal_code: { type: 'string' } },
      },
      requiredRole: 'member',
    },
  ],
  'srv-3': [
    {
      serverId: 'srv-3',
      toolName: 'get_quote_v2',
      exposedName: 'supplier__get_quote_v2',
      description: 'Get real-time wholesale supply quote for catalog item',
      inputSchema: {
        type: 'object',
        required: ['sku', 'quantity'],
        properties: { sku: { type: 'string' }, quantity: { type: 'number' } },
      },
      requiredRole: 'member',
    },
  ],
};

let mockApiKeys: ApiKey[] = [
  {
    id: 'key-1',
    userId: 'usr-admin',
    name: "Alice's Primary Dev Key",
    keyPrefix: 'urk_a1b2c3d4',
    lastFour: '89f2',
    createdAt: new Date(Date.now() - 86400000 * 3).toISOString(),
    expiresAt: null,
    revokedAt: null,
    lastUsedAt: new Date(Date.now() - 1000 * 60 * 12).toISOString(),
  },
  {
    id: 'key-2',
    userId: 'usr-member-bob',
    name: "Bob's Cursor Integration",
    keyPrefix: 'urk_e5f6g7h8',
    lastFour: '312a',
    createdAt: new Date(Date.now() - 86400000).toISOString(),
    expiresAt: new Date(Date.now() + 86400000 * 90).toISOString(),
    revokedAt: null,
    lastUsedAt: new Date(Date.now() - 1000 * 60 * 45).toISOString(),
  },
];

let mockAuditEvents: AuditEvent[] = [
  {
    id: 104,
    requestId: '01JABCDEF1234567890ABCDEF1',
    kind: 'tool_call',
    startedAt: new Date(Date.now() - 1000 * 60 * 3).toISOString(),
    durationMs: 210,
    userId: 'usr-admin',
    userEmail: 'alice@urumi.local',
    apiKeyId: null,
    channel: 'chat',
    chatSessionId: 'sess-1',
    serverId: 'srv-1',
    serverSlug: 'woocommerce',
    toolName: 'list_orders',
    exposedName: 'woocommerce__list_orders',
    outcome: 'success',
    errorCode: null,
    errorMessage: null,
    argsPreview: { date_preset: 'today' },
    resultBytes: 1420,
  },
  {
    id: 103,
    requestId: '01JABCDEF1234567890ABCDEF2',
    kind: 'tool_call',
    startedAt: new Date(Date.now() - 1000 * 60 * 8).toISOString(),
    durationMs: 430,
    userId: 'usr-admin',
    userEmail: 'alice@urumi.local',
    apiKeyId: null,
    channel: 'chat',
    chatSessionId: 'sess-1',
    serverId: 'srv-1',
    serverSlug: 'woocommerce',
    toolName: 'create_product',
    exposedName: 'woocommerce__create_product',
    outcome: 'success',
    errorCode: null,
    errorMessage: null,
    argsPreview: { name: 'Blue Mug', regular_price: '499.00' },
    resultBytes: 520,
  },
  {
    id: 102,
    requestId: '01JABCDEF1234567890ABCDEF3',
    kind: 'tool_call',
    startedAt: new Date(Date.now() - 1000 * 60 * 18).toISOString(),
    durationMs: 180,
    userId: 'usr-member-bob',
    userEmail: 'bob@urumi.local',
    apiKeyId: 'key-2',
    channel: 'mcp',
    chatSessionId: null,
    serverId: 'srv-2',
    serverSlug: 'fulfillment',
    toolName: 'quote_shipping',
    exposedName: 'fulfillment__quote_shipping',
    outcome: 'success',
    errorCode: null,
    errorMessage: null,
    argsPreview: { country: 'IN', postal_code: '560001' },
    resultBytes: 310,
  },
  {
    id: 101,
    requestId: '01JABCDEF1234567890ABCDEF4',
    kind: 'access_denied',
    startedAt: new Date(Date.now() - 1000 * 60 * 35).toISOString(),
    durationMs: 12,
    userId: 'usr-member-bob',
    userEmail: 'bob@urumi.local',
    apiKeyId: 'key-2',
    channel: 'mcp',
    chatSessionId: null,
    serverId: 'srv-1',
    serverSlug: 'woocommerce',
    toolName: 'create_product',
    exposedName: 'woocommerce__create_product',
    outcome: 'denied',
    errorCode: 'FORBIDDEN',
    errorMessage: 'not permitted for role member',
    argsPreview: { name: 'Unauthorized Item' },
    resultBytes: 0,
  },
];

let mockUsers: TeamMember[] = [
  {
    id: 'usr-admin',
    email: 'alice@urumi.local',
    displayName: 'Alice (Admin)',
    role: 'admin',
    status: 'active',
    createdAt: new Date(Date.now() - 86400000 * 14).toISOString(),
  },
  {
    id: 'usr-member-bob',
    email: 'bob@urumi.local',
    displayName: 'Bob (Engineer)',
    role: 'member',
    status: 'active',
    createdAt: new Date(Date.now() - 86400000 * 7).toISOString(),
  },
];

async function apiFetch<T>(endpoint: string, options: RequestInit = {}): Promise<T> {
  if (process.env.NEXT_PUBLIC_MOCK_DATA === 'true') {
    return handleMockRequest<T>(endpoint, options);
  }

  try {
    const res = await fetch(`${API_BASE}${endpoint}`, {
      ...options,
      headers: {
        'Content-Type': 'application/json',
        ...options.headers,
      },
      credentials: 'include',
    });

    if (!res.ok) {
      const errData = await res.json().catch(() => ({}));
      throw new Error(errData.error?.message || errData.message || errData.error || `Request failed with ${res.status}`);
    }

    if (res.status === 204) return {} as T;
    return await res.json();
  } catch (err) {
    console.error(`[API] Request failed for ${endpoint}:`, err);
    throw err;
  }
}

function handleMockRequest<T>(endpoint: string, options: RequestInit = {}): T {
  const method = options.method || 'GET';

  // GET /api/servers
  if (endpoint === '/api/servers' && method === 'GET') {
    return mockServers as unknown as T;
  }

  // POST /api/servers
  if (endpoint === '/api/servers' && method === 'POST') {
    const body = JSON.parse((options.body as string) || '{}');
    const newServer: McpServer = {
      id: `srv-${Date.now()}`,
      slug: body.slug || 'custom-server',
      name: body.name || body.slug,
      url: body.url,
      status: 'Connected',
      reason: null,
      lastCheckedAt: new Date().toISOString(),
      toolCount: 1,
      auth: body.auth || { type: 'none', configured: false },
      timeoutMs: body.timeoutMs || 15000,
      enabled: true,
    };
    mockServers = [newServer, ...mockServers];
    return newServer as unknown as T;
  }

  // POST /api/servers/test
  if (endpoint === '/api/servers/test') {
    return { ok: true, toolCount: 4, protocolEra: '2026-07-28' } as unknown as T;
  }

  // GET /api/servers/:id/tools
  if (endpoint.startsWith('/api/servers/') && endpoint.endsWith('/tools')) {
    const parts = endpoint.split('/');
    const serverId = parts[3];
    return (mockTools[serverId] || [
      {
        serverId,
        toolName: 'default_tool',
        exposedName: 'tool__default',
        description: 'Auto-discovered test tool',
        inputSchema: { type: 'object' },
        requiredRole: 'member',
      },
    ]) as unknown as T;
  }

  // GET /api/api-keys
  if (endpoint.startsWith('/api/api-keys') && method === 'GET') {
    return { keys: mockApiKeys } as unknown as T;
  }

  // POST /api/api-keys
  if (endpoint === '/api/api-keys' && method === 'POST') {
    const body = JSON.parse((options.body as string) || '{}');
    const prefix = `urk_${Math.random().toString(36).substring(2, 10)}`;
    const rawSecret = Array.from({ length: 43 }, () =>
      'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789-_'[Math.floor(Math.random() * 64)],
    ).join('');
    const fullKey = `${prefix}_${rawSecret}`;

    const newKey: ApiKey = {
      id: `key-${Date.now()}`,
      userId: 'usr-admin',
      name: body.name || 'New API Key',
      keyPrefix: prefix,
      lastFour: rawSecret.slice(-4),
      createdAt: new Date().toISOString(),
      expiresAt: body.expiresInDays
        ? new Date(Date.now() + body.expiresInDays * 86400000).toISOString()
        : null,
      revokedAt: null,
      lastUsedAt: null,
    };
    mockApiKeys = [newKey, ...mockApiKeys];

    const resp: CreatedApiKeyResponse = {
      id: newKey.id,
      name: newKey.name,
      prefix: newKey.keyPrefix,
      lastFour: newKey.lastFour,
      key: fullKey,
      message: 'Copy this key now. It will never be shown again.',
    };
    return resp as unknown as T;
  }

  // DELETE /api/api-keys/:id
  if (endpoint.startsWith('/api/api-keys/') && method === 'DELETE') {
    const keyId = endpoint.split('/').pop();
    mockApiKeys = mockApiKeys.map((k) =>
      k.id === keyId ? { ...k, revokedAt: new Date().toISOString() } : k,
    );
    return { success: true } as unknown as T;
  }

  // GET /api/audit
  if (endpoint.startsWith('/api/audit')) {
    return { items: mockAuditEvents, total: mockAuditEvents.length } as unknown as T;
  }

  // GET /api/stats/servers
  if (endpoint === '/api/stats/servers') {
    const stats: GatewayStats = {
      activeServers: mockServers.filter((s) => s.status === 'Connected').length,
      totalServers: mockServers.length,
      totalCalls24h: 342,
      errorRate: 1.2,
      p95LatencyMs: 240,
      serverStats: mockServers.map((s) => ({
        slug: s.slug,
        calls: s.slug === 'woocommerce' ? 240 : s.slug === 'fulfillment' ? 82 : 20,
        errorRate: s.slug === 'woocommerce' ? 0.8 : 1.5,
        p95Ms: s.slug === 'woocommerce' ? 210 : 380,
        status: s.status,
      })),
    };
    return stats as unknown as T;
  }

  // GET /api/users
  if (endpoint === '/api/users') {
    return mockUsers as unknown as T;
  }

  // POST /api/invitations
  if (endpoint === '/api/invitations') {
    const body = JSON.parse((options.body as string) || '{}');
    const token = Math.random().toString(36).substring(2, 15);
    return {
      inviteUrl: `http://app.localtest.me/invite?token=${token}`,
      expiresAt: new Date(Date.now() + 72 * 3600 * 1000).toISOString(),
    } as unknown as T;
  }

  // GET /api/me
  if (endpoint === '/api/me') {
    return { id: 'usr-admin', email: 'alice@urumi.local', role: 'admin', displayName: 'Alice' } as unknown as T;
  }

  return {} as T;
}

// Exported high-level API methods
export const api = {
  getServers: async () => {
    const res = await apiFetch<any>('/api/servers');
    const list = Array.isArray(res) ? res : (res.servers || []);
    return list.map((s: any) => ({
      id: s.id,
      slug: s.slug,
      name: s.displayName || s.name || s.slug,
      url: s.url,
      status: s.status === 'connected' || s.status === 'Connected' ? 'Connected' : (s.status === 'disabled' || s.status === 'Disabled' ? 'Disabled' : 'Unreachable'),
      reason: s.lastError || s.reason || null,
      lastCheckedAt: s.lastChecked || s.lastCheckedAt,
      toolCount: s.toolCount ?? 0,
      auth: s.auth || { type: 'bearer', configured: true },
      timeoutMs: s.timeoutMs || 15000,
      enabled: s.enabled ?? true,
    }));
  },
  addServer: (data: { slug: string; name: string; url: string; auth: any; timeoutMs?: number }) =>
    apiFetch<McpServer>('/api/servers', { method: 'POST', body: JSON.stringify(data) }),
  testServer: (data: { url: string; auth: any }) =>
    apiFetch<{ ok: boolean; reason?: string; toolCount?: number; protocolEra?: string }>(
      '/api/servers/test',
      { method: 'POST', body: JSON.stringify(data) },
    ),
  getServerTools: (serverId: string) => apiFetch<McpTool[]>(`/api/servers/${serverId}/tools`),
  deleteServer: (serverId: string) =>
    apiFetch<{ success: boolean }>(`/api/servers/${serverId}`, { method: 'DELETE' }),
  updateServer: (
    serverId: string,
    data: { name?: string; url?: string; auth?: any; timeoutMs?: number; enabled?: boolean }
  ) =>
    apiFetch<{ success: boolean; server: any }>(`/api/servers/${serverId}`, {
      method: 'PATCH',
      body: JSON.stringify(data),
    }),
  toggleServer: (slug: string, enabled: boolean) =>
    apiFetch<{ success: boolean; server: any }>(`/api/servers/${slug}/toggle`, {
      method: 'POST',
      body: JSON.stringify({ enabled }),
    }),

  getApiKeys: (params?: { userId?: string; role?: string }) => {
    const query = new URLSearchParams();
    if (params?.userId) query.append('userId', params.userId);
    if (params?.role) query.append('role', params.role);
    const search = query.toString() ? `?${query.toString()}` : '';
    return apiFetch<{ keys: ApiKey[] }>(`/api/api-keys${search}`);
  },
  createApiKey: (data: { name: string; expiresInDays?: number; userId?: string }) =>
    apiFetch<CreatedApiKeyResponse>('/api/api-keys', { method: 'POST', body: JSON.stringify(data) }),
  revokeApiKey: (keyId: string) =>
    apiFetch<{ success: boolean }>(`/api/api-keys/${keyId}`, { method: 'DELETE' }),

  getAuditEvents: (params?: { user?: string; server?: string; outcome?: string; channel?: string }) => {
    const query = new URLSearchParams();
    if (params?.user) { query.append('user', params.user); query.append('userEmail', params.user); }
    if (params?.server) { query.append('server', params.server); query.append('serverSlug', params.server); }
    if (params?.outcome) query.append('outcome', params.outcome);
    if (params?.channel) query.append('channel', params.channel);
    const search = query.toString() ? `?${query.toString()}` : '';
    return apiFetch<{ items: AuditEvent[]; total: number }>(`/api/audit${search}`);
  },

  getStats: () => apiFetch<GatewayStats>('/api/stats/servers'),
  getUsers: () => apiFetch<TeamMember[]>('/api/users'),
  createInvite: (data: { email: string; role: 'admin' | 'member' }) =>
    apiFetch<{ inviteUrl: string; expiresAt: string }>('/api/invitations', {
      method: 'POST',
      body: JSON.stringify(data),
    }),
  getCurrentUser: () =>
    apiFetch<{ id: string; email: string; role: 'admin' | 'member'; displayName: string }>('/api/me'),
};
