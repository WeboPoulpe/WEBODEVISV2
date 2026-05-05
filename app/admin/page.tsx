'use client';

import { useEffect, useState } from 'react';
import { Users, FileText, UserCheck, TrendingUp, Loader2, Shield } from 'lucide-react';
import { createClient } from '@/lib/supabase/client';
import { formatCurrency } from '@/lib/utils';

export default function AdminDashboard() {
  const [loading, setLoading] = useState(true);
  const [stats, setStats] = useState({
    totalUsers: 0,
    activeUsers: 0,
    newUsersThisMonth: 0,
    totalQuotes: 0,
    totalRevenue: 0,
    totalProspects: 0,
  });

  useEffect(() => {
    const load = async () => {
      const sb = createClient();
      const startOfMonth = new Date();
      startOfMonth.setDate(1); startOfMonth.setHours(0, 0, 0, 0);

      const [users, activeUsers, newUsers, quotes, revenue, prospects] = await Promise.all([
        sb.from('profiles').select('*', { count: 'exact', head: true }),
        sb.from('profiles').select('*', { count: 'exact', head: true }).eq('is_active', true),
        sb.from('profiles').select('*', { count: 'exact', head: true }).gte('created_at', startOfMonth.toISOString()),
        sb.from('quotes').select('*', { count: 'exact', head: true }),
        sb.from('quotes').select('total_amount').eq('status', 'accepted'),
        sb.from('prospect_requests').select('*', { count: 'exact', head: true }),
      ]);

      const ca = (revenue.data || []).reduce((s, q) => s + (q.total_amount ?? 0), 0);

      setStats({
        totalUsers: users.count ?? 0,
        activeUsers: activeUsers.count ?? 0,
        newUsersThisMonth: newUsers.count ?? 0,
        totalQuotes: quotes.count ?? 0,
        totalRevenue: ca,
        totalProspects: prospects.count ?? 0,
      });
      setLoading(false);
    };
    load();
  }, []);

  if (loading) {
    return <div className="flex items-center justify-center h-screen"><Loader2 className="h-6 w-6 animate-spin text-[#9c27b0]" /></div>;
  }

  return (
    <div className="p-6 max-w-7xl mx-auto space-y-6">
      <div className="flex items-center gap-3 mb-6">
        <div className="p-2.5 bg-gradient-to-br from-amber-400 to-red-500 rounded-xl">
          <Shield className="h-5 w-5 text-white" />
        </div>
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Tableau de bord admin</h1>
          <p className="text-sm text-gray-500">Vue d&apos;ensemble globale de la plateforme</p>
        </div>
      </div>

      {/* KPIs */}
      <div className="grid grid-cols-2 md:grid-cols-3 gap-4">
        <KpiCard label="Traiteurs total" value={stats.totalUsers} icon={Users} color="blue" />
        <KpiCard label="Traiteurs actifs" value={stats.activeUsers} icon={UserCheck} color="emerald" />
        <KpiCard label="Inscriptions ce mois" value={stats.newUsersThisMonth} icon={TrendingUp} color="purple" />
        <KpiCard label="Devis créés" value={stats.totalQuotes} icon={FileText} color="amber" />
        <KpiCard label="CA cumulé (acceptés)" value={formatCurrency(stats.totalRevenue)} icon={TrendingUp} color="rose" />
        <KpiCard label="Demandes prospects" value={stats.totalProspects} icon={UserCheck} color="cyan" />
      </div>

      <div className="bg-white border border-gray-200 rounded-xl p-6">
        <h2 className="text-base font-bold text-gray-900 mb-2">Bienvenue, admin 👋</h2>
        <p className="text-sm text-gray-500">
          Tu peux gérer tous les comptes traiteur, les catégories de prestations globales, et surveiller l&apos;activité de l&apos;app depuis cet espace.
        </p>
      </div>
    </div>
  );
}

function KpiCard({ label, value, icon: Icon, color }: { label: string; value: number | string; icon: React.ElementType; color: string }) {
  const colorMap: Record<string, string> = {
    blue: 'from-blue-500 to-blue-600',
    emerald: 'from-emerald-500 to-emerald-600',
    purple: 'from-purple-500 to-purple-600',
    amber: 'from-amber-500 to-amber-600',
    rose: 'from-rose-500 to-rose-600',
    cyan: 'from-cyan-500 to-cyan-600',
  };
  return (
    <div className="bg-white border border-gray-200 rounded-xl p-5">
      <div className="flex items-center justify-between mb-3">
        <div className={`p-2 rounded-lg bg-gradient-to-br ${colorMap[color]}`}>
          <Icon className="h-4 w-4 text-white" />
        </div>
      </div>
      <p className="text-xs text-gray-500 font-medium">{label}</p>
      <p className="text-2xl font-bold text-gray-900 tabular-nums mt-1">{value}</p>
    </div>
  );
}
