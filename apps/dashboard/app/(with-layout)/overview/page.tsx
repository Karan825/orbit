'use client';

import { useEffect, useState } from 'react';
import { useHeaderContext } from '@/app/providers/header-provider';
import { UpstreamServer, GatewayStats, AuditEvent } from '@/types/mcp-gateway';
import {
  Server as ServerIcon,
  Activity,
  CheckCircle2 as CheckIcon,
  AlertCircle as AlertCircleIcon,
  Clock as ClockIcon,
  ShieldCheck as ShieldIcon,
  ArrowRight,
} from 'lucide-react';
import Link from 'next/link';

export default function OverviewPage() {
  const { setHeaderTitle, setHeaderContent } = useHeaderContext();
  const [stats, setStats] = useState<GatewayStats | null>(null);
  const [servers, setServers] = useState<UpstreamServer[]>([]);
  const [recentAudits, setRecentAudits] = useState<AuditEvent[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    setHeaderTitle('Gateway Overview');
    setHeaderContent(null);

    Promise.all([
      fetch('/api/stats/servers').then((r) => (r.ok ? r.json() : null)),
      fetch('/api/servers').then((r) => (r.ok ? r.json() : [])),
      fetch('/api/audit?limit=5').then((r) => (r.ok ? r.json() : { items: [] })),
    ])
      .then(([statsData, serversData, auditData]) => {
        if (statsData) setStats(statsData);
        const serverList = Array.isArray(serversData) ? serversData : (serversData?.servers || []);
        setServers(serverList);
        if (auditData?.items) setRecentAudits(auditData.items);
      })
      .catch((err) => {
        console.error('Failed to load dashboard data:', err);
      })
      .finally(() => setLoading(false));
  }, [setHeaderTitle, setHeaderContent]);

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

  if (loading) {
    return <div className="p-8 text-[#55597D] font-medium text-xs">Loading gateway metrics...</div>;
  }

  return (
    <div className="space-y-6">
      {/* Overview Cards Row */}
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <div className="rounded-xl border border-[#E2E4F0] bg-white p-5 shadow-xs">
          <div className="flex items-center justify-between">
            <span className="text-xs font-semibold uppercase tracking-wider text-[#64748B]">
              Upstream Servers
            </span>
            <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-[#EEF2FF] text-[#5356FB]">
              <ServerIcon className="h-4 w-4" />
            </div>
          </div>
          <div className="mt-3 flex items-baseline gap-2">
            <span className="text-2xl font-bold text-[#1E2038]">
              {stats?.activeServers} / {stats?.totalServers}
            </span>
            <span className="text-xs font-medium text-[#64748B]">Active / Total</span>
          </div>
          <p className="mt-1 text-xs text-[#8F95B2]">Governed MCP cluster upstreams</p>
        </div>

        <div className="rounded-xl border border-[#E2E4F0] bg-white p-5 shadow-xs">
          <div className="flex items-center justify-between">
            <span className="text-xs font-semibold uppercase tracking-wider text-[#64748B]">
              24h Tool Calls
            </span>
            <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-[#EEF2FF] text-[#5356FB]">
              <Activity className="h-4 w-4" />
            </div>
          </div>
          <div className="mt-3 flex items-baseline gap-2">
            <span className="text-2xl font-bold text-[#1E2038]">
              {stats?.totalCalls24h}
            </span>
            <span className="text-xs font-semibold text-[#5356FB]">calls</span>
          </div>
          <p className="mt-1 text-xs text-[#8F95B2]">Chat & external client invocations</p>
        </div>

        <div className="rounded-xl border border-[#E2E4F0] bg-white p-5 shadow-xs">
          <div className="flex items-center justify-between">
            <span className="text-xs font-semibold uppercase tracking-wider text-[#64748B]">
              Error Rate (1h)
            </span>
            <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-[#FFF8EC] text-[#B45309]">
              <AlertCircleIcon className="h-4 w-4" />
            </div>
          </div>
          <div className="mt-3 flex items-baseline gap-2">
            <span className="text-2xl font-bold text-[#1E2038]">
              {stats?.errorRate}%
            </span>
            <span className="text-xs font-semibold text-[#64748B]">isolated</span>
          </div>
          <p className="mt-1 text-xs text-[#8F95B2]">Fail-fast bulkhead protection</p>
        </div>

        <div className="rounded-xl border border-[#E2E4F0] bg-white p-5 shadow-xs">
          <div className="flex items-center justify-between">
            <span className="text-xs font-semibold uppercase tracking-wider text-[#64748B]">
              p95 Latency
            </span>
            <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-[#F5F3FF] text-[#7C3AED]">
              <ClockIcon className="h-4 w-4" />
            </div>
          </div>
          <div className="mt-3 flex items-baseline gap-2">
            <span className="text-2xl font-bold text-[#1E2038]">
              {stats?.p95LatencyMs} ms
            </span>
            <span className="text-xs font-medium text-[#5356FB]">Optimal</span>
          </div>
          <p className="mt-1 text-xs text-[#8F95B2]">In-cluster OAuth signing overhead included</p>
        </div>
      </div>

      {/* Upstream Health Table */}
      <div className="rounded-xl border border-[#E2E4F0] bg-white shadow-xs overflow-hidden">
        <div className="flex items-center justify-between border-b border-[#E2E4F0] p-5">
          <div>
            <h3 className="font-bold text-[#1E2038]">Upstream Server Health & Probes</h3>
            <p className="text-xs text-[#55597D]">
              Real-time probe state machine (every 10s), tool count, and cluster service endpoints.
            </p>
          </div>
          <Link
            href="/servers"
            className="flex items-center gap-1 text-xs font-semibold text-[#5356FB] hover:underline"
          >
            All Servers ({servers.length}) <ArrowRight className="h-3.5 w-3.5" />
          </Link>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-left text-sm">
            <thead className="border-b border-[#E2E4F0] bg-[#F8F9FD] text-xs uppercase font-semibold text-[#64748B]">
              <tr>
                <th className="px-5 py-3.5">Upstream Slug</th>
                <th className="px-5 py-3.5">Status</th>
                <th className="px-5 py-3.5">Tools</th>
                <th className="px-5 py-3.5">Auth Mode</th>
                <th className="px-5 py-3.5">Cluster Endpoint</th>
                <th className="px-5 py-3.5 text-right">Action</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-[#EDF0F8]">
              {servers.map((s) => (
                <tr key={s.id} className="hover:bg-[#F9FAFE] transition-colors">
                  <td className="px-5 py-3.5 font-medium text-[#1E2038]">
                    <div className="font-semibold">{s.name}</div>
                    <div className="text-xs font-mono text-[#8F95B2]">slug: {s.slug}</div>
                  </td>
                  <td className="px-5 py-3.5">{getStatusBadge(s.status, s.reason)}</td>
                  <td className="px-5 py-3.5 font-mono text-xs font-semibold text-[#5356FB]">
                    {s.toolCount} tools
                  </td>
                  <td className="px-5 py-3.5 text-xs text-[#55597D] uppercase font-semibold">
                    {s.auth.type}
                  </td>
                  <td className="px-5 py-3.5 font-mono text-xs text-[#55597D] truncate max-w-xs" title={s.url}>
                    {s.url}
                  </td>
                  <td className="px-5 py-3.5 text-right">
                    <Link
                      href="/servers"
                      className="text-xs font-semibold text-[#5356FB] hover:underline"
                    >
                      Inspect Tools
                    </Link>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {/* Recent Write-Ahead Audit Trail */}
      <div className="rounded-xl border border-[#E2E4F0] bg-white shadow-xs overflow-hidden">
        <div className="flex items-center justify-between border-b border-[#E2E4F0] p-5">
          <div>
            <h3 className="font-bold text-[#1E2038]">Write-Ahead Audit Activity</h3>
            <p className="text-xs text-[#55597D]">
              PostgreSQL audit log written before tool call dispatch. User identity guaranteed.
            </p>
          </div>
          <Link
            href="/audit"
            className="flex items-center gap-1 text-xs font-semibold text-[#5356FB] hover:underline"
          >
            View Full Audit Log <ArrowRight className="h-3.5 w-3.5" />
          </Link>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-left text-sm">
            <thead className="border-b border-[#E2E4F0] bg-[#F8F9FD] text-xs uppercase font-semibold text-[#64748B]">
              <tr>
                <th className="px-5 py-3.5">Time</th>
                <th className="px-5 py-3.5">User</th>
                <th className="px-5 py-3.5">Channel</th>
                <th className="px-5 py-3.5">Tool Call</th>
                <th className="px-5 py-3.5">Duration</th>
                <th className="px-5 py-3.5 text-right">Outcome</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-[#EDF0F8]">
              {recentAudits.map((a) => (
                <tr key={a.id} className="hover:bg-[#F9FAFE] transition-colors">
                  <td className="px-5 py-3 text-xs text-[#64748B]">
                    {new Date(a.startedAt).toLocaleTimeString()}
                  </td>
                  <td className="px-5 py-3 font-semibold text-[#1E2038] text-xs">{a.userEmail}</td>
                  <td className="px-5 py-3">
                    <span className="rounded bg-[#F0F2FA] px-2 py-0.5 font-mono text-[11px] uppercase font-bold text-[#55597D]">
                      {a.channel}
                    </span>
                  </td>
                  <td className="px-5 py-3 font-mono text-xs font-semibold text-[#5356FB]">
                    {a.exposedName || a.toolName || 'N/A'}
                  </td>
                  <td className="px-5 py-3 font-mono text-xs text-[#64748B]">
                    {a.durationMs ? `${a.durationMs}ms` : '-'}
                  </td>
                  <td className="px-5 py-3 text-right">
                    <span
                      className={`inline-flex rounded-md px-2 py-0.5 text-[11px] font-medium border ${
                        a.outcome === 'success'
                          ? 'bg-[#F0FDF4] text-[#15803D] border-[#DCFCE7]'
                          : a.outcome === 'denied'
                          ? 'bg-[#FFFBEB] text-[#B45309] border-[#FEF3C7]'
                          : 'bg-[#FEF2F2] text-[#B91C1C] border-[#FEE2E2]'
                      }`}
                    >
                      {a.outcome}
                    </span>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
