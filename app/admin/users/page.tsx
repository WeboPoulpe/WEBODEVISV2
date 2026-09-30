import { redirect } from 'next/navigation';

// Ancienne adresse de la page des comptes.
export default function AdminUsersRedirect() {
  redirect('/admin/comptes');
}
