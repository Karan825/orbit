'use client';

import { useEffect, useState } from 'react';
import { useHeaderContext } from '@/app/providers/header-provider';
import { api } from '@/lib/api-client';
import { useAuth } from '@/app/providers/auth-provider';
import { ApiKey, CreatedApiKeyResponse } from '@/types/mcp-gateway';
import {
  Key as KeyIcon,
  Plus as PlusIcon,
  Copy as CopyIcon,
  CheckCircle2 as CheckIcon,
  AlertCircle as AlertCircleIcon,
  Trash2 as TrashIcon,
  X as CloseIcon,
} from 'lucide-react';

export default function ApiKeysPage() {
  const { user, isAdmin, isMember } = useAuth();
  const { setHeaderTitle, setHeaderContent } = useHeaderContext();
  const [keys, setKeys] = useState<ApiKey[]>([]);
  const [loading, setLoading] = useState(true);
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [keyName, setKeyName] = useState('');
  const [expiresInDays, setExpiresInDays] = useState<number>(90);
  const [createdKeyData, setCreatedKeyData] = useState<CreatedApiKeyResponse | null>(null);
  const [copiedKey, setCopiedKey] = useState(false);
  const [copiedSnippet, setCopiedSnippet] = useState<string | null>(null);

  const fetchKeys = async () => {
    try {
      const res = await api.getApiKeys(isMember ? { userId: user.id, role: user.role } : undefined);
      setKeys(res.keys || []);
    } catch (e) {
      console.error(e);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    setHeaderTitle(isMember ? 'Personal API Keys' : 'Client API Keys');
    setHeaderContent(null);
    fetchKeys();
  }, [setHeaderTitle, setHeaderContent, isMember, user.id]);

  const handleCreateKey = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      const res = await api.createApiKey({
        name: keyName || (isMember ? `${user.displayName}'s Key` : 'Client Key'),
        expiresInDays: expiresInDays > 0 ? expiresInDays : undefined,
        userId: user.id,
      });
      setCreatedKeyData(res);
      setKeyName('');
      await fetchKeys();
    } catch (e: any) {
      alert(e.message || 'Failed to create key');
    }
  };

  const handleRevokeKey = async (id: string) => {
    if (!confirm('Are you sure you want to revoke this API key? MCP clients using this key will immediately be rejected with 401.')) {
      return;
    }
    try {
      await api.revokeApiKey(id);
      await fetchKeys();
    } catch (e: any) {
      alert(e.message || 'Failed to revoke key');
    }
  };

  const copyToClipboard = (text: string, label: string) => {
    navigator.clipboard.writeText(text);
    if (label === 'key') {
      setCopiedKey(true);
      setTimeout(() => setCopiedKey(false), 2000);
    } else {
      setCopiedSnippet(label);
      setTimeout(() => setCopiedSnippet(null), 2000);
    }
  };

  return (
    <div className="space-y-6">
      {/* Top Banner */}
      <div className="flex flex-col gap-4 rounded-xl border border-[#E2E4F0] bg-white p-6 shadow-sm sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h2 className="text-xl font-bold tracking-tight text-[#1E2038]">
            {isMember ? 'My Personal API Keys' : 'MCP Client API Keys'}
          </h2>
          <p className="mt-1 text-sm text-[#55597D]">
            {isMember
              ? 'Generate and manage your personal credentials to connect external MCP clients like Claude Code and Cursor.'
              : 'Per-user high-entropy Bearer credentials (256-bit) for Claude Code, Cursor, and external MCP clients.'}
          </p>
        </div>
        <button
          onClick={() => {
            setCreatedKeyData(null);
            setShowCreateModal(true);
          }}
          className="inline-flex items-center gap-1.5 rounded-lg bg-[#5356FB] px-4 py-2.5 text-xs font-semibold text-white shadow-sm hover:bg-[#4346E8] transition-colors"
        >
          <PlusIcon className="h-4 w-4" />
          Generate New API Key
        </button>
      </div>

      {/* Keys List Table */}
      <div className="rounded-xl border border-[#E2E4F0] bg-white shadow-sm overflow-hidden">
        <div className="p-5 border-b border-[#E2E4F0]">
          <h3 className="font-bold text-[#1E2038]">
            {isMember ? 'My Active Credentials' : 'Active & Revoked Credentials (Organization-wide)'}
          </h3>
          <p className="mt-0.5 text-xs text-[#55597D]">
            {isMember
              ? 'These keys authenticate requests under your identity in the audit trail. Never share raw credentials.'
              : 'Keys are fast HMAC-SHA256 hashed with cluster pepper. Revocation applies on the very next call (no cache).'}
          </p>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-left text-sm">
            <thead className="border-b border-[#E2E4F0] text-xs uppercase font-semibold text-[#55597D] bg-[#F8F9FD]">
              <tr>
                <th className="px-5 py-3.5">Name</th>
                <th className="px-5 py-3.5">Key Prefix</th>
                <th className="px-5 py-3.5">Status</th>
                <th className="px-5 py-3.5">Last Used</th>
                <th className="px-5 py-3.5">Expires At</th>
                <th className="px-5 py-3.5 text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-[#E2E4F0]">
              {loading ? (
                <tr>
                  <td colSpan={6} className="p-8 text-center text-xs text-[#55597D] animate-pulse font-medium">
                    Loading credentials...
                  </td>
                </tr>
              ) : keys.length === 0 ? (
                <tr>
                  <td colSpan={6} className="p-8 text-center text-xs text-[#55597D]">
                    No API keys created yet. Generate one to connect Claude Code or Cursor.
                  </td>
                </tr>
              ) : (
                keys.map((k) => {
                  const isRevoked = !!k.revokedAt;
                  const isExpired = k.expiresAt && new Date(k.expiresAt) < new Date();

                  return (
                    <tr key={k.id} className="hover:bg-[#F9FAFE] transition-colors">
                      <td className="px-5 py-3.5 font-semibold text-[#1E2038]">
                        {k.name}
                      </td>
                      <td className="px-5 py-3.5 font-mono text-xs font-semibold text-[#5356FB]">
                        {k.keyPrefix}...{k.lastFour}
                      </td>
                      <td className="px-5 py-3.5">
                        {isRevoked ? (
                          <span className="inline-flex rounded-md bg-[#FEF2F2] px-2.5 py-0.5 text-xs font-medium text-[#B91C1C] border border-[#FEE2E2]">
                            Revoked
                          </span>
                        ) : isExpired ? (
                          <span className="inline-flex rounded-md bg-[#FFFBEB] px-2.5 py-0.5 text-xs font-medium text-[#B45309] border border-[#FEF3C7]">
                            Expired
                          </span>
                        ) : (
                          <span className="inline-flex rounded-md bg-[#F0FDF4] px-2.5 py-0.5 text-xs font-medium text-[#15803D] border border-[#DCFCE7]">
                            Active
                          </span>
                        )}
                      </td>
                      <td className="px-5 py-3.5 text-xs text-[#55597D]">
                        {k.lastUsedAt ? new Date(k.lastUsedAt).toLocaleString() : 'Never'}
                      </td>
                      <td className="px-5 py-3.5 text-xs text-[#55597D]">
                        {k.expiresAt ? new Date(k.expiresAt).toLocaleDateString() : 'Never'}
                      </td>
                      <td className="px-5 py-3.5 text-right">
                        {!isRevoked && (
                          <button
                            onClick={() => handleRevokeKey(k.id)}
                            className="inline-flex items-center gap-1 rounded-lg px-2.5 py-1 text-xs font-medium text-[#D82A50] hover:bg-[#FDECEF] transition-colors"
                            title="Revoke key immediately"
                          >
                            <TrashIcon className="h-3.5 w-3.5" />
                            Revoke
                          </button>
                        )}
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Create Key Modal (One-time Reveal + Ready-to-Paste Client Snippets) */}
      {showCreateModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/40 backdrop-blur-xs p-4">
          <div className="w-full max-w-xl rounded-2xl border border-[#E2E4F0] bg-white p-6 shadow-xl animate-in fade-in-50 max-h-[90vh] overflow-y-auto">
            <div className="flex items-center justify-between border-b border-[#E2E4F0] pb-3.5">
              <h3 className="font-bold text-base text-[#1E2038]">
                {createdKeyData ? 'API Key Generated Successfully' : 'Generate Client API Key'}
              </h3>
              <button
                onClick={() => setShowCreateModal(false)}
                className="rounded-lg p-1 text-[#55597D] hover:bg-[#F0F2FA] hover:text-[#1E2038] transition-colors"
              >
                <CloseIcon className="h-5 w-5" />
              </button>
            </div>

            {!createdKeyData ? (
              <form onSubmit={handleCreateKey} className="mt-4 space-y-4">
                <div>
                  <label className="block text-xs font-semibold text-[#1E2038]">
                    Key Description / Name
                  </label>
                  <input
                    type="text"
                    required
                    placeholder="e.g. Bob's Cursor IDE / Local Claude Code"
                    value={keyName}
                    onChange={(e) => setKeyName(e.target.value)}
                    className="mt-1.5 w-full rounded-xl border border-[#D5D8EB] bg-[#F8F9FD] px-3.5 py-2.5 text-xs text-[#1E2038] focus:bg-white focus:outline-none focus:border-[#5356FB] transition-all"
                  />
                </div>

                <div>
                  <label className="block text-xs font-semibold text-[#1E2038]">
                    Expiration
                  </label>
                  <select
                    value={expiresInDays}
                    onChange={(e) => setExpiresInDays(Number(e.target.value))}
                    className="mt-1.5 w-full rounded-xl border border-[#D5D8EB] bg-[#F8F9FD] px-3.5 py-2.5 text-xs text-[#1E2038] focus:bg-white focus:outline-none focus:border-[#5356FB] transition-all"
                  >
                    <option value={30}>30 Days</option>
                    <option value={90}>90 Days (Recommended)</option>
                    <option value={180}>180 Days</option>
                    <option value={0}>Never Expire</option>
                  </select>
                </div>

                <div className="flex justify-end gap-2.5 pt-3.5 border-t border-[#E2E4F0]">
                  <button
                    type="button"
                    onClick={() => setShowCreateModal(false)}
                    className="rounded-xl border border-[#D5D8EB] bg-white px-4 py-2 text-xs font-semibold text-[#1E2038] hover:bg-[#F4F5FF] transition-colors"
                  >
                    Cancel
                  </button>
                  <button
                    type="submit"
                    className="rounded-xl bg-[#5356FB] px-4 py-2 text-xs font-semibold text-white shadow-sm hover:bg-[#4346E8] transition-colors"
                  >
                    Generate Key
                  </button>
                </div>
              </form>
            ) : (
              <div className="mt-4 space-y-5">
                {/* One-time Warning Box */}
                <div className="rounded-xl border border-[#FDE3B6] bg-[#FFF8EC] p-3.5 text-xs text-[#B45309] flex items-start gap-2.5">
                  <AlertCircleIcon className="h-4 w-4 shrink-0 mt-0.5" />
                  <div>
                    <span className="font-bold">Save this key now!</span> It is never stored in plaintext and will not be displayed again.
                  </div>
                </div>

                {/* Plaintext Key Display */}
                <div>
                  <label className="block text-xs font-semibold text-[#1E2038] mb-1">
                    Your API Key
                  </label>
                  <div className="flex items-center gap-2 rounded-xl border border-[#D5D8EB] bg-[#EEF0FF] p-2.5">
                    <input
                      type="text"
                      readOnly
                      value={createdKeyData.key}
                      className="flex-1 bg-transparent font-mono text-xs font-bold text-[#5356FB] focus:outline-none"
                    />
                    <button
                      onClick={() => copyToClipboard(createdKeyData.key, 'key')}
                      className="inline-flex items-center gap-1 rounded-lg bg-[#5356FB] px-3 py-1.5 text-xs font-semibold text-white shadow-sm hover:bg-[#4346E8] transition-colors"
                    >
                      {copiedKey ? <CheckIcon className="h-3.5 w-3.5" /> : <CopyIcon className="h-3.5 w-3.5" />}
                      {copiedKey ? 'Copied' : 'Copy'}
                    </button>
                  </div>
                </div>

                {/* Ready to Paste Snippets */}
                <div className="space-y-3 pt-2 border-t border-[#E2E4F0]">
                  <h4 className="text-xs font-bold uppercase tracking-wider text-[#55597D]">
                    Ready-to-Paste Client Configurations
                  </h4>

                  {/* Claude Code CLI */}
                  <div className="rounded-xl border border-[#E2E4F0] bg-[#F8F9FD] p-3">
                    <div className="flex items-center justify-between mb-1.5">
                      <span className="text-xs font-bold text-[#1E2038]">1. Claude Code CLI</span>
                      <button
                        onClick={() =>
                          copyToClipboard(
                            `claude mcp add gateway http://localhost:8080/mcp --header "Authorization: Bearer ${createdKeyData.key}"`,
                            'claude'
                          )
                        }
                        className="text-[11px] font-semibold text-[#5356FB] hover:underline flex items-center gap-1"
                      >
                        {copiedSnippet === 'claude' ? <CheckIcon className="h-3 w-3 text-[#1E8A57]" /> : <CopyIcon className="h-3 w-3" />}
                        {copiedSnippet === 'claude' ? 'Copied' : 'Copy command'}
                      </button>
                    </div>
                    <code className="block rounded-lg bg-white border border-[#E2E4F0] p-2 font-mono text-[11px] text-[#1E2038] overflow-x-auto">
                      claude mcp add gateway http://localhost:8080/mcp --header "Authorization: Bearer {createdKeyData.key}"
                    </code>
                  </div>

                  {/* Cursor IDE Config */}
                  <div className="rounded-xl border border-[#E2E4F0] bg-[#F8F9FD] p-3">
                    <div className="flex items-center justify-between mb-1.5">
                      <span className="text-xs font-bold text-[#1E2038]">2. Cursor (cursor_config.json)</span>
                      <button
                        onClick={() =>
                          copyToClipboard(
                            JSON.stringify(
                              {
                                mcpServers: {
                                  'kubernetes-mcp-gateway': {
                                    url: 'http://localhost:8080/mcp',
                                    headers: { Authorization: `Bearer ${createdKeyData.key}` },
                                  },
                                },
                              },
                              null,
                              2
                            ),
                            'cursor'
                          )
                        }
                        className="text-[11px] font-semibold text-[#5356FB] hover:underline flex items-center gap-1"
                      >
                        {copiedSnippet === 'cursor' ? <CheckIcon className="h-3 w-3 text-[#1E8A57]" /> : <CopyIcon className="h-3 w-3" />}
                        {copiedSnippet === 'cursor' ? 'Copied' : 'Copy JSON'}
                      </button>
                    </div>
                    <pre className="rounded-lg bg-white border border-[#E2E4F0] p-2 font-mono text-[11px] text-[#1E2038] overflow-x-auto">
{JSON.stringify(
  {
    mcpServers: {
      'kubernetes-mcp-gateway': {
        url: 'http://localhost:8080/mcp',
        headers: { Authorization: `Bearer ${createdKeyData.key}` },
      },
    },
  },
  null,
  2
)}
                    </pre>
                  </div>
                </div>

                <div className="flex justify-end pt-3 border-t border-[#E2E4F0]">
                  <button
                    onClick={() => setShowCreateModal(false)}
                    className="rounded-xl bg-[#5356FB] px-5 py-2 text-xs font-semibold text-white shadow-sm hover:bg-[#4346E8] transition-colors"
                  >
                    Done
                  </button>
                </div>
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
