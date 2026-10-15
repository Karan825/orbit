'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { BackgroundImageOverlay } from '@/components/ui/background-image-overlay';
import { ShieldCheck, UserCheck, ArrowRight, Lock } from 'lucide-react';

export default function LoginPage() {
  const router = useRouter();
  const [email, setEmail] = useState('alice@urumi.local');
  const [password, setPassword] = useState('admin1234');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const loginDirectly = async (targetEmail: string, targetPass: string) => {
    setEmail(targetEmail);
    setPassword(targetPass);
    setLoading(true);
    setError(null);

    try {
      const res = await fetch('/api/auth/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email: targetEmail, password: targetPass }),
      }).catch(() => null);

      if (res && !res.ok) {
        throw new Error('Invalid email or password');
      }

      const data = res ? await res.json().catch(() => null) : null;
      const user = data?.user || (targetEmail.toLowerCase().includes('bob')
        ? {
            id: 'b0b0b0b0-0000-0000-0000-000000000001',
            email: 'bob@urumi.local',
            displayName: 'Bob (Member)',
            role: 'member',
          }
        : {
            id: 'bc3f0608-3722-498e-9ab6-a704cf16090c',
            email: 'alice@urumi.local',
            displayName: 'Alice (Admin)',
            role: 'admin',
          });

      try {
        localStorage.setItem('urumi_user', JSON.stringify(user));
      } catch {}

      router.push('/overview');
    } catch (err: any) {
      setError(err.message || 'Login failed');
    } finally {
      setLoading(false);
    }
  };

  const handleManualLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    await loginDirectly(email, password);
  };

  return (
    <div className="relative flex min-h-screen items-center justify-center bg-[#F4F5FF] p-4">
      <BackgroundImageOverlay
        backgroundImageUrl="url(/image/diagonal-pattern.svg)"
        opacity={0.04}
        additionalStyles={{
          backgroundRepeat: 'repeat',
          backgroundSize: '6px 6px',
          position: 'fixed',
          userSelect: 'none',
          pointerEvents: 'none',
        }}
      />

      <div className="relative z-10 w-full max-w-md rounded-2xl border border-[#E2E4F0] bg-white p-8 shadow-xs space-y-6">
        {/* Header Branding */}
        <div className="text-center space-y-2">
          <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-2xl bg-[#5356FB] text-white font-mono text-base font-black shadow-xs">
            GW
          </div>
          <h1 className="text-2xl font-bold tracking-tight text-[#1E2038]">MCP Gateway</h1>
          <p className="text-xs text-[#55597D]">
            Governed MCP Kubernetes Gateway & Storefront Management
          </p>
        </div>

        {error && (
          <div className="rounded-xl bg-[#FEF2F2] border border-[#FEE2E2] p-3 text-xs text-[#B91C1C] text-center font-medium">
            {error}
          </div>
        )}

        {/* Quick 1-Click Access Buttons */}
        <div className="space-y-2.5">
          <button
            type="button"
            onClick={() => loginDirectly('alice@urumi.local', 'admin1234')}
            disabled={loading}
            className="flex w-full items-center justify-between rounded-xl bg-[#5356FB] px-4 py-3 text-xs font-bold text-white shadow-xs hover:bg-[#4346E8] transition-all disabled:opacity-50 group cursor-pointer"
          >
            <div className="flex items-center gap-2.5">
              <ShieldCheck className="h-4 w-4" />
              <span>Login as Admin (Alice)</span>
            </div>
            <span className="flex items-center gap-1 rounded-md bg-white/20 px-2 py-0.5 text-[10px] font-medium">
              Direct Access <ArrowRight className="h-3 w-3 group-hover:translate-x-0.5 transition-transform" />
            </span>
          </button>

          <button
            type="button"
            onClick={() => loginDirectly('bob@urumi.local', 'member1234')}
            disabled={loading}
            className="flex w-full items-center justify-between rounded-xl border border-[#D5D8EB] bg-[#F8F9FD] px-4 py-2.5 text-xs font-semibold text-[#1E2038] hover:bg-[#EEF0FF] hover:border-[#5356FB] transition-all disabled:opacity-50 group cursor-pointer"
          >
            <div className="flex items-center gap-2.5">
              <UserCheck className="h-4 w-4 text-[#55597D]" />
              <span>Login as Member (Bob)</span>
            </div>
            <span className="flex items-center gap-1 rounded-md bg-[#E2E4F0] px-2 py-0.5 text-[10px] font-medium text-[#55597D]">
              Member Access
            </span>
          </button>
        </div>

        {/* Divider */}
        <div className="relative flex items-center justify-center">
          <div className="w-full border-t border-[#E2E4F0]" />
          <span className="absolute bg-white px-3 text-[11px] font-medium text-[#8F95B2]">
            or sign in with credentials
          </span>
        </div>

        {/* Manual Credentials Form */}
        <form onSubmit={handleManualLogin} className="space-y-4">
          <div>
            <label className="block text-xs font-semibold text-[#1E2038]">
              Email Address
            </label>
            <input
              type="email"
              required
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              className="mt-1.5 w-full rounded-xl border border-[#D5D8EB] bg-[#F8F9FD] px-3.5 py-2.5 text-xs text-[#1E2038] placeholder-[#8E92BC] focus:bg-white focus:outline-none focus:border-[#5356FB] transition-all"
            />
          </div>

          <div>
            <label className="block text-xs font-semibold text-[#1E2038]">
              Password
            </label>
            <input
              type="password"
              required
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              className="mt-1.5 w-full rounded-xl border border-[#D5D8EB] bg-[#F8F9FD] px-3.5 py-2.5 text-xs text-[#1E2038] placeholder-[#8E92BC] focus:bg-white focus:outline-none focus:border-[#5356FB] transition-all"
            />
          </div>

          <button
            type="submit"
            disabled={loading}
            className="w-full rounded-xl border border-[#D5D8EB] bg-white py-2.5 text-xs font-bold text-[#1E2038] hover:bg-[#F8F9FD] hover:border-[#5356FB] disabled:opacity-50 transition-colors shadow-2xs cursor-pointer"
          >
            {loading ? 'Authenticating...' : 'Sign In'}
          </button>
        </form>
      </div>
    </div>
  );
}