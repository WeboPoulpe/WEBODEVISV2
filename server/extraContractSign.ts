'use server';

import { headers } from 'next/headers';
import { sql } from 'drizzle-orm';
import { db } from '@/db';
import { isDemoUser } from '@/lib/demo';
import { pushToUser } from '@/lib/push';
import { contractForExtra, contractHash } from './extraHrCore';

// Signature en ligne d'un contrat d'extra, depuis son lien personnel (/e/<jeton>/contrat/<id>) : le jeton de
// l'extra est la seule clé, comme pour ses missions. Signature électronique simple, sur le principe du « bon pour
// accord » des devis : nom, case d'acceptation, signature tracée, horodatage serveur, adresse IP, navigateur, et
// empreinte du contrat figé à l'envoi (vérifiée avant d'enregistrer la signature).

const MAX_SIGNATURE = 300_000;

export async function signExtraContract(input: { token: string; contractId: string; signerName: string; signature: string; accept: boolean }): Promise<{ error: string | null }> {
  const c = await contractForExtra(input?.token ?? '', input?.contractId ?? '');
  if (!c) return { error: 'Ce lien ne donne plus accès à ce contrat. Demandez un nouveau lien à votre employeur.' };
  if (c.status === 'signe') return { error: 'Ce contrat est déjà signé.' };

  const name = (input.signerName ?? '').trim().replace(/\s+/g, ' ').slice(0, 120);
  if (name.length < 2) return { error: 'Indiquez vos prénom et nom.' };
  if (!input.accept) return { error: 'Cochez la case pour accepter le contrat.' };
  if (!/^data:image\/png;base64,[A-Za-z0-9+/=]+$/.test(input.signature ?? '') || input.signature.length < 200) return { error: 'Signez dans le cadre prévu.' };
  if (input.signature.length > MAX_SIGNATURE) return { error: 'La signature est trop lourde. Effacez-la et signez à nouveau.' };
  // Le contrat présenté est bien celui qui a été envoyé.
  if (c.hash && contractHash(c.doc) !== c.hash) return { error: 'Ce contrat a été modifié depuis son envoi. Demandez un nouveau lien à votre employeur.' };
  // Compte de démonstration : rien n'est enregistré.
  if (isDemoUser(c.companyId)) return { error: null };

  const h = await headers();
  const ip = (h.get('x-forwarded-for') ?? '').split(',')[0].trim().slice(0, 64) || null;
  const ua = h.get('user-agent')?.slice(0, 300) ?? null;
  const { rows } = await db.execute<{ id: string }>(sql`
    update public.extra_contracts set status = 'signe', signer_name = ${name}, signature = ${input.signature}, signed_at = now(),
      signer_ip = ${ip}, signer_user_agent = ${ua}, signed_on_paper = false, updated_at = now()
    where id = ${c.id}::uuid and status = 'envoye' and content_hash is not distinct from ${c.hash}
    returning id`);
  if (!rows[0]) return { error: 'Ce contrat ne peut plus être signé. Demandez un nouveau lien à votre employeur.' };

  const title = `${c.extraName} a signé son contrat`;
  const message = `${name} a signé en ligne son contrat (${c.doc.subtitle}).`;
  await db.execute(sql`insert into public.notifications (user_id, title, message, type, priority, action_url)
    values (${c.companyId}::uuid, ${title}, ${message}, 'extra_response', 'medium', '/extras')`).catch(() => undefined);
  await pushToUser(c.companyId, { title, body: message, url: '/extras', tag: `contrat-${c.id}` }).catch(() => undefined);
  return { error: null };
}
