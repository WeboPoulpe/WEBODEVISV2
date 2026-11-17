import { redirect } from 'next/navigation';
import { getSessionUser, requireStaff, type StaffRole } from '@/server/session';
import AdminShell from '@/components/admin/AdminShell';

export const dynamic = 'force-dynamic';

export default async function AdminLayout({ children }: { children: React.ReactNode }) {
  if (!(await getSessionUser())) redirect('/login');

  // Administrateur, ou support (limité à la page Comptes : voir AdminShell, et requireAdmin dans les fonctions serveur).
  let role: StaffRole;
  try {
    role = (await requireStaff()).role;
  } catch {
    redirect('/');
  }

  return <AdminShell role={role}>{children}</AdminShell>;
}
