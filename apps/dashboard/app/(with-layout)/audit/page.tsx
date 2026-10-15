'use client';

import { useEffect, useState } from 'react';
import { useHeaderContext } from '@/app/providers/header-provider';
import { api } from '@/lib/api-client';
import { AuditEvent, AuditOutcome } from '@/types/mcp-gateway';
import {
  FileText as AuditIcon,
  RefreshCw as RefreshIcon,
  Filter as FilterIcon,
  X as CloseIcon,
} from 'lucide-react';

export default function AuditPage() {
  const { setHeaderTitle, setHeaderContent } = useHeaderContext();
  const [events, setEvents] = useState<AuditEvent[]>([]);
  const [loading, setLoading] = useState(true);
  const [autoRefresh, setAutoRefresh] = useState(true);
  const [selectedEvent, setSelectedEvent] = useState<AuditEvent | null>(null);

  // Filters
  const [userFilter, setUserFilter] = useState('');
  const [channelFilter, setChannelFilter] = useState('');
  const [serverFilter, setServerFilter] = useState('');
  const [outcomeFilter, setOutcomeFilter] = useState('');

  const fetchAuditEvents = async () => {
    try {
      const res = await api.getAuditEvents({
        user: userFilter || undefined,
        channel: channelFilter || undefined,
        server: serverFilter || undefined,
        outcome: outcomeFilter || undefined,
      });
      setEvents(res.items || []);
    } catch (e) {
      console.error(e);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    setHeaderTitle('Audit Log');
    setHeaderContent(null);
    fetchAuditEvents();
  }, [setHeaderTitle, setHeaderContent, userFilter, channelFilter, serverFilter, outcomeFilter]);

  useEffect(() => {
    if (!autoRefresh) return;
    const interval = setInterval(fetchAuditEvents, 5000);
    return () => clearInterval(interval);
  }, [autoRefresh, userFilter, channelFilter, serverFilter, outcomeFilter]);

  const getOutcomeBadge = (outcome: AuditOutcome) => {
    switch (outcome) {
      case 'success':
        return (
          <span className="inline-flex rounded-md bg-[#F0FDF4] px-2.5 py-0.5 text-xs font-medium text-[#15803D] border border-[#DCFCE7]">
            success
          </span>
        );
      case 'denied':
        return (
          <span className="inline-flex rounded-md bg-[#FEF2F2] px-2.5 py-0.5 text-xs font-medium text-[#B91C1C] border border-[#FEE2E2]">
            access_denied
          </span>
        );
      case 'pending':
        return (
          <span className="inline-flex rounded-md bg-[#EEF0FF] px-2.5 py-0.5 text-xs font-medium text-[#5356FB] border border-[#D5D8EB]">
            pending
          </span>
        );
      default:
        return (
          <span className="inline-flex rounded-md bg-[#FEF2F2] px-2.5 py-0.5 text-xs font-medium text-[#B91C1C] border border-[#FEE2E2]">
            {outcome}
          </span>
        );
    }
  };

  return (
    <div className="space-y-6">
      {/* Top Banner & Auto-refresh */}
      <div className="flex flex-col gap-4 rounded-xl border border-[#E2E4F0] bg-white p-6 shadow-sm sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h2 className="text-xl font-bold tracking-tight text-[#1E2038]">Write-Ahead Audit Trail</h2>
          <p className="mt-1 text-sm text-[#55597D]">
            Durable, immutable record in PostgreSQL written before upstream calls. Attributed to authenticated user.
          </p>
        </div>
        <div className="flex items-center gap-3">
          <label className="flex items-center gap-2 text-xs font-medium text-[#55597D] cursor-pointer select-none">
            <input
              type="checkbox"
              checked={autoRefresh}
              onChange={(e) => setAutoRefresh(e.target.checked)}
              className="rounded border-[#D5D8EB] text-[#5356FB] focus:ring-[#5356FB] h-4 w-4"
            />
            Auto-refresh (5s)
          </label>
          <button
            onClick={() => fetchAuditEvents()}
            className="inline-flex items-center gap-1.5 rounded-lg border border-[#D5D8EB] bg-white px-3.5 py-2 text-xs font-semibold text-[#1E2038] hover:bg-[#F4F5FF] transition-colors shadow-2xs"
          >
            <RefreshIcon className={`h-3.5 w-3.5 ${loading ? 'animate-spin' : ''}`} />
            Refresh
          </button>
        </div>
      </div>

      {/* Filter Bar */}
      <div className="flex flex-wrap items-center gap-3 rounded-xl border border-[#E2E4F0] bg-white p-4 shadow-sm">
        <div className="flex items-center gap-1.5 text-xs font-semibold text-[#55597D]">
          <FilterIcon className="h-4 w-4 text-[#5356FB]" />
          Filters:
        </div>

        <input
          type="text"
          placeholder="Filter by user email..."
          value={userFilter}
          onChange={(e) => setUserFilter(e.target.value)}
          className="rounded-xl border border-[#D5D8EB] bg-[#F8F9FD] px-3 py-1.5 text-xs text-[#1E2038] placeholder-[#8E92BC] focus:bg-white focus:outline-none focus:border-[#5356FB] w-48"
        />

        <input
          type="text"
          placeholder="Filter by upstream server..."
          value={serverFilter}
          onChange={(e) => setServerFilter(e.target.value)}
          className="rounded-xl border border-[#D5D8EB] bg-[#F8F9FD] px-3 py-1.5 text-xs text-[#1E2038] placeholder-[#8E92BC] focus:bg-white focus:outline-none focus:border-[#5356FB] w-48"
        />

        <select
          value={channelFilter}
          onChange={(e) => setChannelFilter(e.target.value)}
          className="rounded-xl border border-[#D5D8EB] bg-[#F8F9FD] px-3 py-1.5 text-xs text-[#1E2038] focus:bg-white focus:outline-none focus:border-[#5356FB]"
        >
          <option value="">All Channels</option>
          <option value="chat_ui">Chat UI</option>
          <option value="claude_code">Claude Code</option>
          <option value="cursor">Cursor IDE</option>
          <option value="direct_mcp">Direct MCP</option>
        </select>

        <select
          value={outcomeFilter}
          onChange={(e) => setOutcomeFilter(e.target.value)}
          className="rounded-xl border border-[#D5D8EB] bg-[#F8F9FD] px-3 py-1.5 text-xs text-[#1E2038] focus:bg-white focus:outline-none focus:border-[#5356FB]"
        >
          <option value="">All Outcomes</option>
          <option value="success">Success</option>
          <option value="denied">Access Denied</option>
          <option value="error">Error</option>
          <option value="pending">Pending</option>
        </select>

        {(userFilter || channelFilter || serverFilter || outcomeFilter) && (
          <button
            onClick={() => {
              setUserFilter('');
              setChannelFilter('');
              setServerFilter('');
              setOutcomeFilter('');
            }}
            className="text-xs font-semibold text-[#D82A50] hover:underline ml-auto"
          >
            Clear filters
          </button>
        )}
      </div>

      {/* Audit Log Table */}
      <div className="rounded-xl border border-[#E2E4F0] bg-white shadow-sm overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-left text-sm">
            <thead className="border-b border-[#E2E4F0] text-xs uppercase font-semibold text-[#55597D] bg-[#F8F9FD]">
              <tr>
                <th className="px-5 py-3.5">Timestamp</th>
                <th className="px-5 py-3.5">User</th>
                <th className="px-5 py-3.5">Channel</th>
                <th className="px-5 py-3.5">Tool Name</th>
                <th className="px-5 py-3.5">Upstream</th>
                <th className="px-5 py-3.5">Outcome</th>
                <th className="px-5 py-3.5 text-right">Duration</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-[#E2E4F0]">
              {loading && events.length === 0 ? (
                <tr>
                  <td colSpan={7} className="p-8 text-center text-xs text-[#55597D] animate-pulse font-medium">
                    Loading audit records...
                  </td>
                </tr>
              ) : events.length === 0 ? (
                <tr>
                  <td colSpan={7} className="p-8 text-center text-xs text-[#55597D]">
                    No audit records match the current filter criteria.
                  </td>
                </tr>
              ) : (
                events.map((e) => (
                  <tr
                    key={e.id}
                    onClick={() => setSelectedEvent(e)}
                    className="hover:bg-[#F9FAFE] cursor-pointer transition-colors"
                  >
                    <td className="px-5 py-3.5 font-mono text-xs text-[#55597D]">
                      {new Date(e.startedAt).toLocaleTimeString()}
                    </td>
                    <td className="px-5 py-3.5 font-semibold text-[#1E2038]">
                      {e.userEmail}
                    </td>
                    <td className="px-5 py-3.5">
                      <span className="inline-flex rounded-full bg-[#F1F3F9] px-2.5 py-0.5 text-xs font-semibold text-[#64748B] border border-[#E2E8F0]">
                        {e.channel}
                      </span>
                    </td>
                    <td className="px-5 py-3.5 font-mono text-xs font-bold text-[#5356FB]">
                      {e.exposedName || e.toolName || 'tool_invocation'}
                    </td>
                    <td className="px-5 py-3.5 font-mono text-xs text-[#55597D]">
                      {e.serverSlug || '—'}
                    </td>
                    <td className="px-5 py-3.5">
                      {getOutcomeBadge(e.outcome)}
                    </td>
                    <td className="px-5 py-3.5 text-right font-mono text-xs text-[#55597D]">
                      {e.durationMs ? `${e.durationMs}ms` : '—'}
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Audit Detail Modal */}
      {selectedEvent && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/40 backdrop-blur-xs p-4">
          <div className="w-full max-w-2xl rounded-2xl border border-[#E2E4F0] bg-white p-6 shadow-xl animate-in fade-in-50 max-h-[90vh] overflow-y-auto">
            <div className="flex items-center justify-between border-b border-[#E2E4F0] pb-3.5">
              <div>
                <h3 className="font-bold text-base text-[#1E2038]">Audit Event Detail</h3>
                <p className="font-mono text-xs text-[#55597D]">ID: {selectedEvent.id}</p>
              </div>
              <button
                onClick={() => setSelectedEvent(null)}
                className="rounded-lg p-1 text-[#55597D] hover:bg-[#F0F2FA] hover:text-[#1E2038] transition-colors"
              >
                <CloseIcon className="h-5 w-5" />
              </button>
            </div>

            <div className="mt-4 space-y-4">
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 rounded-xl bg-[#F8F9FD] border border-[#E2E4F0] p-3.5 text-xs">
                <div>
                  <span className="text-[#55597D] block">User:</span>
                  <span className="font-bold text-[#1E2038]">{selectedEvent.userEmail}</span>
                </div>
                <div>
                  <span className="text-[#55597D] block">Channel:</span>
                  <span className="font-bold text-[#1E2038]">{selectedEvent.channel}</span>
                </div>
                <div>
                  <span className="text-[#55597D] block">Outcome:</span>
                  <span className="font-bold">{getOutcomeBadge(selectedEvent.outcome)}</span>
                </div>
                <div>
                  <span className="text-[#55597D] block">Latency:</span>
                  <span className="font-bold text-[#1E2038]">{selectedEvent.durationMs}ms</span>
                </div>
              </div>

              <div>
                <label className="block text-xs font-bold uppercase tracking-wider text-[#55597D] mb-1.5">
                  Input Arguments
                </label>
                <pre className="rounded-xl border border-[#E2E4F0] bg-[#F8F9FD] p-3.5 font-mono text-xs text-[#1E2038] overflow-x-auto">
                  {JSON.stringify(selectedEvent.argsPreview || {}, null, 2)}
                </pre>
              </div>

              {selectedEvent.resultBytes !== null && (
                <div>
                  <label className="block text-xs font-bold uppercase tracking-wider text-[#55597D] mb-1.5">
                    Payload Size
                  </label>
                  <div className="rounded-xl border border-[#E2E4F0] bg-[#F8F9FD] p-3.5 font-mono text-xs text-[#1E2038]">
                    {selectedEvent.resultBytes} bytes returned
                  </div>
                </div>
              )}

              {selectedEvent.errorMessage && (
                <div>
                  <label className="block text-xs font-bold uppercase tracking-wider text-[#D82A50] mb-1.5">
                    Error Message
                  </label>
                  <pre className="rounded-xl border border-[#F8BCC7] bg-[#FDECEF] p-3.5 font-mono text-xs text-[#D82A50] overflow-x-auto">
                    {selectedEvent.errorMessage}
                  </pre>
                </div>
              )}

              <div className="flex justify-end pt-3 border-t border-[#E2E4F0]">
                <button
                  onClick={() => setSelectedEvent(null)}
                  className="rounded-xl bg-[#5356FB] px-5 py-2 text-xs font-semibold text-white shadow-sm hover:bg-[#4346E8] transition-colors"
                >
                  Close
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
