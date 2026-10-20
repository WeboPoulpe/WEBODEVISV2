'use server';

import { and, asc, eq, inArray, sql } from 'drizzle-orm';
import { companyIdsOf } from './companyScope';
import { db } from '@/db';
import { ingredients, profiles, supplier_order_items, supplier_orders, suppliers } from '@/db/schema';
import { sendMail } from '@/lib/mail';
import { supplierOrderEmail } from '@/lib/mail/templates';
import { DEMO_BLOCKED, isDemoUser } from '@/lib/demo';
import { isValidEmail, normalizeEmail } from '@/lib/emailList';
import { requireUser, requireWriter } from './session';

// Envoi d'un bon de commande au fournisseur par email. La commande doit appartenir au compte connecté.

/** Statuts depuis lesquels une commande peut partir (une commande envoyée peut être renvoyée). */
const SENDABLE = ['draft', 'sent'];

export interface SendSupplierOrderResult {
  error: string | null;
  /** Date d'envoi enregistrée sur la commande. */
  sentAt?: string;
  /** La copie demandée par le traiteur est partie (absent : pas de copie demandée). */
  copySent?: boolean;
}

export async function sendSupplierOrder(input: {
  orderId: string;
  to: string;
  message: string;
  /** Date de livraison souhaitée (AAAA-MM-JJ), facultative. */
  deliveryDate?: string | null;
  copyToMe?: boolean;
}): Promise<SendSupplierOrderResult> {
  const user = await requireWriter();
  if (isDemoUser(user.id)) return { error: DEMO_BLOCKED };

  const to = normalizeEmail(input.to ?? '');
  if (!to) return { error: 'Indiquez l’adresse email du fournisseur.' };
  if (!isValidEmail(to)) return { error: `L’adresse « ${to} » n’est pas valide.` };
  const deliveryDate = input.deliveryDate?.trim() || null;
  if (deliveryDate && (!/^\d{4}-\d{2}-\d{2}$/.test(deliveryDate) || Number.isNaN(Date.parse(deliveryDate)))) {
    return { error: 'La date de livraison n’est pas valide.' };
  }

  const [order] = await db
    .select({ id: supplier_orders.id, status: supplier_orders.status, supplier_id: supplier_orders.supplier_id })
    .from(supplier_orders)
    .where(and(eq(supplier_orders.id, input.orderId), sql`${supplier_orders.user_id} in ${companyIdsOf(user.id)}`))
    .limit(1);
  if (!order) return { error: 'Commande introuvable.' };
  if (!SENDABLE.includes(order.status)) {
    return { error: order.status === 'received' ? 'Cette commande est déjà reçue.' : 'Cette commande est annulée.' };
  }

  const items = await db
    .select({ name: ingredients.name, unit: ingredients.unit, quantity: supplier_order_items.quantity })
    .from(supplier_order_items)
    .innerJoin(ingredients, eq(ingredients.id, supplier_order_items.ingredient_id))
    .where(eq(supplier_order_items.order_id, order.id))
    .orderBy(asc(ingredients.name));
  if (items.length === 0) return { error: 'Cette commande n’a aucun article.' };

  const [profile] = await db
    .select({
      email: profiles.email, company_name: profiles.company_name, company_email: profiles.company_email,
      company_phone: profiles.company_phone, company_address: profiles.company_address,
      first_name: profiles.first_name, last_name: profiles.last_name,
    })
    .from(profiles).where(eq(profiles.id, user.id)).limit(1);
  const contactName = [profile?.first_name, profile?.last_name].filter(Boolean).join(' ') || null;
  const companyName = profile?.company_name || contactName || 'Votre traiteur';
  const replyTo = profile?.company_email || profile?.email || user.email;

  const mail = {
    fromName: companyName,
    replyTo,
    ...supplierOrderEmail({
      order: {
        companyName,
        reference: order.id.slice(0, 8).toUpperCase(),
        message: input.message ?? '',
        deliveryDate,
        items: items.map((i) => ({ name: i.name, quantity: Number(i.quantity), unit: i.unit })),
        contact: { name: contactName, phone: profile?.company_phone ?? null, email: replyTo, address: profile?.company_address ?? null },
      },
    }),
  };

  const res = await sendMail({ to, ...mail });
  if (res.error) return { error: 'L’email n’a pas pu être envoyé. Réessayez dans un instant.' };

  let copySent: boolean | undefined;
  const own = normalizeEmail(profile?.email || user.email || '');
  if (input.copyToMe && isValidEmail(own) && own !== to) copySent = !(await sendMail({ to: own, ...mail })).error;

  // L'email est parti : la commande passe à « Envoyée », avec la date d'envoi.
  const sentAt = new Date().toISOString();
  await db.update(supplier_orders)
    .set({ status: 'sent', ordered_at: sentAt, updated_at: sentAt })
    .where(and(eq(supplier_orders.id, order.id), sql`${supplier_orders.user_id} in ${companyIdsOf(user.id)}`, inArray(supplier_orders.status, SENDABLE)));

  // Le fournisseur n'avait pas d'adresse : on garde celle qui vient de servir pour la prochaine fois.
  await db.update(suppliers)
    .set({ email: to, updated_at: sentAt })
    .where(and(
      eq(suppliers.id, order.supplier_id),
      sql`(${suppliers.user_id} in ${companyIdsOf(user.id)} or ${suppliers.owner_user_id} in ${companyIdsOf(user.id)})`,
      sql`coalesce(trim(${suppliers.email}), '') = ''`,
    ));

  return { error: null, sentAt, copySent };
}
