export type ServerStatus = 'Connected' | 'Unreachable' | 'Disabled' | 'Connecting';

export type UnreachableReason =
  | 'DNS_FAILURE'
  | 'CONNECTION_REFUSED'
  | 'TIMEOUT'
  | 'TLS_ERROR'
  | 'AUTH_REJECTED'
  | 'HTTP_5XX'
  | 'NOT_MCP'
  | 'URL_BLOCKED';

export interface McpServer {
  id: string;
  slug: string;
  name: string;
  url: string;
  status: ServerStatus;
  reason?: UnreachableReason | string | null;
  lastCheckedAt?: string;
  lastConnectedAt?: string;
  toolCount: number;
  auth: {
    type: 'none' | 'bearer' | 'header';
    configured: boolean;
    headerName?: string;
  };
  timeoutMs: number;
  enabled?: boolean;
}

export interface McpTool {
  serverId: string;
  toolName: string;
  exposedName: string;
  description: string;
  inputSchema: Record<string, any>;
  requiredRole: 'admin' | 'member';
  hashChanged?: boolean;
  definitionHash?: string;
}

export interface ApiKey {
  id: string;
  userId: string;
  name: string;
  keyPrefix: string;
  lastFour: string;
  createdAt: string;
  expiresAt: string | null;
  revokedAt: string | null;
  lastUsedAt: string | null;
}

export interface CreatedApiKeyResponse {
  id: string;
  name: string;
  prefix: string;
  lastFour: string;
  key: string; // Plaintext shown only once
  message?: string;
}

export type AuditOutcome =
  | 'success'
  | 'tool_error'
  | 'timeout'
  | 'upstream_error'
  | 'denied'
  | 'unavailable'
  | 'invalid_args'
  | 'pending'
  | 'interrupted';

export interface AuditEvent {
  id: number;
  requestId: string;
  kind: 'tool_call' | 'access_denied';
  startedAt: string;
  durationMs: number | null;
  userId: string;
  userEmail: string;
  apiKeyId: string | null;
  channel: 'mcp' | 'chat';
  chatSessionId: string | null;
  serverId: string | null;
  serverSlug: string | null;
  toolName: string | null;
  exposedName: string | null;
  outcome: AuditOutcome;
  errorCode: string | null;
  errorMessage: string | null;
  argsPreview: Record<string, any> | null;
  resultBytes: number | null;
}

export interface TeamMember {
  id: string;
  email: string;
  displayName: string;
  role: 'admin' | 'member';
  status: 'active' | 'disabled';
  createdAt: string;
}

export interface ChatToolCall {
  exposedName: string;
  server: string;
  durationMs: number;
  outcome: 'success' | 'error' | 'timeout';
  input?: Record<string, any>;
  output?: any;
}

export interface ChatMessage {
  id: string;
  sessionId: string;
  role: 'user' | 'assistant';
  content: string;
  toolCalls?: ChatToolCall[];
  createdAt: string;
}

export interface ChatSession {
  id: string;
  title: string;
  updatedAt: string;
}

export interface GatewayStats {
  activeServers: number;
  totalServers: number;
  totalCalls24h: number;
  errorRate: number;
  p95LatencyMs: number;
  serverStats: {
    slug: string;
    calls: number;
    errorRate: number;
    p95Ms: number;
    status: ServerStatus;
  }[];
}
