'use server';

import { sql } from 'drizzle-orm';
import { db } from '@/db';
import { isDemoUser } from '@/lib/demo';
import { requireUser } from './session';

// « Vos premiers pas » sur le tableau de bord : les sept réglages et gestes qui rendent le compte utile.
// Tout est calculé en une requête, à l'échelle de l'entreprise : l'identité et les mentions sont celles
// du titulaire, le reste (carte, clients, devis, formulaire) compte pour toute l'équipe.

export type FirstStepKey = 'identite' | 'mentions' | 'prestations' | 'client' | 'devis' | 'envoi' | 'formulaire';

export interface FirstStep {
  key: FirstStepKey;
  label: string;
  hint: string;
  href: string;
  done: boolean;
}

export interface FirstStepsData {
  steps: FirstStep[];
  done: number;
  total: number;
}

/** Nombre de prestations à partir duquel la carte est considérée comme commencée. */
const MIN_PRESTATIONS = 3;

interface Row {
  identite: boolean; mentions: boolean; prestations: number; client: boolean; devis: boolean; envoi: boolean; formulaire: boolean;
}

/** Les premiers pas du compte connecté ; null pour la démonstration, qui n'a rien à configurer. */
export async function getFirstSteps(): Promise<FirstStepsData | null> {
  const user = await requireUser();
  if (isDemoUser(user.id)) return null;

  const filled = (column: string) => sql.raw(`nullif(trim(co.${column}), '') is not null`);
  const { rows } = await db.execute(sql`
    with me as (
      select coalesce(parent_user_id, id) as head from public.profiles where id = ${user.id}::uuid
    ),
    team as (
      select cp.id from public.profiles cp join me on coalesce(cp.parent_user_id, cp.id) = me.head
    ),
    co as (
      select p.* from public.profiles p join me on p.id = me.head
    )
    select
      coalesce((select (${filled('logo_url')} or ${filled('company_logo_url')}) and ${filled('company_name')} and ${filled('company_address')} from co), false) as identite,
      coalesce((select (${filled('siret')} or ${filled('company_siret')}) and (${filled('vat_number')} or co.vat_exempt) from co), false) as mentions,
      (select count(*) from public.prestations where user_id in (select id from team))::int as prestations,
      exists (select 1 from public.customers where owner_user_id in (select id from team) or user_id in (select id from team)) as client,
      exists (select 1 from public.quotes where owner_user_id in (select id from team) or user_id in (select id from team)) as devis,
      exists (select 1 from public.quotes where (owner_user_id in (select id from team) or user_id in (select id from team)) and sent_at is not null) as envoi,
      exists (select 1 from public.user_prospect_tokens where user_id in (select id from team) and is_active) as formulaire
  `);
  const r = rows[0] as unknown as Row;

  const steps: FirstStep[] = [
    { key: 'identite', label: 'Votre logo et votre entreprise', hint: 'Le nom, l’adresse et le logo en tête de vos devis', href: '/parametres', done: !!r.identite },
    { key: 'mentions', label: 'Les mentions légales', hint: 'Le SIRET et le numéro de TVA (ou l’exonération)', href: '/parametres', done: !!r.mentions },
    { key: 'prestations', label: 'Vos premières prestations', hint: `Au moins ${MIN_PRESTATIONS} plats ou services dans votre carte`, href: '/prestations', done: Number(r.prestations) >= MIN_PRESTATIONS },
    { key: 'client', label: 'Un premier client', hint: 'Un particulier ou une entreprise', href: '/clients/nouveau', done: !!r.client },
    { key: 'devis', label: 'Un premier devis', hint: 'L’événement, le client, puis le document', href: '/devis/nouveau', done: !!r.devis },
    { key: 'envoi', label: 'Un devis envoyé', hint: 'Par email à votre client, depuis le devis', href: '/devis', done: !!r.envoi },
    { key: 'formulaire', label: 'Votre formulaire de demande', hint: 'Un lien à mettre sur votre site pour recevoir des demandes', href: '/prospects?action=formulaire', done: !!r.formulaire },
  ];
  return { steps, done: steps.filter((s) => s.done).length, total: steps.length };
}
