'use client';

import { useEffect, useState, useCallback } from 'react';
import { Users, Search, Loader2, Shield, ShieldOff, ToggleLeft, ToggleRight } from 'lucide-react';
import { createClient } from '@/lib/supabase/client';
import { cn } from '@/lib/utils';

interface AdminUser {
  id: string;
  email: string;
  first_name: string | null;
  last_name: string | null;
  company_name: string | null;
  role: string;
  is_active: boolean;
  created_at: string;
}

export default function AdminUsersPage() {
  const [users, setUsers] = useState<AdminUser[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [filter, setFilter] = useState<'all' | 'active' | 'disabled'>('all');

  const fetchUsers = useCallback(async () => {
    const sb = createClient();
    const { data } = await sb.from('profiles').select('id, email, first_name, last_name, company_name, role, is_active, created_at').order('created_at', { ascending: false });
    setUsers((data as AdminUser[]) ?? []);
    setLoading(false);
  }, []);

  useEffect(() => { fetchUsers(); }, [fetchUsers]);

  const filtered = users.filter((u) => {
    const matchSearch = !search ||
      u.email.toLowerCase().includes(search.toLowerCase()) ||
      (u.first_name || '').toLowerCase().includes(search.toLowerCase()) ||
      (u.last_name || '').toLowerCase().includes(search.toLowerCase()) ||
      (u.company_name || '').toLowerCase().includes(search.toLowerCase());
    const matchFilter = filter === 'all' || (filter === 'active' && u.is_active) || (filter === 'disabled' && !u.is_active);
    return matchSearch && matchFilter;
  });

  const toggleActive = async (id: string, isActive: boolean) => {
    const sb = createClient();
    await sb.from('profiles').update({ is_active: !isActive }).eq('id', id);
    setUsers((prev) => prev.map((u) => u.id === id ? { ...u, is_active: !isActive } : u));
  };

  const toggleAdmin = async (id: string, currentRole: string) => {
    const newRole = currentRole === 'admin' ? 'user' : 'admin';
    if (!confirm(`Changer ce compte en ${newRole} ?`)) return;
    const sb = createClient();
    await sb.from('profiles').update({ role: newRole }).eq('id', id);
    setUsers((prev) => prev.map((u) => u.id === id ? { ...u, role: newRole } : u));
  };

  return (
    <div className="p-6 max-w-7xl mx-auto">
      <div className="flex items-center justify-between mb-6">
        <div className="flex items-center gap-3">
          <div className="p-2 bg-blue-100 rounded-xl">
            <Users className="h-5 w-5 text-blue-600" />
          </div>
          <div>
            <h1 className="text-2xl font-bold text-gray-900">Utilisateurs</h1>
            <p className="text-sm text-gray-500">{users.length} comptes au total</p>
          </div>
        </div>
      </div>

      <div className="flex items-center gap-2 mb-4">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-gray-400" />
          <input value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Rechercher (nom, email, entreprise)…"
            className="w-full text-sm border border-gray-200 rounded-lg pl-9 pr-3 py-2 focus:outline-none focus:ring-2 focus:ring-[#9c27b0]/30" />
        </div>
        <div className="flex gap-1 bg-gray-100 p-1 rounded-lg">
          {(['all', 'active', 'disabled'] as const).map((f) => (
            <button key={f} onClick={() => setFilter(f)}
              className={cn('px-3 py-1 text-xs font-medium rounded',
                filter === f ? 'bg-white text-gray-900 shadow-sm' : 'text-gray-500 hover:text-gray-700')}>
              {f === 'all' ? 'Tous' : f === 'active' ? 'Actifs' : 'Désactivés'}
            </button>
          ))}
        </div>
      </div>

      {loading ? (
        <div className="flex items-center justify-center h-40"><Loader2 className="h-6 w-6 animate-spin text-[#9c27b0]" /></div>
      ) : (
        <div className="bg-white border border-gray-200 rounded-xl overflow-hidden">
          <table className="w-full text-sm">
            <thead className="bg-gray-50 border-b border-gray-200">
              <tr>
                <th className="text-left px-4 py-3 text-xs font-semibold text-gray-500 uppercase tracking-wider">Utilisateur</th>
                <th className="text-left px-4 py-3 text-xs font-semibold text-gray-500 uppercase tracking-wider">Entreprise</th>
                <th className="text-left px-4 py-3 text-xs font-semibold text-gray-500 uppercase tracking-wider">Inscription</th>
                <th className="text-center px-4 py-3 text-xs font-semibold text-gray-500 uppercase tracking-wider">Rôle</th>
                <th className="text-center px-4 py-3 text-xs font-semibold text-gray-500 uppercase tracking-wider">Actif</th>
                <th className="text-right px-4 py-3 text-xs font-semibold text-gray-500 uppercase tracking-wider">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {filtered.map((u) => (
                <tr key={u.id} className={u.is_active ? '' : 'bg-red-50/30'}>
                  <td className="px-4 py-3">
                    <div className="flex items-center gap-3">
                      <div className="w-8 h-8 rounded-full bg-gradient-to-br from-[#9c27b0] to-[#7b1fa2] flex items-center justify-center flex-shrink-0">
                        <span className="text-xs font-bold text-white">{(u.first_name?.[0] || u.email[0]).toUpperCase()}</span>
                      </div>
                      <div className="min-w-0">
                        <p className="font-medium text-gray-900 truncate">{[u.first_name, u.last_name].filter(Boolean).join(' ') || '—'}</p>
                        <p className="text-[10px] text-gray-500 truncate">{u.email}</p>
                      </div>
                    </div>
                  </td>
                  <td className="px-4 py-3 text-gray-700">{u.company_name || '—'}</td>
                  <td className="px-4 py-3 text-gray-500 text-xs">{new Date(u.created_at).toLocaleDateString('fr-FR')}</td>
                  <td className="px-4 py-3 text-center">
                    {u.role === 'admin' ? (
                      <span className="inline-flex items-center gap-1 px-2 py-0.5 bg-amber-100 text-amber-700 text-[10px] font-bold rounded-full">
                        <Shield className="h-3 w-3" />ADMIN
                      </span>
                    ) : (
                      <span className="text-[10px] text-gray-400">user</span>
                    )}
                  </td>
                  <td className="px-4 py-3 text-center">
                    <button onClick={() => toggleActive(u.id, u.is_active)} title={u.is_active ? 'Désactiver' : 'Activer'}>
                      {u.is_active ? <ToggleRight className="h-5 w-5 text-emerald-500" /> : <ToggleLeft className="h-5 w-5 text-gray-400" />}
                    </button>
                  </td>
                  <td className="px-4 py-3 text-right">
                    <button onClick={() => toggleAdmin(u.id, u.role)} title={u.role === 'admin' ? 'Retirer admin' : 'Promouvoir admin'}
                      className="text-xs text-amber-600 hover:underline">
                      {u.role === 'admin' ? <ShieldOff className="h-3.5 w-3.5 inline" /> : <Shield className="h-3.5 w-3.5 inline" />}
                    </button>
                  </td>
                </tr>
              ))}
              {filtered.length === 0 && (
                <tr><td colSpan={6} className="text-center py-10 text-sm text-gray-400 italic">Aucun utilisateur</td></tr>
              )}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
