import { redirect } from 'next/navigation';
import { getSessionUser, requireAdmin } from '@/server/session';
import AdminShell from '@/components/admin/AdminShell';

export const dynamic = 'force-dynamic';

export default async function AdminLayout({ children }: { children: React.ReactNode }) {
  if (!(await getSessionUser())) redirect('/login');

  // Check admin role
  try {
    await requireAdmin();
  } catch {
    redirect('/');
  }

  return <AdminShell>{children}</AdminShell>;
}
