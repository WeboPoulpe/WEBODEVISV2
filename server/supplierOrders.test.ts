// Envoi d'un bon de commande au fournisseur, sur le vrai schéma en mémoire.
import { drizzle } from 'drizzle-orm/pglite';
import type { PGlite } from '@electric-sql/pglite';
import { beforeAll, beforeEach, expect, it, vi } from 'vitest';
import * as schema from '@/db/schema';
import { createTestDb } from '@/db/testDb';

vi.mock('server-only', () => ({}));
const sent: { to: string; subject: string; html: string; fromName?: string; replyTo?: string | null }[] = [];
vi.mock('@/lib/mail', () => ({
  sendMail: async (m: (typeof sent)[number]) => { sent.push(m); return { error: null }; },
}));
const ME = '00000000-0000-4000-8000-0000000000b1';
const OTHER = '00000000-0000-4000-8000-0000000000b2';
let current = ME;
vi.mock('./session', () => ({ requireUser: async () => ({ id: current, email: 'chef@t.fr' }), requireWriter: async () => ({ id: current, email: 'chef@t.fr' }) }));
let pg: PGlite;
vi.mock('@/db', () => ({ get db() { return drizzle(pg, { schema }); } }));

const { sendSupplierOrder } = await import('./supplierOrders');

const SUPPLIER = '00000000-0000-4000-8000-0000000000c1';
const ORDER = '00000000-0000-4000-8000-0000000000c2';
const OTHER_ORDER = '00000000-0000-4000-8000-0000000000c3';

beforeAll(async () => {
  pg = await createTestDb();
  await pg.exec(`
    insert into users (id, email, password_hash) values ('${ME}', 'chef@t.fr', 'x'), ('${OTHER}', 'autre@t.fr', 'x');
    insert into profiles (id, email, company_name, company_email, company_phone, company_address, first_name, last_name) values
      ('${ME}', 'chef@t.fr', 'Traiteur <Test>', 'contact@traiteur.fr', '0300000000', '1 rue des Fours, Troyes', 'Jean', 'Martin'),
      ('${OTHER}', 'autre@t.fr', 'Autre', null, null, null, null, null);
    insert into suppliers (id, owner_user_id, user_id, name, email) values ('${SUPPLIER}', '${ME}', '${ME}', 'Primeur', null);
    insert into ingredients (id, name, user_id, unit) values
      ('00000000-0000-4000-8000-0000000000e1', 'Tomates', '${ME}', 'kg'),
      ('00000000-0000-4000-8000-0000000000e2', 'Crème & lait', null, 'L');
    insert into supplier_orders (id, user_id, supplier_id, status) values
      ('${ORDER}', '${ME}', '${SUPPLIER}', 'draft'),
      ('${OTHER_ORDER}', '${OTHER}', '${SUPPLIER}', 'draft');
    insert into supplier_order_items (order_id, ingredient_id, quantity, unit_price) values
      ('${ORDER}', '00000000-0000-4000-8000-0000000000e1', 12.5, 3),
      ('${ORDER}', '00000000-0000-4000-8000-0000000000e2', 4, 1),
      ('${OTHER_ORDER}', '00000000-0000-4000-8000-0000000000e1', 1, 3);
  `);
});

beforeEach(() => { sent.length = 0; current = ME; });

const order = async (id: string) =>
  (await pg.query<{ status: string; ordered_at: Date | null }>(`select status, ordered_at from supplier_orders where id = $1`, [id])).rows[0];

it('refuse une adresse absente ou invalide, sans rien envoyer', async () => {
  expect((await sendSupplierOrder({ orderId: ORDER, to: ' ', message: 'x' })).error).toMatch(/adresse/);
  expect((await sendSupplierOrder({ orderId: ORDER, to: 'pas-une-adresse', message: 'x' })).error).toMatch(/pas valide/);
  expect((await sendSupplierOrder({ orderId: ORDER, to: 'f@primeur.fr', message: 'x', deliveryDate: '12/12/2026' })).error).toMatch(/date/);
  expect(sent).toHaveLength(0);
  expect((await order(ORDER)).status).toBe('draft');
});

it('refuse la commande d’un autre compte', async () => {
  expect((await sendSupplierOrder({ orderId: OTHER_ORDER, to: 'f@primeur.fr', message: 'x' })).error).toBe('Commande introuvable.');
  current = OTHER;
  expect((await sendSupplierOrder({ orderId: ORDER, to: 'f@primeur.fr', message: 'x' })).error).toBe('Commande introuvable.');
  expect(sent).toHaveLength(0);
  expect((await order(ORDER)).status).toBe('draft');
});

it('envoie la commande au fournisseur, au nom du traiteur, et la passe à « Envoyée »', async () => {
  const res = await sendSupplierOrder({ orderId: ORDER, to: 'F@Primeur.fr', message: 'Bonjour,\nvoici notre commande.', deliveryDate: '2026-12-11', copyToMe: true });
  expect(res.error).toBeNull();
  expect(res.copySent).toBe(true);
  expect(sent.map((m) => m.to)).toEqual(['f@primeur.fr', 'chef@t.fr']);
  const mail = sent[0];
  expect(mail.fromName).toBe('Traiteur <Test>');
  expect(mail.replyTo).toBe('contact@traiteur.fr');
  expect(mail.subject).toContain('livraison le vendredi 11 décembre 2026');
  // Tableau des articles, textes échappés, coordonnées du traiteur.
  expect(mail.html).toContain('<td style="padding:10px 12px;font-size:12px;font-weight:600;color:#57534C;text-align:left;">Ingrédient</td>');
  expect(mail.html).toContain('Crème &amp; lait');
  expect(mail.html).toContain('12,5');
  expect(mail.html).toContain('Traiteur &lt;Test&gt;');
  expect(mail.html).toContain('0300000000');
  expect(mail.html).toContain('1 rue des Fours, Troyes');
  expect(mail.html).toContain('Bonjour,<br>voici notre commande.');
  expect(mail.html).not.toContain('<!--articles-de-la-commande-->');

  const row = await order(ORDER);
  expect(row.status).toBe('sent');
  expect(row.ordered_at).not.toBeNull();
  // L'adresse utilisée est retenue pour le fournisseur, qui n'en avait pas.
  expect((await pg.query<{ email: string }>(`select email from suppliers where id = $1`, [SUPPLIER])).rows[0].email).toBe('f@primeur.fr');
});

it('ne renvoie pas une commande reçue', async () => {
  await pg.query(`update supplier_orders set status = 'received' where id = $1`, [ORDER]);
  expect((await sendSupplierOrder({ orderId: ORDER, to: 'f@primeur.fr', message: '' })).error).toMatch(/déjà reçue/);
  expect(sent).toHaveLength(0);
});
