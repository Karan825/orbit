'use client';

import { useEffect, useState } from 'react';
import { useHeaderContext } from '@/app/providers/header-provider';
import { api } from '@/lib/api-client';
import { useAuth } from '@/app/providers/auth-provider';
import { McpServer, McpTool } from '@/types/mcp-gateway';
import {
  Server as ServerIcon,
  Plus as PlusIcon,
  RefreshCw as RefreshIcon,
  Trash2 as TrashIcon,
  CheckCircle2 as CheckIcon,
  AlertCircle as AlertCircleIcon,
  Code as CodeIcon,
  X as CloseIcon,
  Search as SearchIcon,
  Copy as CopyIcon,
} from 'lucide-react';

export default function ServersPage() {
  const { isAdmin, isMember } = useAuth();
  const { setHeaderTitle, setHeaderContent } = useHeaderContext();
  const [servers, setServers] = useState<McpServer[]>([]);
  const [selectedServer, setSelectedServer] = useState<McpServer | null>(null);
  const [serverTools, setServerTools] = useState<McpTool[]>([]);
  const [toolsLoading, setToolsLoading] = useState(false);
  const [showAddModal, setShowAddModal] = useState(false);
  const [toolSearch, setToolSearch] = useState('');
  const [copiedTool, setCopiedTool] = useState<string | null>(null);

  // Add Server Form State
  const [newSlug, setNewSlug] = useState('');
  const [newName, setNewName] = useState('');
  const [newUrl, setNewUrl] = useState('');
  const [newAuthType, setNewAuthType] = useState<'none' | 'bearer' | 'header'>('bearer');
  const [newAuthHeader, setNewAuthHeader] = useState('');
  const [newAuthToken, setNewAuthToken] = useState('');
  const [testResult, setTestResult] = useState<{
    ok: boolean;
    reason?: string;
    toolCount?: number;
    protocolEra?: string;
  } | null>(null);
  const [testing, setTesting] = useState(false);
  const [submitting, setSubmitting] = useState(false);

  const fetchServers = async () => {
    try {
      const data = await api.getServers();
      setServers(data);
      if (!selectedServer && data.length > 0) {
        handleSelectServer(data[0]);
      }
    } catch (e) {
      console.error(e);
    }
  };

  useEffect(() => {
    setHeaderTitle('Upstream MCP Servers');
    setHeaderContent(null);
    fetchServers();

    const interval = setInterval(fetchServers, 5000);
    return () => clearInterval(interval);
  }, [setHeaderTitle, setHeaderContent]);

  const handleSelectServer = async (server: McpServer) => {
    setSelectedServer(server);
    setToolsLoading(true);
    try {
      const tools = await api.getServerTools(server.id);
      setServerTools(tools);
    } catch (e) {
      console.error(e);
    } finally {
      setToolsLoading(false);
    }
  };

  const handleTestConnection = async () => {
    if (!newUrl) return;
    setTesting(true);
    setTestResult(null);
    try {
      const res = await api.testServer({
        url: newUrl,
        auth: {
          type: newAuthType,
          token: newAuthToken,
          headerName: newAuthHeader,
        },
      });
      setTestResult(res);
    } catch (e: any) {
      setTestResult({ ok: false, reason: e.message || 'Connection failed' });
    } finally {
      setTesting(false);
    }
  };

  const handleAddServer = async (e: React.FormEvent) => {
    e.preventDefault();
    setSubmitting(true);
    try {
      await api.addServer({
        slug: newSlug,
        name: newName || newSlug,
        url: newUrl,
        auth: {
          type: newAuthType,
          headerName: newAuthType === 'header' ? newAuthHeader : undefined,
          configured: !!newAuthToken,
        },
      });
      setShowAddModal(false);
      setNewSlug('');
      setNewName('');
      setNewUrl('');
      setNewAuthToken('');
      setTestResult(null);
      await fetchServers();
    } catch (e: any) {
      alert(e.message || 'Failed to add server');
    } finally {
      setSubmitting(false);
    }
  };

  const handleDeleteServer = async (id: string) => {
    if (!confirm('Are you sure you want to remove this upstream server? Tools will be evicted immediately.')) return;
    try {
      await api.deleteServer(id);
      if (selectedServer?.id === id) setSelectedServer(null);
      await fetchServers();
    } catch (e: any) {
      alert(e.message || 'Failed to delete server');
    }
  };

  const getStatusBadge = (status: string, reason?: string | null) => {
    switch (status) {
      case 'Connected':
        return (
          <span className="inline-flex items-center rounded-md bg-[#F0FDF4] px-2.5 py-0.5 text-xs font-medium text-[#15803D] border border-[#DCFCE7]">
            Connected
          </span>
        );
      case 'Unreachable':
        return (
          <span
            className="inline-flex items-center rounded-md bg-[#FEF2F2] px-2.5 py-0.5 text-xs font-medium text-[#B91C1C] border border-[#FEE2E2]"
            title={reason || ''}
          >
            Unreachable {reason ? `• ${reason}` : ''}
          </span>
        );
      case 'Disabled':
        return (
          <span className="inline-flex items-center rounded-md bg-[#F8FAFC] px-2.5 py-0.5 text-xs font-medium text-[#64748B] border border-[#E2E8F0]">
            Disabled
          </span>
        );
      default:
        return (
          <span className="inline-flex items-center rounded-md bg-[#FFFBEB] px-2.5 py-0.5 text-xs font-medium text-[#B45309] border border-[#FEF3C7]">
            Connecting
          </span>
        );
    }
  };

  return (
    <div className="space-y-6">
      {/* Top Header Controls */}
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h2 className="text-xl font-bold tracking-tight text-[#1E2038]">Registered Upstream Servers</h2>
          <p className="text-sm text-[#55597D]">
            Upstream tool servers aggregated behind the central /mcp endpoint with namespaced tool calling.
          </p>
        </div>
        {isAdmin && (
          <button
            onClick={() => setShowAddModal(true)}
            className="inline-flex items-center gap-1.5 rounded-lg bg-[#5356FB] px-4 py-2 text-xs font-semibold text-white shadow-sm hover:bg-[#4346E8] transition-colors"
          >
            <PlusIcon className="h-4 w-4" />
            Register Upstream Server
          </button>
        )}
      </div>

      {/* Main Grid: Server Cards & Tools Inspector */}
      <div className="grid gap-6 lg:grid-cols-12 items-start">
        {/* Servers List (7 cols) */}
        <div className="space-y-4 lg:col-span-7">
          {servers.map((server) => {
            const isSelected = selectedServer?.id === server.id;
            return (
              <div
                key={server.id}
                onClick={() => handleSelectServer(server)}
                className={`cursor-pointer rounded-2xl border p-5 shadow-sm transition-all ${
                  isSelected
                    ? 'border-[#5356FB] bg-[#F7F8FF] ring-2 ring-[#5356FB]/20'
                    : 'border-[#E2E4F0] bg-white hover:border-[#B5B9D8]'
                }`}
              >
                <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
                  <div className="flex items-center gap-3">
                    <div className="flex h-11 w-11 items-center justify-center rounded-xl bg-[#EEF2FF] text-[#5356FB] shadow-2xs">
                      <ServerIcon className="h-5 w-5" />
                    </div>
                    <div>
                      <h3 className="font-bold text-base text-[#1E2038]">{server.name}</h3>
                      <div className="flex items-center gap-2 text-xs text-[#55597D] mt-0.5">
                        <span className="font-mono font-medium">slug: {server.slug}</span>
                        <span>•</span>
                        <span className="font-semibold text-[#5356FB]">{server.toolCount} exposed tools</span>
                      </div>
                    </div>
                  </div>
                  <div className="flex items-center gap-2">
                    {getStatusBadge(server.status, server.reason)}
                  </div>
                </div>

                <div className="mt-4 flex flex-wrap items-center justify-between gap-2 border-t border-[#EDF0F8] pt-3 text-xs text-[#55597D] font-mono">
                  {isMember ? (
                    <span className="text-[#55597D] font-sans text-xs italic">
                      Cluster Upstream ({server.slug}.svc.cluster.local) • Credentials Governed
                    </span>
                  ) : (
                    <span className="truncate max-w-sm" title={server.url}>{server.url}</span>
                  )}
                  <div className="flex items-center gap-2">
                    <button
                      onClick={(e) => {
                        e.stopPropagation();
                        fetchServers();
                      }}
                      className="rounded-lg p-1.5 text-[#64748B] hover:bg-[#F0F2FA] hover:text-[#1E2038] transition-colors"
                      title="Probe and rediscover tools"
                    >
                      <RefreshIcon className="h-3.5 w-3.5" />
                    </button>
                    {isAdmin && (
                      <button
                        onClick={(e) => {
                          e.stopPropagation();
                          handleDeleteServer(server.id);
                        }}
                        className="rounded-lg p-1.5 text-[#D82A50] hover:bg-[#FDECEF] transition-colors"
                        title="Remove upstream"
                      >
                        <TrashIcon className="h-3.5 w-3.5" />
                      </button>
                    )}
                  </div>
                </div>
              </div>
            );
          })}
        </div>

        {/* Tools Inspector Panel (5 cols, sticky) */}
        <div className="rounded-2xl border border-[#E2E4F0] bg-white shadow-sm lg:col-span-5 sticky top-20 flex flex-col max-h-[calc(100vh-120px)] overflow-hidden">
          {/* Header */}
          <div className="p-4 border-b border-[#E2E4F0] bg-[#F8F9FD] space-y-3">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2.5">
                <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-[#EEF0FF] text-[#5356FB] border border-[#D5D8EB]">
                  <CodeIcon className="h-4 w-4" />
                </div>
                <div>
                  <h3 className="font-bold text-sm text-[#1E2038]">Discovered Tools</h3>
                  <div className="text-[11px] text-[#55597D]">
                    {selectedServer ? selectedServer.name : 'No server selected'}
                  </div>
                </div>
              </div>

              {selectedServer && (
                <div className="flex items-center gap-1.5">
                  <span className="font-mono text-xs font-bold text-[#5356FB] bg-[#EEF0FF] px-2.5 py-1 rounded-lg border border-[#D5D8EB]">
                    {selectedServer.slug}
                  </span>
                  <span className="text-[11px] font-medium text-[#1E2038] bg-[#F1F3F9] px-2.5 py-1 rounded-lg border border-[#E2E8F0]">
                    {serverTools.length} tools
                  </span>
                </div>
              )}
            </div>

            {/* Quick Filter Search */}
            {selectedServer && serverTools.length > 0 && (
              <div className="relative">
                <SearchIcon className="absolute left-3 top-2.5 h-3.5 w-3.5 text-[#8E92BC]" />
                <input
                  type="text"
                  placeholder={`Search ${selectedServer.slug} tools...`}
                  value={toolSearch}
                  onChange={(e) => setToolSearch(e.target.value)}
                  className="w-full rounded-xl border border-[#D5D8EB] bg-white pl-8 pr-3 py-1.5 text-xs text-[#1E2038] placeholder-[#8E92BC] focus:outline-none focus:border-[#5356FB] transition-all"
                />
                {toolSearch && (
                  <button
                    onClick={() => setToolSearch('')}
                    className="absolute right-2.5 top-2 text-xs text-[#8E92BC] hover:text-[#1E2038]"
                  >
                    ×
                  </button>
                )}
              </div>
            )}
          </div>

          {/* Body */}
          <div className="flex-1 overflow-y-auto p-4 space-y-3">
            {!selectedServer ? (
              <div className="flex flex-col items-center justify-center p-8 text-center text-xs text-[#55597D] space-y-2">
                <CodeIcon className="h-8 w-8 text-[#8F95B2] opacity-40" />
                <p>Select an upstream server on the left to inspect its discovered tools, contracts, and parameters.</p>
              </div>
            ) : toolsLoading ? (
              <div className="p-8 text-center text-xs text-[#55597D] animate-pulse font-medium">
                Querying tools/list from {selectedServer.slug}...
              </div>
            ) : serverTools.length === 0 ? (
              <div className="p-8 text-center text-xs text-[#55597D]">
                No tools registered for this upstream.
              </div>
            ) : (
              serverTools
                .filter(
                  (t) =>
                    t.exposedName.toLowerCase().includes(toolSearch.toLowerCase()) ||
                    t.description.toLowerCase().includes(toolSearch.toLowerCase())
                )
                .map((tool) => {
                  const paramKeys = tool.inputSchema?.properties ? Object.keys(tool.inputSchema.properties) : [];
                  const isCopied = copiedTool === tool.exposedName;

                  return (
                    <div
                      key={tool.exposedName}
                      className="rounded-xl border border-[#E2E4F0] bg-[#F8F9FD] p-3.5 text-xs space-y-2 hover:border-[#5356FB]/40 hover:bg-white transition-all shadow-2xs"
                    >
                      {/* Name & Role Header */}
                      <div className="flex items-center justify-between gap-2">
                        <div className="flex items-center gap-1.5 min-w-0">
                          <span className="font-mono font-bold text-xs text-[#5356FB] truncate">
                            {tool.exposedName}
                          </span>
                          <button
                            onClick={() => {
                              navigator.clipboard.writeText(tool.exposedName);
                              setCopiedTool(tool.exposedName);
                              setTimeout(() => setCopiedTool(null), 2000);
                            }}
                            className="text-[#8E92BC] hover:text-[#5356FB] transition-colors shrink-0 p-0.5"
                            title="Copy tool name"
                          >
                            {isCopied ? (
                              <CheckIcon className="h-3 w-3 text-[#1E8A57]" />
                            ) : (
                              <CopyIcon className="h-3 w-3" />
                            )}
                          </button>
                        </div>
                        <span
                          className={`rounded-full px-2 py-0.5 text-[9px] font-bold uppercase shrink-0 ${
                            tool.requiredRole === 'admin'
                              ? 'bg-[#FFF8EC] text-[#B45309] border border-[#FDE3B6]'
                              : 'bg-[#EEF2FF] text-[#5356FB] border border-[#D5D8EB]'
                          }`}
                        >
                          {tool.requiredRole === 'admin' ? 'Admin' : 'Member'}
                        </span>
                      </div>

                      {/* Description */}
                      <p className="text-[#55597D] text-[11px] leading-relaxed">
                        {tool.description || 'No description provided by upstream manifest.'}
                      </p>

                      {/* Parameters Pills */}
                      {paramKeys.length > 0 ? (
                        <div className="pt-2 border-t border-[#E2E4F0]/80 space-y-1.5">
                          <div className="flex items-center justify-between text-[10px] font-bold uppercase tracking-wider text-[#8F95B2]">
                            <span>Parameters ({paramKeys.length})</span>
                          </div>
                          <div className="space-y-1">
                            {paramKeys.map((prop) => {
                              const propDef = tool.inputSchema.properties[prop];
                              const isRequired = tool.inputSchema.required?.includes(prop);
                              return (
                                <div
                                  key={prop}
                                  className="flex items-center justify-between rounded-lg bg-white border border-[#E2E4F0] px-2.5 py-1 font-mono text-[11px]"
                                >
                                  <div className="flex items-center gap-1.5 truncate">
                                    <span className="font-semibold text-[#1E2038] truncate">{prop}</span>
                                    <span className="text-[#8E92BC] text-[10px]">
                                      ({propDef?.type || 'any'})
                                    </span>
                                  </div>
                                  {isRequired ? (
                                    <span className="rounded bg-[#FDECEF] border border-[#F8BCC7] px-1 py-0.2 text-[8px] font-bold text-[#D82A50] uppercase shrink-0">
                                      required
                                    </span>
                                  ) : (
                                    <span className="rounded bg-[#F1F3F9] border border-[#E2E8F0] px-1 py-0.2 text-[8px] font-medium text-[#64748B] uppercase shrink-0">
                                      optional
                                    </span>
                                  )}
                                </div>
                              );
                            })}
                          </div>
                        </div>
                      ) : (
                        <div className="text-[10px] text-[#8F95B2] italic pt-1">
                          No input parameters required
                        </div>
                      )}
                    </div>
                  );
                })
            )}
          </div>
        </div>
      </div>

      {/* Add Upstream Server Modal */}
      {showAddModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-sm p-4">
          <div className="w-full max-w-lg rounded-2xl border border-[#E2E4F0] bg-white p-6 shadow-2xl animate-in fade-in-50">
            <div className="flex items-center justify-between border-b border-[#E2E4F0] pb-3">
              <h3 className="font-bold text-[#1E2038]">Register MCP Upstream Server</h3>
              <button
                onClick={() => setShowAddModal(false)}
                className="rounded p-1 text-[#64748B] hover:bg-[#F0F2FA]"
              >
                <CloseIcon className="h-4 w-4" />
              </button>
            </div>

            <form onSubmit={handleAddServer} className="mt-4 space-y-4">
              <div>
                <label className="block text-xs font-semibold text-[#55597D]">
                  Upstream Slug (e.g. &quot;fulfillment&quot;, &quot;supplier&quot;)
                </label>
                <input
                  type="text"
                  required
                  pattern="^[a-z][a-z0-9]*(-[a-z0-9]+)*$"
                  placeholder="fulfillment"
                  value={newSlug}
                  onChange={(e) => setNewSlug(e.target.value.toLowerCase())}
                  className="mt-1 w-full rounded-lg border border-[#D5D8EB] bg-white px-3 py-2 text-xs font-mono text-[#1E2038] focus:outline-none focus:ring-2 focus:ring-[#5356FB]/20 focus:border-[#5356FB]"
                />
                <span className="text-[10px] text-[#8F95B2]">
                  Immutable prefix used for tool namespacing: &lt;slug&gt;__&lt;tool&gt;
                </span>
              </div>

              <div>
                <label className="block text-xs font-semibold text-[#55597D]">
                  Display Name
                </label>
                <input
                  type="text"
                  placeholder="3PL Warehouse Fulfillment"
                  value={newName}
                  onChange={(e) => setNewName(e.target.value)}
                  className="mt-1 w-full rounded-lg border border-[#D5D8EB] bg-white px-3 py-2 text-xs text-[#1E2038] focus:outline-none focus:ring-2 focus:ring-[#5356FB]/20 focus:border-[#5356FB]"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-[#55597D]">
                  Cluster / HTTP URL
                </label>
                <input
                  type="url"
                  required
                  placeholder="http://fulfillment-mcp.mcp-upstreams.svc.cluster.local:8080/mcp"
                  value={newUrl}
                  onChange={(e) => setNewUrl(e.target.value)}
                  className="mt-1 w-full rounded-lg border border-[#D5D8EB] bg-white px-3 py-2 text-xs font-mono text-[#1E2038] focus:outline-none focus:ring-2 focus:ring-[#5356FB]/20 focus:border-[#5356FB]"
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-semibold text-[#55597D]">
                    Auth Type
                  </label>
                  <select
                    value={newAuthType}
                    onChange={(e: any) => setNewAuthType(e.target.value)}
                    className="mt-1 w-full rounded-lg border border-[#D5D8EB] bg-white px-3 py-2 text-xs text-[#1E2038] focus:outline-none focus:ring-2 focus:ring-[#5356FB]/20 focus:border-[#5356FB]"
                  >
                    <option value="none">None</option>
                    <option value="bearer">Bearer Token</option>
                    <option value="header">Custom Header</option>
                  </select>
                </div>

                {newAuthType === 'header' && (
                  <div>
                    <label className="block text-xs font-semibold text-[#55597D]">
                      Header Name
                    </label>
                    <input
                      type="text"
                      placeholder="X-Supplier-Key"
                      value={newAuthHeader}
                      onChange={(e) => setNewAuthHeader(e.target.value)}
                      className="mt-1 w-full rounded-lg border border-[#D5D8EB] bg-white px-3 py-2 text-xs font-mono text-[#1E2038]"
                    />
                  </div>
                )}
              </div>

              {newAuthType !== 'none' && (
                <div>
                  <label className="block text-xs font-semibold text-[#55597D]">
                    Credential (Encrypted AES-256-GCM at rest)
                  </label>
                  <input
                    type="password"
                    placeholder="Enter secret token / key"
                    value={newAuthToken}
                    onChange={(e) => setNewAuthToken(e.target.value)}
                    className="mt-1 w-full rounded-lg border border-[#D5D8EB] bg-white px-3 py-2 text-xs font-mono text-[#1E2038]"
                  />
                </div>
              )}

              {/* Test Connection Button & Status */}
              <div className="rounded-xl bg-[#F8F9FD] p-3 space-y-2 border border-[#E2E4F0]">
                <div className="flex items-center justify-between">
                  <span className="text-xs font-semibold text-[#1E2038]">Dry-run Connection Test</span>
                  <button
                    type="button"
                    onClick={handleTestConnection}
                    disabled={testing || !newUrl}
                    className="rounded-lg bg-white border border-[#D5D8EB] px-3 py-1 text-xs font-semibold text-[#1E2038] hover:bg-[#F0F2FA] disabled:opacity-50 transition-colors"
                  >
                    {testing ? 'Probing...' : 'Test Connection'}
                  </button>
                </div>
                {testResult && (
                  <div
                    className={`text-xs p-2 rounded-lg flex items-center gap-1.5 font-medium ${
                      testResult.ok
                        ? 'bg-[#F0FDF4] text-[#15803D] border border-[#DCFCE7]'
                        : 'bg-[#FEF2F2] text-[#B91C1C] border border-[#FEE2E2]'
                    }`}
                  >
                    {testResult.ok ? (
                      <>
                        <CheckIcon className="h-4 w-4" />
                        Connected! Discovered {testResult.toolCount} tools ({testResult.protocolEra || '2026-07-28'}).
                      </>
                    ) : (
                      <>
                        <AlertCircleIcon className="h-4 w-4" />
                        Test Failed: {testResult.reason}
                      </>
                    )}
                  </div>
                )}
              </div>

              <div className="flex justify-end gap-2 pt-2 border-t border-[#E2E4F0]">
                <button
                  type="button"
                  onClick={() => setShowAddModal(false)}
                  className="rounded-lg border border-[#D5D8EB] px-3.5 py-2 text-xs font-semibold text-[#55597D] hover:bg-[#F4F5FF]"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={submitting}
                  className="rounded-lg bg-[#5356FB] px-4 py-2 text-xs font-semibold text-white shadow-sm hover:bg-[#4346E8] disabled:opacity-50"
                >
                  {submitting ? 'Registering...' : 'Register Upstream'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
