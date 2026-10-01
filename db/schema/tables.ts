import { pgTable, uuid, text, timestamp, unique, foreignKey, check, boolean, jsonb, index, date, integer, numeric, time, varchar, uniqueIndex, pgEnum } from "drizzle-orm/pg-core"
import { sql } from "drizzle-orm"

export const customer_type = pgEnum("customer_type", ['particulier', 'entreprise'])
export const subscription_type = pgEnum("subscription_type", ['free', 'premium', 'entreprise'])
export const support_ticket_status = pgEnum("support_ticket_status", ['Ouvert', 'En cours', 'En attente de réponse', 'Résolu', 'Fermé'])
export const support_ticket_type = pgEnum("support_ticket_type", ['Bug technique', 'Question fonctionnelle', 'Suggestion d\'amélioration', 'Problème de facturation', 'Autre'])
export const user_role = pgEnum("user_role", ['admin', 'user'])


export const collaborator_roles = pgTable("collaborator_roles", {
	id: uuid().defaultRandom().primaryKey().notNull(),
	owner_user_id: uuid().notNull(),
	name: text().notNull(),
	description: text(),
	created_at: timestamp({ withTimezone: true, mode: 'string' }).defaultNow().notNull(),
	updated_at: timestamp({ withTimezone: true, mode: 'string' }).defaultNow().notNull(),
});

export const users = pgTable("users", {
	id: uuid().defaultRandom().primaryKey().notNull(),
	email: text().notNull(),
	password_hash: text().notNull(),
	created_at: timestamp({ withTimezone: true, mode: 'string' }).defaultNow().notNull(),
}, (table) => [
	unique("users_email_key").on(table.email),
]);

export const password_reset_tokens = pgTable("password_reset_tokens", {
	token_hash: text().primaryKey().notNull(),
	user_id: uuid().notNull(),
	expires_at: timestamp({ withTimezone: true, mode: 'string' }).notNull(),
	used_at: timestamp({ withTimezone: true, mode: 'string' }),
}, (table) => [
	foreignKey({
			columns: [table.user_id],
			foreignColumns: [users.id],
			name: "password_reset_tokens_user_id_fkey"
		}).onDelete("cascade"),
]);

export const material_categories = pgTable("material_categories", {
	id: uuid().defaultRandom().primaryKey().notNull(),
	owner_user_id: uuid().notNull(),
	name: text().notNull(),
	description: text(),
	created_at: timestamp({ withTimezone: true, mode: 'string' }).defaultNow().notNull(),
	updated_at: timestamp({ withTimezone: true, mode: 'string' }).defaultNow().notNull(),
});

export const notifications = pgTable("notifications", {
	id: uuid().defaultRandom().primaryKey().notNull(),
	user_id: uuid().notNull(),
	title: text().notNull(),
	message: text().notNull(),
	type: text().notNull(),
	priority: text().default('medium').notNull(),
	is_read: boolean().default(false).notNull(),
	data: jsonb(),
	action_url: text(),
	created_at: timestamp({ withTimezone: true, mode: 'string' }).defaultNow().notNull(),
	read_at: timestamp({ withTimezone: true, mode: 'string' }),
	expires_at: timestamp({ withTimezone: true, mode: 'string' }),
}, (table) => [
	check("notifications_priority_check", sql`priority = ANY (ARRAY['low'::text, 'medium'::text, 'high'::text])`),
	check("notifications_type_check", sql`type = ANY (ARRAY['prospect_request'::text, 'upcoming_event'::text, 'invoice_due'::text, 'support_ticket'::text, 'system_update'::text, 'task_reminder'::text, 'stock_alert'::text, 'extra_response'::text])`),
]);

export const collaborators = pgTable("collaborators", {
	id: uuid().defaultRandom().primaryKey().notNull(),
	owner_user_id: uuid().notNull(),
	first_name: text().notNull(),
	last_name: text().notNull(),
	email: text().notNull(),
	role: text(),
	phone: text(),
	notes: text(),
	is_active: boolean().default(true).notNull(),
	created_at: timestamp({ withTimezone: true, mode: 'string' }).defaultNow().notNull(),
	updated_at: timestamp({ withTimezone: true, mode: 'string' }).defaultNow().notNull(),
}, (table) => [
	foreignKey({
			columns: [table.owner_user_id],
			foreignColumns: [users.id],
			name: "collaborators_user_id_fkey"
		}).onDelete("cascade"),
	unique("collaborators_user_id_email_key").on(table.email, table.owner_user_id),
]);

export const briefing_tokens = pgTable("briefing_tokens", {
	id: uuid().defaultRandom().primaryKey().notNull(),
	quote_id: uuid().notNull(),
	collaborator_id: uuid().notNull(),
	token: uuid().defaultRandom().notNull(),
	expires_at: timestamp({ withTimezone: true, mode: 'string' }).notNull(),
	created_at: timestamp({ withTimezone: true, mode: 'string' }).defaultNow().notNull(),
}, (table) => [
	foreignKey({
			columns: [table.collaborator_id],
			foreignColumns: [collaborators.id],
			name: "briefing_tokens_collaborator_id_fkey"
		}).onDelete("cascade"),
	foreignKey({
			columns: [table.quote_id],
			foreignColumns: [quotes.id],
			name: "briefing_tokens_quote_id_fkey"
		}).onDelete("cascade"),
	unique("briefing_tokens_quote_id_collaborator_id_key").on(table.collaborator_id, table.quote_id),
	unique("briefing_tokens_token_key").on(table.token),
]);

export const quotes = pgTable("quotes", {
	id: uuid().defaultRandom().primaryKey().notNull(),
	owner_user_id: uuid().notNull(),
	client_name: text().notNull(),
	event_date: date().notNull(),
	event_type: text().notNull(),
	guest_count: integer().notNull(),
	remarks: text(),
	total_amount: numeric({ precision: 10, scale:  2 }).default('0'),
	status: text().default('draft').notNull(),
	created_at: timestamp({ withTimezone: true, mode: 'string' }).defaultNow().notNull(),
	updated_at: timestamp({ withTimezone: true, mode: 'string' }).defaultNow().notNull(),
	internal_notes: text(),
	customer_id: uuid(),
	name: text(),
	is_archived: boolean().default(false),
	total_cost_price: numeric().default('0'),
	event_status: text().default('en_cours'),
	team_arrival_time: time(),
	event_location: text(),
	quote_number: text(),
	edited_client_name: text(),
	edited_event_type: text(),
	edited_event_location: text(),
	edited_remarks: text(),
	edited_services_intro: text(),
	edited_services_details: text(),
	edited_conditions: text(),
	checklist: jsonb().default([]),
	images: jsonb().default([]),
	template: text().default('standard'),
	services: jsonb().default([]),
	client_first_name: text(),
	client_last_name: text(),
	client_email: text(),
	client_phone: text(),
	client_address: text(),
	client_type: text().default('particulier'),
	company_name: text(),
	contact_person_name: text(),
	vat_rate: numeric().default('20'),
	hide_price: boolean().default(false),
	user_id: uuid(),
	content_html: text(),
	event_materials: jsonb().default([]),
	// Lignes « matériel » et « personnel » du devis déjà préparées (identifiants de lignes).
	event_material_checks: jsonb().default([]),
	// Lien public envoyé au client pour consulter le devis, et date du dernier envoi.
	// Réglages de l'éditeur de document : interligne, descriptions affichées, largeur de la carte.
	editor_settings: jsonb(),
	share_token: text().unique(),
	sent_at: timestamp({ withTimezone: true, mode: 'string' }),
	selected_font: varchar({ length: 100 }).default('Georgia'),
	selected_font_size: integer(),
	language: text().default('fr'),
	imported: boolean().default(false),
	imported_file_url: text(),
	imported_file_name: text(),
	guest_count_adults: integer(),
	guest_count_children: integer(),
	cover_page_config: jsonb(),
	photos_page_config: jsonb(),
	prospect_id: text(),
	extra_costs: jsonb().default([]),
	client_siret: text(),
	recipient_contact_email: text(),
	recipient_contact_phone: text(),
	recipient_contact_role: text(),
	recipient_contact_id: text(),
	internal_name: text(),
	folder_id: uuid(),
}, (table) => [
	index("idx_quotes_customer_id").using("btree", table.customer_id.asc().nullsLast().op("uuid_ops")),
	index("idx_quotes_folder").using("btree", table.folder_id.asc().nullsLast().op("uuid_ops")),
	foreignKey({
			columns: [table.customer_id],
			foreignColumns: [customers.id],
			name: "quotes_customer_id_fkey"
		}).onDelete("set null"),
	foreignKey({
			columns: [table.folder_id],
			foreignColumns: [quote_folders.id],
			name: "quotes_folder_id_fkey"
		}).onDelete("set null"),
	foreignKey({
			columns: [table.owner_user_id],
			foreignColumns: [users.id],
			name: "quotes_user_id_fkey"
		}).onDelete("cascade"),
	foreignKey({
			columns: [table.user_id],
			foreignColumns: [users.id],
			name: "quotes_user_id_fkey1"
		}),
	check("quotes_guest_count_check", sql`guest_count > 0`),
	check("quotes_status_check", sql`status = ANY (ARRAY['nouveau'::text, 'broch_envoyee'::text, 'devis_a_faire'::text, 'devis_envoye'::text, 'rdv_deg_a_venir'::text, 'rdv_deg_fait'::text, 'devis_final'::text, 'valide'::text, 'acompte'::text, 'paye'::text, 'refus_client'::text, 'refus_traiteur'::text])`),
]);

export const customers = pgTable("customers", {
	id: uuid().defaultRandom().primaryKey().notNull(),
	customer_type: customer_type().notNull(),
	email: text().notNull(),
	phone: text(),
	address: text(),
	service_address: text(),
	notes: text(),
	created_at: timestamp({ withTimezone: true, mode: 'string' }).defaultNow().notNull(),
	updated_at: timestamp({ withTimezone: true, mode: 'string' }).defaultNow().notNull(),
	first_name: text(),
	last_name: text(),
	company_name: text(),
	siret_number: text(),
	contact_person_name: text(),
	contact_person_email: text(),
	contact_person_phone: text(),
	owner_user_id: uuid().notNull(),
	user_id: uuid(),
}, (table) => [
	uniqueIndex("customers_email_owner_unique").using("btree", table.email.asc().nullsLast().op("text_ops"), table.owner_user_id.asc().nullsLast().op("text_ops")),
	uniqueIndex("customers_siret_owner_unique").using("btree", table.siret_number.asc().nullsLast().op("uuid_ops"), table.owner_user_id.asc().nullsLast().op("uuid_ops")).where(sql`(siret_number IS NOT NULL)`),
	index("idx_customers_company_name").using("btree", table.company_name.asc().nullsLast().op("text_ops")).where(sql`(customer_type = 'entreprise'::customer_type)`),
	index("idx_customers_customer_type").using("btree", table.customer_type.asc().nullsLast().op("enum_ops")),
	index("idx_customers_email").using("btree", table.email.asc().nullsLast().op("text_ops")),
	index("idx_customers_last_name").using("btree", table.last_name.asc().nullsLast().op("text_ops")).where(sql`(customer_type = 'particulier'::customer_type)`),
	index("idx_customers_user_id").using("btree", table.owner_user_id.asc().nullsLast().op("uuid_ops")),
	foreignKey({
			columns: [table.owner_user_id],
			foreignColumns: [users.id],
			name: "customers_user_id_fkey"
		}),
	foreignKey({
			columns: [table.user_id],
			foreignColumns: [users.id],
			name: "customers_user_id_fkey1"
		}).onDelete("cascade"),
	check("check_entreprise_fields", sql`((customer_type = 'entreprise'::customer_type) AND (company_name IS NOT NULL) AND (contact_person_name IS NOT NULL)) OR (customer_type <> 'entreprise'::customer_type)`),
	check("check_particulier_fields", sql`((customer_type = 'particulier'::customer_type) AND (first_name IS NOT NULL) AND (last_name IS NOT NULL)) OR (customer_type <> 'particulier'::customer_type)`),
]);

export const customer_contacts = pgTable("customer_contacts", {
	id: uuid().defaultRandom().primaryKey().notNull(),
	customer_id: uuid().notNull(),
	owner_user_id: uuid().notNull(),
	name: text().notNull(),
	role: text(),
	email: text(),
	phone: text(),
	notes: text(),
	is_primary: boolean().default(false).notNull(),
	created_at: timestamp({ withTimezone: true, mode: 'string' }).defaultNow().notNull(),
}, (table) => [
	index("idx_customer_contacts_customer").using("btree", table.customer_id.asc().nullsLast().op("uuid_ops")),
	foreignKey({
			columns: [table.customer_id],
			foreignColumns: [customers.id],
			name: "customer_contacts_customer_id_fkey"
		}).onDelete("cascade"),
]);

export const demo_quotes = pgTable("demo_quotes", {
	id: uuid().defaultRandom().primaryKey().notNull(),
	session_id: text(),
	client_name: text().notNull(),
	event_date: date().notNull(),
	event_type: text().notNull(),
	guest_count: integer().notNull(),
	total_amount: numeric().default('0'),
	status: text().default('draft'),
	remarks: text(),
	name: text(),
	created_at: timestamp({ withTimezone: true, mode: 'string' }).defaultNow(),
	total_cost_price: numeric().default('0'),
}, (table) => [
	foreignKey({
			columns: [table.session_id],
			foreignColumns: [demo_sessions.session_id],
			name: "demo_quotes_session_id_fkey"
		}).onDelete("cascade"),
]);

export const demo_quote_services = pgTable("demo_quote_services", {
	id: uuid().defaultRandom().primaryKey().notNull(),
	quote_id: uuid(),
	service_id: uuid(),
	quantity: integer().default(1),
	unit_price: numeric().notNull(),
	is_option: boolean().default(false),
	is_free: boolean().default(false),
	sort_order: integer().default(0),
	cost_price: numeric().default('0'),
}, (table) => [
	foreignKey({
			columns: [table.quote_id],
			foreignColumns: [demo_quotes.id],
			name: "demo_quote_services_quote_id_fkey"
		}).onDelete("cascade"),
	foreignKey({
			columns: [table.service_id],
			foreignColumns: [demo_services.id],
			name: "demo_quote_services_service_id_fkey"
		}).onDelete("cascade"),
]);

export const demo_services = pgTable("demo_services", {
	id: uuid().defaultRandom().primaryKey().notNull(),
	session_id: text(),
	name: text().notNull(),
	description: text(),
	price: numeric().notNull(),
	is_variable_price: boolean().default(false),
	created_at: timestamp({ withTimezone: true, mode: 'string' }).defaultNow(),
	cost_price: numeric().default('0'),
}, (table) => [
	foreignKey({
			columns: [table.session_id],
			foreignColumns: [demo_sessions.session_id],
			name: "demo_services_session_id_fkey"
		}).onDelete("cascade"),
]);

export const demo_sessions = pgTable("demo_sessions", {
	id: uuid().defaultRandom().primaryKey().notNull(),
	session_id: text().notNull(),
	created_at: timestamp({ withTimezone: true, mode: 'string' }).defaultNow(),
	expires_at: timestamp({ withTimezone: true, mode: 'string' }).default(sql`(now() + '01:00:00'::interval)`),
}, (table) => [
	unique("demo_sessions_session_id_key").on(table.session_id),
]);

export const devis_templates = pgTable("devis_templates", {
	id: uuid().defaultRandom().primaryKey().notNull(),
	user_id: uuid().notNull(),
	name: text().notNull(),
	services: jsonb().default([]),
	content_html: text(),
	template: text().default('standard'),
	selected_font: text(),
	selected_font_size: integer().default(12),
	remarks: text(),
	vat_rate: numeric().default('20'),
	hide_price: boolean().default(false),
	created_at: timestamp({ withTimezone: true, mode: 'string' }).defaultNow(),
	updated_at: timestamp({ withTimezone: true, mode: 'string' }).defaultNow(),
}, (table) => [
	foreignKey({
			columns: [table.user_id],
			foreignColumns: [users.id],
			name: "devis_templates_user_id_fkey"
		}).onDelete("cascade"),
]);

export const event_attachments = pgTable("event_attachments", {
	id: uuid().defaultRandom().primaryKey().notNull(),
	quote_id: uuid().notNull(),
	file_name: text().notNull(),
	file_path: text().notNull(),
	file_size: integer(),
	mime_type: text(),
	uploaded_by: uuid().notNull(),
	created_at: timestamp({ withTimezone: true, mode: 'string' }).defaultNow().notNull(),
	visibility_type: text().default('all'),
	visible_to_collaborators: uuid().array().default([""]),
}, (table) => [
	foreignKey({
			columns: [table.quote_id],
			foreignColumns: [quotes.id],
			name: "event_attachments_quote_id_fkey"
		}).onDelete("cascade"),
	foreignKey({
			columns: [table.uploaded_by],
			foreignColumns: [users.id],
			name: "event_attachments_uploaded_by_fkey"
		}),
	check("event_attachments_visibility_type_check", sql`visibility_type = ANY (ARRAY['all'::text, 'specific'::text])`),
]);

export const event_attachment_visibility = pgTable("event_attachment_visibility", {
	id: uuid().defaultRandom().primaryKey().notNull(),
	attachment_id: uuid().notNull(),
	collaborator_id: uuid().notNull(),
	created_at: timestamp({ withTimezone: true, mode: 'string' }).defaultNow().notNull(),
}, (table) => [
	foreignKey({
			columns: [table.attachment_id],
			foreignColumns: [event_attachments.id],
			name: "event_attachment_visibility_attachment_id_fkey"
		}).onDelete("cascade"),
	foreignKey({
			columns: [table.collaborator_id],
			foreignColumns: [collaborators.id],
			name: "event_attachment_visibility_collaborator_id_fkey"
		}).onDelete("cascade"),
	unique("event_attachment_visibility_attachment_id_collaborator_id_key").on(table.attachment_id, table.collaborator_id),
]);

export const extras = pgTable("extras", {
	id: uuid().defaultRandom().primaryKey().notNull(),
	user_id: uuid().notNull(),
	name: text().notNull(),
	phone: text(),
	email: text(),
	role: text(),
	access_token: text().default(sql`encode(gen_random_bytes(16), 'hex'::text)`),
	created_at: timestamp({ withTimezone: true, mode: 'string' }).defaultNow(),
	// Jours où l'extra a indiqué ne pas être disponible (depuis sa page de missions).
	unavailable_dates: date({ mode: 'string' }).array().default(sql`'{}'::date[]`).notNull(),
}, (table) => [
	foreignKey({
			columns: [table.user_id],
			foreignColumns: [users.id],
			name: "extras_user_id_fkey"
		}),
	unique("extras_access_token_key").on(table.access_token),
]);

export const event_extras = pgTable("event_extras", {
	id: uuid().defaultRandom().primaryKey().notNull(),
	quote_id: uuid().notNull(),
	extra_id: uuid().notNull(),
	status: text().default('a_solliciter').notNull(),
	arrival_time: text(),
	mission_notes: text(),
	assign_courses: boolean().default(false).notNull(),
	created_at: timestamp({ withTimezone: true, mode: 'string' }).defaultNow(),
	/** Heure de fin prévue. */
	departure_time: text(),
	/** Mission envoyée à l'extra (email, notification). */
	invited_at: timestamp({ withTimezone: true, mode: 'string' }),
	/** Réponse de l'extra depuis sa page (statut « confirme » ou « refuse »). */
	responded_at: timestamp({ withTimezone: true, mode: 'string' }),
	/** Rappel de la veille envoyé. */
	reminded_at: timestamp({ withTimezone: true, mode: 'string' }),
}, (table) => [
	foreignKey({
			columns: [table.extra_id],
			foreignColumns: [extras.id],
			name: "event_extras_extra_id_fkey"
		}).onDelete("cascade"),
	foreignKey({
			columns: [table.quote_id],
			foreignColumns: [quotes.id],
			name: "event_extras_quote_id_fkey"
		}).onDelete("cascade"),
	unique("event_extras_quote_id_extra_id_key").on(table.extra_id, table.quote_id),
]);

export const ingredients = pgTable("ingredients", {
	id: uuid().defaultRandom().primaryKey().notNull(),
	owner_user_id: uuid(),
	name: text().notNull(),
	category: text(),
	unit: text().default('Unité'),
	image_url: text(),
	// Auteur et licence de la photo quand elle vient d'une banque d'images libres.
	image_credit: text(),
	off_product_id: text(),
	created_at: timestamp({ withTimezone: true, mode: 'string' }).defaultNow(),
	sub_category: text(),
	user_id: uuid(),
	stock_quantity: numeric().default('0'),
	min_stock_alert: numeric().default('0'),
	volume_unit_price: numeric().default('0'),
	preferred_supplier_id: uuid(),
}, (table) => [
	foreignKey({
			columns: [table.owner_user_id],
			foreignColumns: [users.id],
			name: "ingredients_owner_user_id_fkey"
		}),
	foreignKey({
			columns: [table.preferred_supplier_id],
			foreignColumns: [suppliers.id],
			name: "ingredients_preferred_supplier_id_fkey"
		}).onDelete("set null"),
	foreignKey({
			columns: [table.user_id],
			foreignColumns: [users.id],
			name: "ingredients_user_id_fkey"
		}),
]);

export const event_ingredients = pgTable("event_ingredients", {
	id: uuid().defaultRandom().primaryKey().notNull(),
	quote_id: uuid().notNull(),
	ingredient_id: uuid().notNull(),
	quantity: numeric().default('1').notNull(),
	unit: text(),
	supplier_id: uuid(),
	notes: text(),
	checked: boolean().default(false).notNull(),
	// 'auto' : ligne calculée depuis les prestations (remplacée au recalcul) ; 'manuelle' : ajoutée à la main (conservée).
	source: text().default('manuelle').notNull(),
	created_at: timestamp({ withTimezone: true, mode: 'string' }).defaultNow(),
}, (table) => [
	index("idx_event_ingredients_quote_id").using("btree", table.quote_id.asc().nullsLast().op("uuid_ops")),
	foreignKey({
			columns: [table.ingredient_id],
			foreignColumns: [ingredients.id],
			name: "event_ingredients_ingredient_id_fkey"
		}),
	foreignKey({
			columns: [table.quote_id],
			foreignColumns: [quotes.id],
			name: "event_ingredients_quote_id_fkey"
		}).onDelete("cascade"),
	foreignKey({
			columns: [table.supplier_id],
			foreignColumns: [suppliers.id],
			name: "event_ingredients_supplier_id_fkey"
		}),
]);

export const suppliers = pgTable("suppliers", {
	id: uuid().defaultRandom().primaryKey().notNull(),
	owner_user_id: uuid().notNull(),
	name: text().notNull(),
	contact_person: text(),
	email: text(),
	phone: text(),
	address: text(),
	notes: text(),
	is_active: boolean().default(true).notNull(),
	created_at: timestamp({ withTimezone: true, mode: 'string' }).defaultNow().notNull(),
	updated_at: timestamp({ withTimezone: true, mode: 'string' }).defaultNow().notNull(),
	user_id: uuid(),
}, (table) => [
	foreignKey({
			columns: [table.user_id],
			foreignColumns: [users.id],
			name: "suppliers_user_id_fkey"
		}),
]);

export const event_personal_materials = pgTable("event_personal_materials", {
	id: uuid().defaultRandom().primaryKey().notNull(),
	quote_id: uuid().notNull(),
	personal_material_id: uuid().notNull(),
	allocated_quantity: integer().default(0).notNull(),
	notes: text(),
	created_at: timestamp({ withTimezone: true, mode: 'string' }).defaultNow().notNull(),
	updated_at: timestamp({ withTimezone: true, mode: 'string' }).defaultNow().notNull(),
	assigned_to: uuid(),
}, (table) => [
	foreignKey({
			columns: [table.assigned_to],
			foreignColumns: [collaborators.id],
			name: "event_personal_materials_assigned_to_fkey"
		}).onDelete("set null"),
	foreignKey({
			columns: [table.personal_material_id],
			foreignColumns: [personal_materials.id],
			name: "event_personal_materials_personal_material_id_fkey"
		}).onDelete("cascade"),
	foreignKey({
			columns: [table.quote_id],
			foreignColumns: [quotes.id],
			name: "event_personal_materials_quote_id_fkey"
		}).onDelete("cascade"),
	unique("event_personal_materials_quote_id_personal_material_id_key").on(table.personal_material_id, table.quote_id),
]);

export const personal_materials = pgTable("personal_materials", {
	id: uuid().defaultRandom().primaryKey().notNull(),
	owner_user_id: uuid().notNull(),
	name: text().notNull(),
	description: text(),
	total_quantity: integer().default(0).notNull(),
	category: text(),
	notes: text(),
	created_at: timestamp({ withTimezone: true, mode: 'string' }).defaultNow().notNull(),
	updated_at: timestamp({ withTimezone: true, mode: 'string' }).defaultNow().notNull(),
});

export const event_tasks = pgTable("event_tasks", {
	id: uuid().defaultRandom().primaryKey().notNull(),
	quote_id: uuid().notNull(),
	name: text().notNull(),
	assigned_to: uuid(),
	status: text().default('a_faire').notNull(),
	created_by: uuid().notNull(),
	created_at: timestamp({ withTimezone: true, mode: 'string' }).defaultNow().notNull(),
	updated_at: timestamp({ withTimezone: true, mode: 'string' }).defaultNow().notNull(),
	sort_order: integer().default(0).notNull(),
}, (table) => [
	foreignKey({
			columns: [table.assigned_to],
			foreignColumns: [collaborators.id],
			name: "event_tasks_assigned_to_fkey"
		}).onDelete("set null"),
	foreignKey({
			columns: [table.created_by],
			foreignColumns: [users.id],
			name: "event_tasks_created_by_fkey"
		}),
	foreignKey({
			columns: [table.quote_id],
			foreignColumns: [quotes.id],
			name: "event_tasks_quote_id_fkey"
		}).onDelete("cascade"),
	check("event_tasks_status_check", sql`status = ANY (ARRAY['a_faire'::text, 'fait'::text])`),
]);

export const event_team_assignments = pgTable("event_team_assignments", {
	id: uuid().defaultRandom().primaryKey().notNull(),
	quote_id: uuid().notNull(),
	collaborator_id: uuid().notNull(),
	assigned_at: timestamp({ withTimezone: true, mode: 'string' }).defaultNow().notNull(),
	created_by: uuid().notNull(),
}, (table) => [
	foreignKey({
			columns: [table.collaborator_id],
			foreignColumns: [collaborators.id],
			name: "event_team_assignments_collaborator_id_fkey"
		}).onDelete("cascade"),
	foreignKey({
			columns: [table.created_by],
			foreignColumns: [users.id],
			name: "event_team_assignments_created_by_fkey"
		}),
	foreignKey({
			columns: [table.quote_id],
			foreignColumns: [quotes.id],
			name: "event_team_assignments_quote_id_fkey"
		}).onDelete("cascade"),
	unique("event_team_assignments_quote_id_collaborator_id_key").on(table.collaborator_id, table.quote_id),
]);

export const invitation_links = pgTable("invitation_links", {
	id: uuid().defaultRandom().primaryKey().notNull(),
	token: text().notNull(),
	created_by: uuid().notNull(),
	created_at: timestamp({ withTimezone: true, mode: 'string' }).defaultNow().notNull(),
	expires_at: timestamp({ withTimezone: true, mode: 'string' }).default(sql`(now() + '7 days'::interval)`).notNull(),
	used_at: timestamp({ withTimezone: true, mode: 'string' }),
	used_by: uuid(),
	is_active: boolean().default(true).notNull(),
	max_uses: integer().default(1).notNull(),
	current_uses: integer().default(0).notNull(),
}, (table) => [
	foreignKey({
			columns: [table.created_by],
			foreignColumns: [users.id],
			name: "invitation_links_created_by_fkey"
		}),
	foreignKey({
			columns: [table.used_by],
			foreignColumns: [users.id],
			name: "invitation_links_used_by_fkey"
		}),
	unique("invitation_links_token_key").on(table.token),
]);

export const invoices = pgTable("invoices", {
	id: uuid().defaultRandom().primaryKey().notNull(),
	quote_id: uuid().notNull(),
	invoice_number: text().notNull(),
	owner_user_id: uuid().notNull(),
	client_name: text().notNull(),
	total_amount: numeric().notNull(),
	status: text().default('pending').notNull(),
	invoice_date: date().default(sql`CURRENT_DATE`).notNull(),
	due_date: date().default(sql`(CURRENT_DATE + '30 days'::interval)`).notNull(),
	created_at: timestamp({ withTimezone: true, mode: 'string' }).defaultNow().notNull(),
	updated_at: timestamp({ withTimezone: true, mode: 'string' }).defaultNow().notNull(),
}, (table) => [
	foreignKey({
			columns: [table.quote_id],
			foreignColumns: [quotes.id],
			name: "invoices_quote_id_fkey"
		}).onDelete("cascade"),
	unique("invoices_invoice_number_key").on(table.invoice_number),
]);

export const invoice_services = pgTable("invoice_services", {
	id: uuid().defaultRandom().primaryKey().notNull(),
	invoice_id: uuid().notNull(),
	service_name: text().notNull(),
	quantity: integer().default(1).notNull(),
	unit_price: numeric().notNull(),
	description: text(),
	created_at: timestamp({ withTimezone: true, mode: 'string' }).defaultNow().notNull(),
}, (table) => [
	foreignKey({
			columns: [table.invoice_id],
			foreignColumns: [invoices.id],
			name: "invoice_services_invoice_id_fkey"
		}).onDelete("cascade"),
]);

export const invoice_status_history = pgTable("invoice_status_history", {
	id: uuid().defaultRandom().primaryKey().notNull(),
	invoice_id: uuid().notNull(),
	old_status: text(),
	new_status: text().notNull(),
	changed_at: timestamp({ withTimezone: true, mode: 'string' }).defaultNow().notNull(),
	changed_by: uuid().notNull(),
	notes: text(),
}, (table) => [
	foreignKey({
			columns: [table.invoice_id],
			foreignColumns: [invoices.id],
			name: "fk_invoice"
		}),
	foreignKey({
			columns: [table.invoice_id],
			foreignColumns: [invoices.id],
			name: "invoice_status_history_invoice_id_fkey"
		}).onDelete("cascade"),
]);

export const prestation_categories = pgTable("prestation_categories", {
	id: uuid().defaultRandom().primaryKey().notNull(),
	user_id: uuid(),
	name: text().notNull(),
	icon: text(),
	sort_order: integer().default(0),
	created_at: timestamp({ withTimezone: true, mode: 'string' }).defaultNow(),
}, (table) => [
	index("idx_prestation_categories_user").using("btree", table.user_id.asc().nullsLast().op("uuid_ops")),
	foreignKey({
			columns: [table.user_id],
			foreignColumns: [users.id],
			name: "prestation_categories_user_id_fkey"
		}).onDelete("cascade"),
]);

export const prestation_subcategories = pgTable("prestation_subcategories", {
	id: uuid().defaultRandom().primaryKey().notNull(),
	category_id: uuid().notNull(),
	user_id: uuid(),
	name: text().notNull(),
	sort_order: integer().default(0),
	created_at: timestamp({ withTimezone: true, mode: 'string' }).defaultNow(),
}, (table) => [
	index("idx_prestation_subcategories_cat").using("btree", table.category_id.asc().nullsLast().op("uuid_ops")),
	index("idx_prestation_subcategories_user").using("btree", table.user_id.asc().nullsLast().op("uuid_ops")),
	foreignKey({
			columns: [table.category_id],
			foreignColumns: [prestation_categories.id],
			name: "prestation_subcategories_category_id_fkey"
		}).onDelete("cascade"),
	foreignKey({
			columns: [table.user_id],
			foreignColumns: [users.id],
			name: "prestation_subcategories_user_id_fkey"
		}).onDelete("cascade"),
]);

export const prestations = pgTable("prestations", {
	id: uuid().defaultRandom().primaryKey().notNull(),
	user_id: uuid().notNull(),
	name: text().notNull(),
	unit_price: numeric().default('0').notNull(),
	category: text(),
	description: text(),
	created_at: timestamp({ withTimezone: true, mode: 'string' }).defaultNow(),
	sub_category: text(),
	is_option: boolean().default(false),
	cost_price: numeric().default('0'),
	gastro_card_html: text(),
	gastro_card_html_en: text(),
	category_id: uuid(),
	sub_category_id: uuid(),
	child_unit_price: numeric(),
	photo_url: text(),
}, (table) => [
	index("idx_prestations_category_id").using("btree", table.category_id.asc().nullsLast().op("uuid_ops")),
	index("idx_prestations_sub_category_id").using("btree", table.sub_category_id.asc().nullsLast().op("uuid_ops")),
	foreignKey({
			columns: [table.category_id],
			foreignColumns: [prestation_categories.id],
			name: "prestations_category_id_fkey"
		}).onDelete("set null"),
	foreignKey({
			columns: [table.sub_category_id],
			foreignColumns: [prestation_subcategories.id],
			name: "prestations_sub_category_id_fkey"
		}).onDelete("set null"),
	foreignKey({
			columns: [table.user_id],
			foreignColumns: [users.id],
			name: "prestations_user_id_fkey"
		}),
]);

export const profiles = pgTable("profiles", {
	id: uuid().primaryKey().notNull(),
	email: text().notNull(),
	first_name: text(),
	last_name: text(),
	role: user_role().default('user').notNull(),
	is_active: boolean().default(true).notNull(),
	created_at: timestamp({ withTimezone: true, mode: 'string' }).defaultNow().notNull(),
	updated_at: timestamp({ withTimezone: true, mode: 'string' }).defaultNow().notNull(),
	subscription_type: text().default('free'),
	company_name: text(),
	company_siret: text(),
	company_address: text(),
	company_phone: text(),
	company_email: text(),
	company_logo_url: text(),
	company_cgv: text(),
	company_website: text(),
	completed_tutorial_pages: jsonb().default([]),
	pdf_main_color: text().default('#2563eb'),
	pdf_table_header_color: text().default('#2563eb'),
	pdf_option_text_color: text().default('#f97316'),
	pdf_free_text_color: text().default('#22c55e'),
	pdf_total_color: text().default('#2563eb'),
	pdf_hide_prices: boolean().default(false),
	pdf_hide_descriptions_page: boolean().default(false),
	quotes_count: integer().default(0),
	company_bank_name: text(),
	company_iban: text(),
	company_bic: text(),
	company_bank_account_holder: text(),
	preferred_payment_method: text().default('virement'),
	custom_vat_rate: numeric().default('20'),
	parent_user_id: uuid(),
	subscription_plan: text().default('free').notNull(),
	max_linked_users: integer().default(1).notNull(),
	can_view_all_company_data: boolean().default(false).notNull(),
	pdf_font_size_client_name: integer().default(16),
	pdf_font_size_event_type: integer().default(16),
	pdf_font_size_event_location: integer().default(16),
	pdf_font_size_remarks: integer().default(14),
	pdf_font_size_services_intro: integer().default(14),
	pdf_font_size_services_details: integer().default(14),
	pdf_font_size_conditions: integer().default(12),
	has_completed_onboarding: boolean().default(false),
	// Options activées pour ce compte (voir lib/modules.ts). Vide : les options standard.
	modules: jsonb(),
	// Style et police proposés à la création d'un devis (page Styles de devis).
	default_quote_style: text(),
	default_quote_font: text(),
	default_vat_rate: integer().default(20),
	cgv: text(),
	siret: text(),
	logo_url: text(),
}, (table) => [
	index("idx_profiles_company_siret").using("btree", table.company_siret.asc().nullsLast().op("text_ops")),
	foreignKey({
			columns: [table.id],
			foreignColumns: [users.id],
			name: "profiles_id_fkey"
		}).onDelete("cascade"),
	foreignKey({
			columns: [table.parent_user_id],
			foreignColumns: [table.id],
			name: "profiles_parent_user_id_fkey"
		}).onDelete("set null"),
	check("profiles_custom_vat_rate_check", sql`(custom_vat_rate >= (0)::numeric) AND (custom_vat_rate <= (100)::numeric)`),
	check("profiles_subscription_type_check", sql`subscription_type = ANY (ARRAY['free'::text, 'premium'::text])`),
]);

export const user_prospect_tokens = pgTable("user_prospect_tokens", {
	id: uuid().defaultRandom().primaryKey().notNull(),
	user_id: uuid().notNull(),
	token: text().notNull(),
	is_active: boolean().default(true).notNull(),
	created_at: timestamp({ withTimezone: true, mode: 'string' }).defaultNow().notNull(),
	updated_at: timestamp({ withTimezone: true, mode: 'string' }).defaultNow().notNull(),
	brochure_url: text(),
}, (table) => [
	unique("user_prospect_tokens_token_key").on(table.token),
]);

export const prospect_requests = pgTable("prospect_requests", {
	id: uuid().defaultRandom().primaryKey().notNull(),
	first_name: text().notNull(),
	last_name: text().notNull(),
	email: text().notNull(),
	phone: text(),
	address: text(),
	service_address: text(),
	guest_count: integer(),
	event_type: text(),
	event_date: date(),
	message: text(),
	status: text().default('nouveau').notNull(),
	created_at: timestamp({ withTimezone: true, mode: 'string' }).defaultNow().notNull(),
	updated_at: timestamp({ withTimezone: true, mode: 'string' }).defaultNow().notNull(),
	owner_user_id: uuid(),
	user_token: text(),
	guest_count_children: integer(),
}, (table) => [
	foreignKey({
			columns: [table.user_token],
			foreignColumns: [user_prospect_tokens.token],
			name: "prospect_requests_user_token_fkey"
		}),
	check("prospect_requests_status_check", sql`status = ANY (ARRAY['nouveau'::text, 'broch_envoyee'::text, 'devis_a_faire'::text, 'devis_envoye'::text, 'rdv_deg_a_venir'::text, 'rdv_deg_fait'::text, 'devis_final'::text, 'valide'::text, 'acompte'::text, 'paye'::text, 'refus_client'::text, 'refus_traiteur'::text])`),
]);

export const purchase_orders = pgTable("purchase_orders", {
	id: uuid().defaultRandom().primaryKey().notNull(),
	owner_user_id: uuid().notNull(),
	quote_id: uuid().notNull(),
	supplier_id: uuid(),
	po_number: text().notNull(),
	status: text().default('draft').notNull(),
	order_date: date().default(sql`CURRENT_DATE`).notNull(),
	expected_delivery_date: date(),
	assigned_to: uuid(),
	notes: text(),
	total_amount: numeric().default('0').notNull(),
	created_at: timestamp({ withTimezone: true, mode: 'string' }).defaultNow().notNull(),
	updated_at: timestamp({ withTimezone: true, mode: 'string' }).defaultNow().notNull(),
	attach_pdf_to_briefing: boolean().default(false).notNull(),
}, (table) => [
	foreignKey({
			columns: [table.assigned_to],
			foreignColumns: [collaborators.id],
			name: "purchase_orders_assigned_to_fkey"
		}),
	foreignKey({
			columns: [table.quote_id],
			foreignColumns: [quotes.id],
			name: "purchase_orders_quote_id_fkey"
		}).onDelete("cascade"),
	foreignKey({
			columns: [table.supplier_id],
			foreignColumns: [suppliers.id],
			name: "purchase_orders_supplier_id_fkey"
		}),
]);

export const purchase_order_items = pgTable("purchase_order_items", {
	id: uuid().defaultRandom().primaryKey().notNull(),
	purchase_order_id: uuid().notNull(),
	service_id: uuid(),
	item_name: text().notNull(),
	description: text(),
	quantity: integer().default(1).notNull(),
	unit_price: numeric().default('0').notNull(),
	notes: text(),
	created_at: timestamp({ withTimezone: true, mode: 'string' }).defaultNow().notNull(),
}, (table) => [
	foreignKey({
			columns: [table.purchase_order_id],
			foreignColumns: [purchase_orders.id],
			name: "purchase_order_items_purchase_order_id_fkey"
		}).onDelete("cascade"),
	foreignKey({
			columns: [table.service_id],
			foreignColumns: [services.id],
			name: "purchase_order_items_service_id_fkey"
		}),
]);

export const services = pgTable("services", {
	id: uuid().defaultRandom().primaryKey().notNull(),
	owner_user_id: uuid().notNull(),
	name: text().notNull(),
	description: text(),
	price: numeric({ precision: 10, scale:  2 }).notNull(),
	created_at: timestamp({ withTimezone: true, mode: 'string' }).defaultNow().notNull(),
	updated_at: timestamp({ withTimezone: true, mode: 'string' }).defaultNow().notNull(),
	is_variable_price: boolean().default(false).notNull(),
	cost_price: numeric().default('0'),
	category_id: uuid(),
	supplier_id: uuid(),
	parent_service_id: uuid(),
	internal_note: text(),
}, (table) => [
	index("idx_services_category_id").using("btree", table.category_id.asc().nullsLast().op("uuid_ops")),
	index("idx_services_parent_service_id").using("btree", table.parent_service_id.asc().nullsLast().op("uuid_ops")),
	foreignKey({
			columns: [table.category_id],
			foreignColumns: [service_categories.id],
			name: "services_category_id_fkey"
		}),
	foreignKey({
			columns: [table.parent_service_id],
			foreignColumns: [table.id],
			name: "services_parent_service_id_fkey"
		}),
	foreignKey({
			columns: [table.supplier_id],
			foreignColumns: [suppliers.id],
			name: "services_supplier_id_fkey"
		}),
	foreignKey({
			columns: [table.owner_user_id],
			foreignColumns: [users.id],
			name: "services_user_id_fkey"
		}).onDelete("cascade"),
	check("services_price_check", sql`price >= (0)::numeric`),
]);

export const quote_folders = pgTable("quote_folders", {
	id: uuid().defaultRandom().primaryKey().notNull(),
	owner_user_id: uuid().notNull(),
	parent_id: uuid(),
	name: text().notNull(),
	color: text().default('purple').notNull(),
	icon: text().default('folder').notNull(),
	created_at: timestamp({ withTimezone: true, mode: 'string' }).defaultNow().notNull(),
}, (table) => [
	index("idx_quote_folders_owner").using("btree", table.owner_user_id.asc().nullsLast().op("uuid_ops")),
	index("idx_quote_folders_parent").using("btree", table.parent_id.asc().nullsLast().op("uuid_ops")),
	foreignKey({
			columns: [table.parent_id],
			foreignColumns: [table.id],
			name: "quote_folders_parent_id_fkey"
		}).onDelete("cascade"),
]);

export const quote_photos = pgTable("quote_photos", {
	id: uuid().defaultRandom().primaryKey().notNull(),
	user_id: uuid().notNull(),
	quote_id: uuid(),
	file_name: text().notNull(),
	file_path: text().notNull(),
	file_url: text().notNull(),
	caption: text(),
	sort_order: integer().default(0).notNull(),
	is_base_photo: boolean().default(false).notNull(),
	created_at: timestamp({ withTimezone: true, mode: 'string' }).defaultNow().notNull(),
	updated_at: timestamp({ withTimezone: true, mode: 'string' }).defaultNow().notNull(),
}, (table) => [
	index("idx_quote_photos_quote_id").using("btree", table.quote_id.asc().nullsLast().op("uuid_ops")),
	index("idx_quote_photos_user_id").using("btree", table.user_id.asc().nullsLast().op("uuid_ops")),
	foreignKey({
			columns: [table.quote_id],
			foreignColumns: [quotes.id],
			name: "quote_photos_quote_id_fkey"
		}).onDelete("cascade"),
]);

export const quote_services = pgTable("quote_services", {
	id: uuid().defaultRandom().primaryKey().notNull(),
	quote_id: uuid().notNull(),
	service_id: uuid().notNull(),
	quantity: integer().default(1).notNull(),
	unit_price: numeric({ precision: 10, scale:  2 }).notNull(),
	created_at: timestamp({ withTimezone: true, mode: 'string' }).defaultNow().notNull(),
	sort_order: integer().default(0),
	is_option: boolean().default(false),
	is_free: boolean().default(false),
	cost_price: numeric().default('0'),
	custom_name: text(),
	custom_description: text(),
}, (table) => [
	index("idx_quote_services_sort_order").using("btree", table.quote_id.asc().nullsLast().op("uuid_ops"), table.sort_order.asc().nullsLast().op("uuid_ops")),
	foreignKey({
			columns: [table.quote_id],
			foreignColumns: [quotes.id],
			name: "quote_services_quote_id_fkey"
		}).onDelete("cascade"),
	foreignKey({
			columns: [table.service_id],
			foreignColumns: [services.id],
			name: "quote_services_service_id_fkey"
		}).onDelete("cascade"),
	unique("quote_services_quote_id_service_id_key").on(table.quote_id, table.service_id),
	check("quote_services_quantity_check", sql`quantity > 0`),
	check("quote_services_unit_price_check", sql`unit_price >= (0)::numeric`),
]);

export const quote_status_history = pgTable("quote_status_history", {
	id: uuid().defaultRandom().primaryKey().notNull(),
	quote_id: uuid().notNull(),
	old_status: text(),
	new_status: text().notNull(),
	changed_by: uuid().notNull(),
	changed_at: timestamp({ withTimezone: true, mode: 'string' }).defaultNow().notNull(),
	notes: text(),
}, (table) => [
	foreignKey({
			columns: [table.changed_by],
			foreignColumns: [users.id],
			name: "quote_status_history_changed_by_fkey"
		}),
	foreignKey({
			columns: [table.quote_id],
			foreignColumns: [quotes.id],
			name: "quote_status_history_quote_id_fkey"
		}).onDelete("cascade"),
]);

export const quote_template_services = pgTable("quote_template_services", {
	id: uuid().defaultRandom().primaryKey().notNull(),
	template_id: uuid().notNull(),
	service_id: uuid().notNull(),
	quantity: integer().default(1).notNull(),
	unit_price: numeric().notNull(),
	created_at: timestamp({ withTimezone: true, mode: 'string' }).defaultNow().notNull(),
}, (table) => [
	foreignKey({
			columns: [table.service_id],
			foreignColumns: [services.id],
			name: "quote_template_services_service_id_fkey"
		}).onDelete("cascade"),
	foreignKey({
			columns: [table.template_id],
			foreignColumns: [quote_templates.id],
			name: "quote_template_services_template_id_fkey"
		}).onDelete("cascade"),
]);

export const quote_templates = pgTable("quote_templates", {
	id: uuid().defaultRandom().primaryKey().notNull(),
	owner_user_id: uuid().notNull(),
	name: text().notNull(),
	event_type: text().notNull(),
	guest_count: integer().notNull(),
	remarks: text(),
	created_at: timestamp({ withTimezone: true, mode: 'string' }).defaultNow().notNull(),
	updated_at: timestamp({ withTimezone: true, mode: 'string' }).defaultNow().notNull(),
	user_id: uuid(),
	base_template: text().default('standard').notNull(),
	accent_color: text().default('#9c27b0').notNull(),
	header_note: text(),
	footer_note: text(),
	is_default: boolean().default(false).notNull(),
	primary_color: varchar({ length: 20 }).default('#9c27b0'),
	font_family: varchar({ length: 100 }).default('Georgia'),
	layout_type: varchar({ length: 50 }).default('standard'),
}, (table) => [
	foreignKey({
			columns: [table.user_id],
			foreignColumns: [users.id],
			name: "quote_templates_user_id_fkey"
		}),
]);

export const rental_items = pgTable("rental_items", {
	id: uuid().defaultRandom().primaryKey().notNull(),
	quote_id: uuid().notNull(),
	material_name: text().notNull(),
	qty: numeric().default('1'),
	unit: text(),
	supplier_id: uuid(),
	price_per_unit: numeric().default('0'),
	notes: text(),
	created_at: timestamp({ withTimezone: true, mode: 'string' }).defaultNow(),
	source: text().default('manual'),
	ordered: boolean().default(false),
	confirmed_individually: boolean().default(false),
	confirmed_at: timestamp({ withTimezone: true, mode: 'string' }),
}, (table) => [
	foreignKey({
			columns: [table.quote_id],
			foreignColumns: [quotes.id],
			name: "rental_items_quote_id_fkey"
		}).onDelete("cascade"),
	foreignKey({
			columns: [table.supplier_id],
			foreignColumns: [suppliers.id],
			name: "rental_items_supplier_id_fkey"
		}).onDelete("set null"),
]);

export const service_ingredients = pgTable("service_ingredients", {
	id: uuid().defaultRandom().primaryKey().notNull(),
	user_id: uuid().notNull(),
	service_id: uuid().notNull(),
	ingredient_id: uuid().notNull(),
	qty_per_person: numeric().default('1').notNull(),
	unit: text(),
	created_at: timestamp({ withTimezone: true, mode: 'string' }).defaultNow(),
	quantity_per_guest: numeric().default('0'),
}, (table) => [
	foreignKey({
			columns: [table.ingredient_id],
			foreignColumns: [ingredients.id],
			name: "service_ingredients_ingredient_id_fkey"
		}).onDelete("cascade"),
	foreignKey({
			columns: [table.service_id],
			foreignColumns: [prestations.id],
			name: "service_ingredients_service_id_fkey"
		}).onDelete("cascade"),
	foreignKey({
			columns: [table.user_id],
			foreignColumns: [users.id],
			name: "service_ingredients_user_id_fkey"
		}).onDelete("cascade"),
	unique("service_ingredients_service_id_ingredient_id_key").on(table.ingredient_id, table.service_id),
]);

// Modèles de location : quantité de matériel par convive, utilisés pour générer la location d'un événement.
// Modèles de location : un traiteur en a plusieurs (dîner assis, cocktail, séminaire…), chacun avec ses articles.
export const rental_template_sets = pgTable("rental_template_sets", {
	id: uuid().defaultRandom().primaryKey().notNull(),
	user_id: uuid().notNull(),
	name: text().notNull(),
	created_at: timestamp({ withTimezone: true, mode: 'string' }).defaultNow().notNull(),
}, (table) => [
	index("idx_rental_template_sets_user_id").using("btree", table.user_id.asc().nullsLast().op("uuid_ops")),
	foreignKey({
			columns: [table.user_id],
			foreignColumns: [users.id],
			name: "rental_template_sets_user_id_fkey"
		}).onDelete("cascade"),
]);

// Articles d'un modèle de location, avec leur quantité par couvert.
export const rental_templates = pgTable("rental_templates", {
	id: uuid().defaultRandom().primaryKey().notNull(),
	user_id: uuid().notNull(),
	set_id: uuid(),
	material_name: text().notNull(),
	qty_per_guest: numeric().default('1').notNull(),
	unit: text(),
	default_supplier_id: uuid(),
	default_price_per_unit: numeric().default('0').notNull(),
	sort_order: integer().default(0).notNull(),
	created_at: timestamp({ withTimezone: true, mode: 'string' }).defaultNow().notNull(),
}, (table) => [
	foreignKey({
			columns: [table.user_id],
			foreignColumns: [users.id],
			name: "rental_templates_user_id_fkey"
		}).onDelete("cascade"),
	foreignKey({
			columns: [table.default_supplier_id],
			foreignColumns: [suppliers.id],
			name: "rental_templates_default_supplier_id_fkey"
		}).onDelete("set null"),
	foreignKey({
			columns: [table.set_id],
			foreignColumns: [rental_template_sets.id],
			name: "rental_templates_set_id_fkey"
		}).onDelete("cascade"),
	index("idx_rental_templates_set_id").using("btree", table.set_id.asc().nullsLast().op("uuid_ops")),
]);

export const service_materials = pgTable("service_materials", {
	id: uuid().defaultRandom().primaryKey().notNull(),
	user_id: uuid().notNull(),
	service_name: text().notNull(),
	material_name: text().notNull(),
	qty_per_unit: numeric().default('1').notNull(),
	multiply_by: text().default('guest').notNull(),
	unit: text().default('unité'),
	created_at: timestamp({ withTimezone: true, mode: 'string' }).defaultNow(),
}, (table) => [
	foreignKey({
			columns: [table.user_id],
			foreignColumns: [users.id],
			name: "service_materials_user_id_fkey"
		}),
]);

export const service_categories = pgTable("service_categories", {
	id: uuid().defaultRandom().primaryKey().notNull(),
	owner_user_id: uuid().notNull(),
	name: text().notNull(),
	description: text(),
	created_at: timestamp({ withTimezone: true, mode: 'string' }).defaultNow().notNull(),
	updated_at: timestamp({ withTimezone: true, mode: 'string' }).defaultNow().notNull(),
});

export const software_updates = pgTable("software_updates", {
	id: uuid().defaultRandom().primaryKey().notNull(),
	title: text().notNull(),
	version: text().notNull(),
	content: text().notNull(),
	published_at: timestamp({ withTimezone: true, mode: 'string' }).defaultNow().notNull(),
	created_by: uuid(),
	created_at: timestamp({ withTimezone: true, mode: 'string' }).defaultNow().notNull(),
}, (table) => [
	index("idx_software_updates_published_at").using("btree", table.published_at.desc().nullsFirst().op("timestamptz_ops")),
	foreignKey({
			columns: [table.created_by],
			foreignColumns: [users.id],
			name: "software_updates_created_by_fkey"
		}),
	unique("software_updates_version_key").on(table.version),
]);

export const stock_movements = pgTable("stock_movements", {
	id: uuid().defaultRandom().primaryKey().notNull(),
	user_id: uuid().notNull(),
	ingredient_id: uuid().notNull(),
	movement_type: text().notNull(),
	quantity: numeric().notNull(),
	reason: text(),
	event_id: uuid(),
	order_id: uuid(),
	created_at: timestamp({ withTimezone: true, mode: 'string' }).defaultNow(),
}, (table) => [
	index("idx_stock_movements_event").using("btree", table.event_id.asc().nullsLast().op("uuid_ops")),
	index("idx_stock_movements_ingredient").using("btree", table.ingredient_id.asc().nullsLast().op("uuid_ops")),
	index("idx_stock_movements_user").using("btree", table.user_id.asc().nullsLast().op("uuid_ops")),
	foreignKey({
			columns: [table.event_id],
			foreignColumns: [quotes.id],
			name: "stock_movements_event_id_fkey"
		}).onDelete("set null"),
	foreignKey({
			columns: [table.ingredient_id],
			foreignColumns: [ingredients.id],
			name: "stock_movements_ingredient_id_fkey"
		}).onDelete("cascade"),
	foreignKey({
			columns: [table.user_id],
			foreignColumns: [users.id],
			name: "stock_movements_user_id_fkey"
		}).onDelete("cascade"),
	check("stock_movements_movement_type_check", sql`movement_type = ANY (ARRAY['in'::text, 'out'::text, 'adjust'::text])`),
]);

export const supplier_order_items = pgTable("supplier_order_items", {
	id: uuid().defaultRandom().primaryKey().notNull(),
	order_id: uuid().notNull(),
	ingredient_id: uuid().notNull(),
	quantity: numeric().notNull(),
	unit_price: numeric().default('0'),
	received_quantity: numeric().default('0'),
	created_at: timestamp({ withTimezone: true, mode: 'string' }).defaultNow(),
}, (table) => [
	index("idx_supplier_order_items_ingredient").using("btree", table.ingredient_id.asc().nullsLast().op("uuid_ops")),
	index("idx_supplier_order_items_order").using("btree", table.order_id.asc().nullsLast().op("uuid_ops")),
	foreignKey({
			columns: [table.ingredient_id],
			foreignColumns: [ingredients.id],
			name: "supplier_order_items_ingredient_id_fkey"
		}).onDelete("cascade"),
	foreignKey({
			columns: [table.order_id],
			foreignColumns: [supplier_orders.id],
			name: "supplier_order_items_order_id_fkey"
		}).onDelete("cascade"),
]);

export const supplier_orders = pgTable("supplier_orders", {
	id: uuid().defaultRandom().primaryKey().notNull(),
	user_id: uuid().notNull(),
	supplier_id: uuid().notNull(),
	event_id: uuid(),
	status: text().default('draft').notNull(),
	total_amount: numeric().default('0'),
	notes: text(),
	ordered_at: timestamp({ withTimezone: true, mode: 'string' }),
	received_at: timestamp({ withTimezone: true, mode: 'string' }),
	created_at: timestamp({ withTimezone: true, mode: 'string' }).defaultNow(),
	updated_at: timestamp({ withTimezone: true, mode: 'string' }).defaultNow(),
}, (table) => [
	index("idx_supplier_orders_event").using("btree", table.event_id.asc().nullsLast().op("uuid_ops")),
	index("idx_supplier_orders_supplier").using("btree", table.supplier_id.asc().nullsLast().op("uuid_ops")),
	index("idx_supplier_orders_user").using("btree", table.user_id.asc().nullsLast().op("uuid_ops")),
	foreignKey({
			columns: [table.event_id],
			foreignColumns: [quotes.id],
			name: "supplier_orders_event_id_fkey"
		}).onDelete("set null"),
	foreignKey({
			columns: [table.supplier_id],
			foreignColumns: [suppliers.id],
			name: "supplier_orders_supplier_id_fkey"
		}).onDelete("cascade"),
	foreignKey({
			columns: [table.user_id],
			foreignColumns: [users.id],
			name: "supplier_orders_user_id_fkey"
		}).onDelete("cascade"),
	check("supplier_orders_status_check", sql`status = ANY (ARRAY['draft'::text, 'sent'::text, 'received'::text, 'cancelled'::text])`),
]);

export const support_ticket_messages = pgTable("support_ticket_messages", {
	id: uuid().defaultRandom().primaryKey().notNull(),
	ticket_id: uuid().notNull(),
	user_id: uuid().notNull(),
	message: text().notNull(),
	is_admin_message: boolean().default(false).notNull(),
	created_at: timestamp({ withTimezone: true, mode: 'string' }).defaultNow().notNull(),
}, (table) => [
	foreignKey({
			columns: [table.ticket_id],
			foreignColumns: [support_tickets.id],
			name: "support_ticket_messages_ticket_id_fkey"
		}).onDelete("cascade"),
	foreignKey({
			columns: [table.user_id],
			foreignColumns: [profiles.id],
			name: "support_ticket_messages_user_id_fkey"
		}).onDelete("cascade"),
]);

export const support_ticket_attachments = pgTable("support_ticket_attachments", {
	id: uuid().defaultRandom().primaryKey().notNull(),
	ticket_id: uuid().notNull(),
	message_id: uuid(),
	file_path: text().notNull(),
	file_name: text().notNull(),
	mime_type: text(),
	file_size: integer(),
	uploaded_by: uuid().notNull(),
	created_at: timestamp({ withTimezone: true, mode: 'string' }).defaultNow().notNull(),
}, (table) => [
	foreignKey({
			columns: [table.message_id],
			foreignColumns: [support_ticket_messages.id],
			name: "support_ticket_attachments_message_id_fkey"
		}).onDelete("cascade"),
	foreignKey({
			columns: [table.ticket_id],
			foreignColumns: [support_tickets.id],
			name: "support_ticket_attachments_ticket_id_fkey"
		}).onDelete("cascade"),
	foreignKey({
			columns: [table.uploaded_by],
			foreignColumns: [profiles.id],
			name: "support_ticket_attachments_uploaded_by_fkey"
		}).onDelete("cascade"),
]);

export const support_tickets = pgTable("support_tickets", {
	id: uuid().defaultRandom().primaryKey().notNull(),
	user_id: uuid().notNull(),
	ticket_type: support_ticket_type().notNull(),
	subject: text().notNull(),
	description: text().notNull(),
	status: support_ticket_status().default('Ouvert').notNull(),
	created_at: timestamp({ withTimezone: true, mode: 'string' }).defaultNow().notNull(),
	updated_at: timestamp({ withTimezone: true, mode: 'string' }).defaultNow().notNull(),
}, (table) => [
	foreignKey({
			columns: [table.user_id],
			foreignColumns: [profiles.id],
			name: "support_tickets_user_id_fkey"
		}).onDelete("cascade"),
]);

export const task_templates = pgTable("task_templates", {
	id: uuid().defaultRandom().primaryKey().notNull(),
	owner_user_id: uuid().notNull(),
	name: text().notNull(),
	created_at: timestamp({ withTimezone: true, mode: 'string' }).defaultNow().notNull(),
	updated_at: timestamp({ withTimezone: true, mode: 'string' }).defaultNow().notNull(),
});

export const task_template_items = pgTable("task_template_items", {
	id: uuid().defaultRandom().primaryKey().notNull(),
	template_id: uuid().notNull(),
	name: text().notNull(),
	sort_order: integer().default(0).notNull(),
	created_at: timestamp({ withTimezone: true, mode: 'string' }).defaultNow().notNull(),
}, (table) => [
	foreignKey({
			columns: [table.template_id],
			foreignColumns: [task_templates.id],
			name: "task_template_items_template_id_fkey"
		}).onDelete("cascade"),
]);

export const user_library_photos = pgTable("user_library_photos", {
	id: uuid().defaultRandom().primaryKey().notNull(),
	user_id: uuid().notNull(),
	file_name: text().notNull(),
	file_path: text().notNull(),
	file_url: text().notNull(),
	custom_name: text().notNull(),
	category: text().notNull(),
	created_at: timestamp({ withTimezone: true, mode: 'string' }).defaultNow().notNull(),
	updated_at: timestamp({ withTimezone: true, mode: 'string' }).defaultNow().notNull(),
}, (table) => [
	foreignKey({
			columns: [table.user_id],
			foreignColumns: [users.id],
			name: "user_library_photos_user_id_fkey"
		}).onDelete("cascade"),
]);

export const user_photo_categories = pgTable("user_photo_categories", {
	id: uuid().defaultRandom().primaryKey().notNull(),
	user_id: uuid().notNull(),
	name: text().notNull(),
	created_at: timestamp({ withTimezone: true, mode: 'string' }).defaultNow().notNull(),
}, (table) => [
	foreignKey({
			columns: [table.user_id],
			foreignColumns: [users.id],
			name: "user_photo_categories_user_id_fkey"
		}).onDelete("cascade"),
	unique("user_photo_categories_user_id_name_key").on(table.name, table.user_id),
]);

// Demandes envoyées depuis le site de présentation : devis pour le logiciel, simple message,
// ou coordonnées laissées pour essayer la démonstration.
export const site_requests = pgTable("site_requests", {
	id: uuid().defaultRandom().primaryKey().notNull(),
	kind: text().notNull(),
	name: text().notNull(),
	email: text().notNull(),
	phone: text(),
	company: text(),
	// Taille de l'équipe, telle que choisie dans le formulaire (demande de devis).
	team_size: text(),
	message: text().notNull(),
	status: text().default('nouvelle').notNull(),
	admin_notes: text(),
	// Empreinte de l'adresse IP, pour limiter les envois en rafale ; l'adresse elle-même n'est pas gardée.
	ip_hash: text(),
	created_at: timestamp({ withTimezone: true, mode: 'string' }).defaultNow().notNull(),
	handled_at: timestamp({ withTimezone: true, mode: 'string' }),
}, (table) => [
	index("idx_site_requests_created_at").using("btree", table.created_at.desc().nullsFirst()),
	check("site_requests_kind_check", sql`kind = ANY (ARRAY['devis'::text, 'message'::text, 'demo'::text])`),
	check("site_requests_status_check", sql`status = ANY (ARRAY['nouvelle'::text, 'en_cours'::text, 'traitee'::text])`),
]);

// Réglages de la plateforme, modifiables depuis l'espace d'administration (une ligne par réglage).
export const app_settings = pgTable("app_settings", {
	key: text().primaryKey().notNull(),
	value: jsonb().notNull(),
	updated_at: timestamp({ withTimezone: true, mode: 'string' }).defaultNow().notNull(),
});

// Liste de matériel du traiteur (ce qu'il possède et emporte) : sert à remplir « À préparer » d'un événement
// sans tout retaper. La quantité est fixe, ou calculée par couvert.
export const material_presets = pgTable("material_presets", {
	id: uuid().defaultRandom().primaryKey().notNull(),
	user_id: uuid().notNull(),
	name: text().notNull(),
	unit: text(),
	default_qty: numeric().default('1').notNull(),
	// Renseigné : la quantité proposée est ce nombre × le nombre de couverts, arrondi à l'unité supérieure.
	qty_per_guest: numeric(),
	created_at: timestamp({ withTimezone: true, mode: 'string' }).defaultNow().notNull(),
}, (table) => [
	index("idx_material_presets_user_id").using("btree", table.user_id.asc().nullsLast().op("uuid_ops")),
	foreignKey({
			columns: [table.user_id],
			foreignColumns: [users.id],
			name: "material_presets_user_id_fkey"
		}).onDelete("cascade"),
]);

// Modèles de matériel : ce qu'on emporte pour un type de réception (cocktail, dîner assis…). Dans un événement,
// on applique un modèle à « À préparer ». Distincts de material_presets (la liste de ce que le traiteur possède).
export const material_template_sets = pgTable("material_template_sets", {
	id: uuid().defaultRandom().primaryKey().notNull(),
	user_id: uuid().notNull(),
	name: text().notNull(),
	sort_order: integer().default(0).notNull(),
	created_at: timestamp({ withTimezone: true, mode: 'string' }).defaultNow().notNull(),
}, (table) => [
	index("idx_material_template_sets_user_id").using("btree", table.user_id.asc().nullsLast().op("uuid_ops")),
	foreignKey({
			columns: [table.user_id],
			foreignColumns: [users.id],
			name: "material_template_sets_user_id_fkey"
		}).onDelete("cascade"),
]);

// Articles d'un modèle de matériel : quantité fixe (default_qty), ou par couvert quand qty_per_guest est renseigné.
export const material_templates = pgTable("material_templates", {
	id: uuid().defaultRandom().primaryKey().notNull(),
	set_id: uuid().notNull(),
	user_id: uuid().notNull(),
	name: text().notNull(),
	unit: text(),
	default_qty: numeric().default('1').notNull(),
	qty_per_guest: numeric(),
	sort_order: integer().default(0).notNull(),
	created_at: timestamp({ withTimezone: true, mode: 'string' }).defaultNow().notNull(),
}, (table) => [
	index("idx_material_templates_set_id").using("btree", table.set_id.asc().nullsLast().op("uuid_ops")),
	index("idx_material_templates_user_id").using("btree", table.user_id.asc().nullsLast().op("uuid_ops")),
	foreignKey({
			columns: [table.set_id],
			foreignColumns: [material_template_sets.id],
			name: "material_templates_set_id_fkey"
		}).onDelete("cascade"),
	foreignKey({
			columns: [table.user_id],
			foreignColumns: [users.id],
			name: "material_templates_user_id_fkey"
		}).onDelete("cascade"),
]);

// Abonnements aux notifications push d'un appareil : celui d'un compte (traiteur) ou celui d'un extra (page de missions).
export const push_subscriptions = pgTable("push_subscriptions", {
	id: uuid().defaultRandom().primaryKey().notNull(),
	endpoint: text().notNull(),
	p256dh: text().notNull(),
	auth: text().notNull(),
	user_id: uuid(),
	extra_id: uuid(),
	created_at: timestamp({ withTimezone: true, mode: 'string' }).defaultNow().notNull(),
}, (table) => [
	uniqueIndex("push_subscriptions_endpoint_key").using("btree", table.endpoint.asc().nullsLast().op("text_ops")),
	foreignKey({ columns: [table.user_id], foreignColumns: [users.id], name: "push_subscriptions_user_id_fkey" }).onDelete("cascade"),
	foreignKey({ columns: [table.extra_id], foreignColumns: [extras.id], name: "push_subscriptions_extra_id_fkey" }).onDelete("cascade"),
	check("push_subscriptions_owner_check", sql`(user_id IS NOT NULL) <> (extra_id IS NOT NULL)`),
]);
