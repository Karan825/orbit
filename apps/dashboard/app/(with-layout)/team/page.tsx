'use client';

import { useEffect, useState } from 'react';
import { useHeaderContext } from '@/app/providers/header-provider';
import { api } from '@/lib/api-client';
import { useAuth } from '@/app/providers/auth-provider';
import Link from 'next/link';
import { ShieldAlert } from 'lucide-react';
import { TeamMember } from '@/types/mcp-gateway';
import {
  Users as TeamIcon,
  Plus as PlusIcon,
  Copy as CopyIcon,
  CheckCircle2 as CheckIcon,
  X as CloseIcon,
} from 'lucide-react';

export default function TeamPage() {
  const { isMember } = useAuth();

  if (isMember) {
    return (
      <div className="rounded-2xl border border-[#E2E4F0] bg-white p-12 text-center shadow-xs max-w-lg mx-auto mt-12 space-y-4">
        <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-2xl bg-[#EEF0FF] text-[#5356FB] border border-[#D5D8EB]">
          <ShieldAlert className="h-6 w-6" />
        </div>
        <h2 className="text-lg font-bold text-[#1E2038]">Administrator Access Required</h2>
        <p className="text-xs text-[#55597D] leading-relaxed">
          Team member invitation, role modifications, and global API key revocation are restricted to Administrators. Your current role is <strong>Team Member</strong>.
        </p>
        <div className="pt-2">
          <Link
            href="/api-keys"
            className="inline-flex items-center rounded-xl bg-[#5356FB] px-4 py-2.5 text-xs font-semibold text-white shadow-xs hover:bg-[#4346E8] transition-colors"
          >
            Manage Your Personal API Keys
          </Link>
        </div>
      </div>
    );
  }
  const { setHeaderTitle, setHeaderContent } = useHeaderContext();
  const [members, setMembers] = useState<TeamMember[]>([]);
  const [loading, setLoading] = useState(true);
  const [showInviteModal, setShowInviteModal] = useState(false);
  const [inviteEmail, setInviteEmail] = useState('');
  const [inviteRole, setInviteRole] = useState<'admin' | 'member'>('member');
  const [generatedInvite, setGeneratedInvite] = useState<{ inviteUrl: string; expiresAt: string } | null>(null);
  const [copiedLink, setCopiedLink] = useState(false);

  const fetchTeam = async () => {
    try {
      const users = await api.getUsers();
      setMembers(users);
    } catch (e) {
      console.error(e);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    setHeaderTitle('Team & Role Permissions');
    setHeaderContent(null);
    fetchTeam();
  }, [setHeaderTitle, setHeaderContent]);

  const handleCreateInvite = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      const res = await api.createInvite({
        email: inviteEmail,
        role: inviteRole,
      });
      setGeneratedInvite(res);
      setInviteEmail('');
    } catch (e: any) {
      alert(e.message || 'Failed to create invitation');
    }
  };

  const copyInvite = () => {
    if (!generatedInvite) return;
    navigator.clipboard.writeText(generatedInvite.inviteUrl);
    setCopiedLink(true);
    setTimeout(() => setCopiedLink(false), 2000);
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-4 rounded-xl border border-[#E2E4F0] bg-white p-6 shadow-sm sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h2 className="text-xl font-bold tracking-tight text-[#1E2038]">Team Management</h2>
          <p className="mt-1 text-sm text-[#55597D]">
            Role-based access control: Admins manage upstreams and keys; Members use permitted tools and chat.
          </p>
        </div>
        <button
          onClick={() => {
            setGeneratedInvite(null);
            setShowInviteModal(true);
          }}
          className="inline-flex items-center gap-1.5 rounded-lg bg-[#5356FB] px-4 py-2.5 text-xs font-semibold text-white shadow-sm hover:bg-[#4346E8] transition-colors"
        >
          <PlusIcon className="h-4 w-4" />
          Invite Team Member
        </button>
      </div>

      <div className="rounded-xl border border-[#E2E4F0] bg-white shadow-sm overflow-hidden">
        <div className="p-5 border-b border-[#E2E4F0]">
          <h3 className="font-bold text-[#1E2038]">Active Team Members</h3>
          <p className="mt-0.5 text-xs text-[#55597D]">
            At least one active admin is always enforced by the platform.
          </p>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-left text-sm">
            <thead className="border-b border-[#E2E4F0] text-xs uppercase font-semibold text-[#55597D] bg-[#F8F9FD]">
              <tr>
                <th className="px-5 py-3.5">User</th>
                <th className="px-5 py-3.5">Role</th>
                <th className="px-5 py-3.5">Status</th>
                <th className="px-5 py-3.5">Created Date</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-[#E2E4F0]">
              {loading ? (
                <tr>
                  <td colSpan={4} className="p-8 text-center text-xs text-[#55597D] animate-pulse font-medium">
                    Loading team members...
                  </td>
                </tr>
              ) : members.length === 0 ? (
                <tr>
                  <td colSpan={4} className="p-8 text-center text-xs text-[#55597D]">
                    No members found.
                  </td>
                </tr>
              ) : (
                members.map((m) => (
                  <tr key={m.id} className="hover:bg-[#F9FAFE] transition-colors">
                    <td className="px-5 py-3.5">
                      <div className="font-semibold text-[#1E2038]">{m.displayName}</div>
                      <div className="text-xs text-[#55597D]">{m.email}</div>
                    </td>
                    <td className="px-5 py-3.5">
                      {m.role === 'admin' ? (
                        <span className="inline-flex rounded-full bg-[#EEF0FF] px-2.5 py-0.5 text-xs font-bold text-[#5356FB] border border-[#D5D8EB]">
                          Admin
                        </span>
                      ) : (
                        <span className="inline-flex rounded-full bg-[#F1F3F9] px-2.5 py-0.5 text-xs font-semibold text-[#64748B] border border-[#E2E8F0]">
                          Member
                        </span>
                      )}
                    </td>
                    <td className="px-5 py-3.5">
                      <span className="inline-flex rounded-md bg-[#F0FDF4] px-2.5 py-0.5 text-xs font-medium text-[#15803D] border border-[#DCFCE7]">
                        Active
                      </span>
                    </td>
                    <td className="px-5 py-3.5 text-xs text-[#55597D]">
                      {new Date(m.createdAt).toLocaleDateString()}
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Invite Modal */}
      {showInviteModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/40 backdrop-blur-xs p-4">
          <div className="w-full max-w-md rounded-2xl border border-[#E2E4F0] bg-white p-6 shadow-xl animate-in fade-in-50">
            <div className="flex items-center justify-between border-b border-[#E2E4F0] pb-3.5">
              <h3 className="font-bold text-base text-[#1E2038]">
                {generatedInvite ? 'Invitation Created' : 'Invite Team Member'}
              </h3>
              <button
                onClick={() => setShowInviteModal(false)}
                className="rounded-lg p-1 text-[#55597D] hover:bg-[#F0F2FA] hover:text-[#1E2038] transition-colors"
              >
                <CloseIcon className="h-5 w-5" />
              </button>
            </div>

            {!generatedInvite ? (
              <form onSubmit={handleCreateInvite} className="mt-4 space-y-4">
                <div>
                  <label className="block text-xs font-semibold text-[#1E2038]">
                    Email Address
                  </label>
                  <input
                    type="email"
                    required
                    placeholder="teammate@company.com"
                    value={inviteEmail}
                    onChange={(e) => setInviteEmail(e.target.value)}
                    className="mt-1.5 w-full rounded-xl border border-[#D5D8EB] bg-[#F8F9FD] px-3.5 py-2.5 text-xs text-[#1E2038] focus:bg-white focus:outline-none focus:border-[#5356FB] transition-all"
                  />
                </div>

                <div>
                  <label className="block text-xs font-semibold text-[#1E2038]">
                    Role
                  </label>
                  <select
                    value={inviteRole}
                    onChange={(e) => setInviteRole(e.target.value as any)}
                    className="mt-1.5 w-full rounded-xl border border-[#D5D8EB] bg-[#F8F9FD] px-3.5 py-2.5 text-xs text-[#1E2038] focus:bg-white focus:outline-none focus:border-[#5356FB] transition-all"
                  >
                    <option value="member">Member (Can access tools & chat agent)</option>
                    <option value="admin">Admin (Can configure upstreams & keys)</option>
                  </select>
                </div>

                <div className="flex justify-end gap-2.5 pt-3.5 border-t border-[#E2E4F0]">
                  <button
                    type="button"
                    onClick={() => setShowInviteModal(false)}
                    className="rounded-xl border border-[#D5D8EB] bg-white px-4 py-2 text-xs font-semibold text-[#1E2038] hover:bg-[#F4F5FF] transition-colors"
                  >
                    Cancel
                  </button>
                  <button
                    type="submit"
                    className="rounded-xl bg-[#5356FB] px-4 py-2 text-xs font-semibold text-white shadow-sm hover:bg-[#4346E8] transition-colors"
                  >
                    Generate 72h Invite Link
                  </button>
                </div>
              </form>
            ) : (
              <div className="mt-4 space-y-4">
                <p className="text-xs text-[#55597D]">
                  Share this single-use invite link. It expires in 72 hours.
                </p>

                <div className="flex items-center gap-2 rounded-xl border border-[#D5D8EB] bg-[#EEF0FF] p-2.5">
                  <input
                    type="text"
                    readOnly
                    value={generatedInvite.inviteUrl}
                    className="flex-1 bg-transparent font-mono text-xs font-semibold text-[#5356FB] focus:outline-none"
                  />
                  <button
                    onClick={copyInvite}
                    className="inline-flex items-center gap-1 rounded-lg bg-[#5356FB] px-3 py-1.5 text-xs font-semibold text-white shadow-sm hover:bg-[#4346E8] transition-colors"
                  >
                    {copiedLink ? <CheckIcon className="h-3.5 w-3.5" /> : <CopyIcon className="h-3.5 w-3.5" />}
                    {copiedLink ? 'Copied' : 'Copy'}
                  </button>
                </div>

                <div className="flex justify-end pt-3 border-t border-[#E2E4F0]">
                  <button
                    onClick={() => setShowInviteModal(false)}
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
