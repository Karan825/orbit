export type userRole = 'admin' | 'member'

export type AuthChannel = 'mcp' | 'chat'

export interface Principal {
    userId: string;
    email: string;
    role: userRole;
    apiKeyId: string | null;
    channel: AuthChannel;
    chatSessionId: string | null;
    requestId: string;
}