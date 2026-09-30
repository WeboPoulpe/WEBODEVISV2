import { relations } from "drizzle-orm/relations";
import { users, password_reset_tokens, collaborators, briefing_tokens, quotes, customers, quote_folders, customer_contacts, demo_sessions, demo_quotes, demo_quote_services, demo_services, devis_templates, event_attachments, event_attachment_visibility, extras, event_extras, ingredients, suppliers, event_ingredients, event_personal_materials, personal_materials, event_tasks, event_team_assignments, invitation_links, invoices, invoice_services, invoice_status_history, prestation_categories, prestation_subcategories, prestations, profiles, user_prospect_tokens, prospect_requests, purchase_orders, purchase_order_items, services, service_categories, quote_photos, quote_services, quote_status_history, quote_template_services, quote_templates, rental_items, service_ingredients, service_materials, software_updates, stock_movements, supplier_order_items, supplier_orders, support_tickets, support_ticket_messages, support_ticket_attachments, task_templates, task_template_items, user_library_photos, user_photo_categories } from "./tables";

export const password_reset_tokensRelations = relations(password_reset_tokens, ({one}) => ({
	user: one(users, {
		fields: [password_reset_tokens.user_id],
		references: [users.id]
	}),
}));

export const usersRelations = relations(users, ({many}) => ({
	password_reset_tokens: many(password_reset_tokens),
	collaborators: many(collaborators),
	quotes_owner_user_id: many(quotes, {
		relationName: "quotes_owner_user_id_users_id"
	}),
	quotes_user_id: many(quotes, {
		relationName: "quotes_user_id_users_id"
	}),
	customers_owner_user_id: many(customers, {
		relationName: "customers_owner_user_id_users_id"
	}),
	customers_user_id: many(customers, {
		relationName: "customers_user_id_users_id"
	}),
	devis_templates: many(devis_templates),
	event_attachments: many(event_attachments),
	extras: many(extras),
	ingredients_owner_user_id: many(ingredients, {
		relationName: "ingredients_owner_user_id_users_id"
	}),
	ingredients_user_id: many(ingredients, {
		relationName: "ingredients_user_id_users_id"
	}),
	suppliers: many(suppliers),
	event_tasks: many(event_tasks),
	event_team_assignments: many(event_team_assignments),
	invitation_links_created_by: many(invitation_links, {
		relationName: "invitation_links_created_by_users_id"
	}),
	invitation_links_used_by: many(invitation_links, {
		relationName: "invitation_links_used_by_users_id"
	}),
	prestation_categories: many(prestation_categories),
	prestation_subcategories: many(prestation_subcategories),
	prestations: many(prestations),
	profiles: many(profiles),
	services: many(services),
	quote_status_histories: many(quote_status_history),
	quote_templates: many(quote_templates),
	service_ingredients: many(service_ingredients),
	service_materials: many(service_materials),
	software_updates: many(software_updates),
	stock_movements: many(stock_movements),
	supplier_orders: many(supplier_orders),
	user_library_photos: many(user_library_photos),
	user_photo_categories: many(user_photo_categories),
}));

export const collaboratorsRelations = relations(collaborators, ({one, many}) => ({
	user: one(users, {
		fields: [collaborators.owner_user_id],
		references: [users.id]
	}),
	briefing_tokens: many(briefing_tokens),
	event_attachment_visibilities: many(event_attachment_visibility),
	event_personal_materials: many(event_personal_materials),
	event_tasks: many(event_tasks),
	event_team_assignments: many(event_team_assignments),
	purchase_orders: many(purchase_orders),
}));

export const briefing_tokensRelations = relations(briefing_tokens, ({one}) => ({
	collaborator: one(collaborators, {
		fields: [briefing_tokens.collaborator_id],
		references: [collaborators.id]
	}),
	quote: one(quotes, {
		fields: [briefing_tokens.quote_id],
		references: [quotes.id]
	}),
}));

export const quotesRelations = relations(quotes, ({one, many}) => ({
	briefing_tokens: many(briefing_tokens),
	customer: one(customers, {
		fields: [quotes.customer_id],
		references: [customers.id]
	}),
	quote_folder: one(quote_folders, {
		fields: [quotes.folder_id],
		references: [quote_folders.id]
	}),
	user_owner_user_id: one(users, {
		fields: [quotes.owner_user_id],
		references: [users.id],
		relationName: "quotes_owner_user_id_users_id"
	}),
	user_user_id: one(users, {
		fields: [quotes.user_id],
		references: [users.id],
		relationName: "quotes_user_id_users_id"
	}),
	event_attachments: many(event_attachments),
	event_extras: many(event_extras),
	event_ingredients: many(event_ingredients),
	event_personal_materials: many(event_personal_materials),
	event_tasks: many(event_tasks),
	event_team_assignments: many(event_team_assignments),
	invoices: many(invoices),
	purchase_orders: many(purchase_orders),
	quote_photos: many(quote_photos),
	quote_services: many(quote_services),
	quote_status_histories: many(quote_status_history),
	rental_items: many(rental_items),
	stock_movements: many(stock_movements),
	supplier_orders: many(supplier_orders),
}));

export const customersRelations = relations(customers, ({one, many}) => ({
	quotes: many(quotes),
	user_owner_user_id: one(users, {
		fields: [customers.owner_user_id],
		references: [users.id],
		relationName: "customers_owner_user_id_users_id"
	}),
	user_user_id: one(users, {
		fields: [customers.user_id],
		references: [users.id],
		relationName: "customers_user_id_users_id"
	}),
	customer_contacts: many(customer_contacts),
}));

export const quote_foldersRelations = relations(quote_folders, ({one, many}) => ({
	quotes: many(quotes),
	quote_folder: one(quote_folders, {
		fields: [quote_folders.parent_id],
		references: [quote_folders.id],
		relationName: "quote_folders_parent_id_quote_folders_id"
	}),
	quote_folders: many(quote_folders, {
		relationName: "quote_folders_parent_id_quote_folders_id"
	}),
}));

export const customer_contactsRelations = relations(customer_contacts, ({one}) => ({
	customer: one(customers, {
		fields: [customer_contacts.customer_id],
		references: [customers.id]
	}),
}));

export const demo_quotesRelations = relations(demo_quotes, ({one, many}) => ({
	demo_session: one(demo_sessions, {
		fields: [demo_quotes.session_id],
		references: [demo_sessions.session_id]
	}),
	demo_quote_services: many(demo_quote_services),
}));

export const demo_sessionsRelations = relations(demo_sessions, ({many}) => ({
	demo_quotes: many(demo_quotes),
	demo_services: many(demo_services),
}));

export const demo_quote_servicesRelations = relations(demo_quote_services, ({one}) => ({
	demo_quote: one(demo_quotes, {
		fields: [demo_quote_services.quote_id],
		references: [demo_quotes.id]
	}),
	demo_service: one(demo_services, {
		fields: [demo_quote_services.service_id],
		references: [demo_services.id]
	}),
}));

export const demo_servicesRelations = relations(demo_services, ({one, many}) => ({
	demo_quote_services: many(demo_quote_services),
	demo_session: one(demo_sessions, {
		fields: [demo_services.session_id],
		references: [demo_sessions.session_id]
	}),
}));

export const devis_templatesRelations = relations(devis_templates, ({one}) => ({
	user: one(users, {
		fields: [devis_templates.user_id],
		references: [users.id]
	}),
}));

export const event_attachmentsRelations = relations(event_attachments, ({one, many}) => ({
	quote: one(quotes, {
		fields: [event_attachments.quote_id],
		references: [quotes.id]
	}),
	user: one(users, {
		fields: [event_attachments.uploaded_by],
		references: [users.id]
	}),
	event_attachment_visibilities: many(event_attachment_visibility),
}));

export const event_attachment_visibilityRelations = relations(event_attachment_visibility, ({one}) => ({
	event_attachment: one(event_attachments, {
		fields: [event_attachment_visibility.attachment_id],
		references: [event_attachments.id]
	}),
	collaborator: one(collaborators, {
		fields: [event_attachment_visibility.collaborator_id],
		references: [collaborators.id]
	}),
}));

export const extrasRelations = relations(extras, ({one, many}) => ({
	user: one(users, {
		fields: [extras.user_id],
		references: [users.id]
	}),
	event_extras: many(event_extras),
}));

export const event_extrasRelations = relations(event_extras, ({one}) => ({
	extra: one(extras, {
		fields: [event_extras.extra_id],
		references: [extras.id]
	}),
	quote: one(quotes, {
		fields: [event_extras.quote_id],
		references: [quotes.id]
	}),
}));

export const ingredientsRelations = relations(ingredients, ({one, many}) => ({
	user_owner_user_id: one(users, {
		fields: [ingredients.owner_user_id],
		references: [users.id],
		relationName: "ingredients_owner_user_id_users_id"
	}),
	supplier: one(suppliers, {
		fields: [ingredients.preferred_supplier_id],
		references: [suppliers.id]
	}),
	user_user_id: one(users, {
		fields: [ingredients.user_id],
		references: [users.id],
		relationName: "ingredients_user_id_users_id"
	}),
	event_ingredients: many(event_ingredients),
	service_ingredients: many(service_ingredients),
	stock_movements: many(stock_movements),
	supplier_order_items: many(supplier_order_items),
}));

export const suppliersRelations = relations(suppliers, ({one, many}) => ({
	ingredients: many(ingredients),
	event_ingredients: many(event_ingredients),
	user: one(users, {
		fields: [suppliers.user_id],
		references: [users.id]
	}),
	purchase_orders: many(purchase_orders),
	services: many(services),
	rental_items: many(rental_items),
	supplier_orders: many(supplier_orders),
}));

export const event_ingredientsRelations = relations(event_ingredients, ({one}) => ({
	ingredient: one(ingredients, {
		fields: [event_ingredients.ingredient_id],
		references: [ingredients.id]
	}),
	quote: one(quotes, {
		fields: [event_ingredients.quote_id],
		references: [quotes.id]
	}),
	supplier: one(suppliers, {
		fields: [event_ingredients.supplier_id],
		references: [suppliers.id]
	}),
}));

export const event_personal_materialsRelations = relations(event_personal_materials, ({one}) => ({
	collaborator: one(collaborators, {
		fields: [event_personal_materials.assigned_to],
		references: [collaborators.id]
	}),
	personal_material: one(personal_materials, {
		fields: [event_personal_materials.personal_material_id],
		references: [personal_materials.id]
	}),
	quote: one(quotes, {
		fields: [event_personal_materials.quote_id],
		references: [quotes.id]
	}),
}));

export const personal_materialsRelations = relations(personal_materials, ({many}) => ({
	event_personal_materials: many(event_personal_materials),
}));

export const event_tasksRelations = relations(event_tasks, ({one}) => ({
	collaborator: one(collaborators, {
		fields: [event_tasks.assigned_to],
		references: [collaborators.id]
	}),
	user: one(users, {
		fields: [event_tasks.created_by],
		references: [users.id]
	}),
	quote: one(quotes, {
		fields: [event_tasks.quote_id],
		references: [quotes.id]
	}),
}));

export const event_team_assignmentsRelations = relations(event_team_assignments, ({one}) => ({
	collaborator: one(collaborators, {
		fields: [event_team_assignments.collaborator_id],
		references: [collaborators.id]
	}),
	user: one(users, {
		fields: [event_team_assignments.created_by],
		references: [users.id]
	}),
	quote: one(quotes, {
		fields: [event_team_assignments.quote_id],
		references: [quotes.id]
	}),
}));

export const invitation_linksRelations = relations(invitation_links, ({one}) => ({
	user_created_by: one(users, {
		fields: [invitation_links.created_by],
		references: [users.id],
		relationName: "invitation_links_created_by_users_id"
	}),
	user_used_by: one(users, {
		fields: [invitation_links.used_by],
		references: [users.id],
		relationName: "invitation_links_used_by_users_id"
	}),
}));

export const invoicesRelations = relations(invoices, ({one, many}) => ({
	quote: one(quotes, {
		fields: [invoices.quote_id],
		references: [quotes.id]
	}),
	invoice_services: many(invoice_services),
	invoice_status_histories_invoice_id: many(invoice_status_history, {
		relationName: "invoice_status_history_invoice_id_invoices_id"
	}),
}));

export const invoice_servicesRelations = relations(invoice_services, ({one}) => ({
	invoice: one(invoices, {
		fields: [invoice_services.invoice_id],
		references: [invoices.id]
	}),
}));

export const invoice_status_historyRelations = relations(invoice_status_history, ({one}) => ({
	invoice_invoice_id: one(invoices, {
		fields: [invoice_status_history.invoice_id],
		references: [invoices.id],
		relationName: "invoice_status_history_invoice_id_invoices_id"
	}),
}));

export const prestation_categoriesRelations = relations(prestation_categories, ({one, many}) => ({
	user: one(users, {
		fields: [prestation_categories.user_id],
		references: [users.id]
	}),
	prestation_subcategories: many(prestation_subcategories),
	prestations: many(prestations),
}));

export const prestation_subcategoriesRelations = relations(prestation_subcategories, ({one, many}) => ({
	prestation_category: one(prestation_categories, {
		fields: [prestation_subcategories.category_id],
		references: [prestation_categories.id]
	}),
	user: one(users, {
		fields: [prestation_subcategories.user_id],
		references: [users.id]
	}),
	prestations: many(prestations),
}));

export const prestationsRelations = relations(prestations, ({one}) => ({
	prestation_category: one(prestation_categories, {
		fields: [prestations.category_id],
		references: [prestation_categories.id]
	}),
	prestation_subcategory: one(prestation_subcategories, {
		fields: [prestations.sub_category_id],
		references: [prestation_subcategories.id]
	}),
	user: one(users, {
		fields: [prestations.user_id],
		references: [users.id]
	}),
}));

export const profilesRelations = relations(profiles, ({one, many}) => ({
	user: one(users, {
		fields: [profiles.id],
		references: [users.id]
	}),
	profile: one(profiles, {
		fields: [profiles.parent_user_id],
		references: [profiles.id],
		relationName: "profiles_parent_user_id_profiles_id"
	}),
	profiles: many(profiles, {
		relationName: "profiles_parent_user_id_profiles_id"
	}),
	support_ticket_messages: many(support_ticket_messages),
	support_ticket_attachments: many(support_ticket_attachments),
	support_tickets: many(support_tickets),
}));

export const prospect_requestsRelations = relations(prospect_requests, ({one}) => ({
	user_prospect_token: one(user_prospect_tokens, {
		fields: [prospect_requests.user_token],
		references: [user_prospect_tokens.token]
	}),
}));

export const user_prospect_tokensRelations = relations(user_prospect_tokens, ({many}) => ({
	prospect_requests: many(prospect_requests),
}));

export const purchase_ordersRelations = relations(purchase_orders, ({one, many}) => ({
	collaborator: one(collaborators, {
		fields: [purchase_orders.assigned_to],
		references: [collaborators.id]
	}),
	quote: one(quotes, {
		fields: [purchase_orders.quote_id],
		references: [quotes.id]
	}),
	supplier: one(suppliers, {
		fields: [purchase_orders.supplier_id],
		references: [suppliers.id]
	}),
	purchase_order_items: many(purchase_order_items),
}));

export const purchase_order_itemsRelations = relations(purchase_order_items, ({one}) => ({
	purchase_order: one(purchase_orders, {
		fields: [purchase_order_items.purchase_order_id],
		references: [purchase_orders.id]
	}),
	service: one(services, {
		fields: [purchase_order_items.service_id],
		references: [services.id]
	}),
}));

export const servicesRelations = relations(services, ({one, many}) => ({
	purchase_order_items: many(purchase_order_items),
	service_category: one(service_categories, {
		fields: [services.category_id],
		references: [service_categories.id]
	}),
	service: one(services, {
		fields: [services.parent_service_id],
		references: [services.id],
		relationName: "services_parent_service_id_services_id"
	}),
	services: many(services, {
		relationName: "services_parent_service_id_services_id"
	}),
	supplier: one(suppliers, {
		fields: [services.supplier_id],
		references: [suppliers.id]
	}),
	user: one(users, {
		fields: [services.owner_user_id],
		references: [users.id]
	}),
	quote_services: many(quote_services),
	quote_template_services: many(quote_template_services),
	service_ingredients: many(service_ingredients),
}));

export const service_categoriesRelations = relations(service_categories, ({many}) => ({
	services: many(services),
}));

export const quote_photosRelations = relations(quote_photos, ({one}) => ({
	quote: one(quotes, {
		fields: [quote_photos.quote_id],
		references: [quotes.id]
	}),
}));

export const quote_servicesRelations = relations(quote_services, ({one}) => ({
	quote: one(quotes, {
		fields: [quote_services.quote_id],
		references: [quotes.id]
	}),
	service: one(services, {
		fields: [quote_services.service_id],
		references: [services.id]
	}),
}));

export const quote_status_historyRelations = relations(quote_status_history, ({one}) => ({
	user: one(users, {
		fields: [quote_status_history.changed_by],
		references: [users.id]
	}),
	quote: one(quotes, {
		fields: [quote_status_history.quote_id],
		references: [quotes.id]
	}),
}));

export const quote_template_servicesRelations = relations(quote_template_services, ({one}) => ({
	service: one(services, {
		fields: [quote_template_services.service_id],
		references: [services.id]
	}),
	quote_template: one(quote_templates, {
		fields: [quote_template_services.template_id],
		references: [quote_templates.id]
	}),
}));

export const quote_templatesRelations = relations(quote_templates, ({one, many}) => ({
	quote_template_services: many(quote_template_services),
	user: one(users, {
		fields: [quote_templates.user_id],
		references: [users.id]
	}),
}));

export const rental_itemsRelations = relations(rental_items, ({one}) => ({
	quote: one(quotes, {
		fields: [rental_items.quote_id],
		references: [quotes.id]
	}),
	supplier: one(suppliers, {
		fields: [rental_items.supplier_id],
		references: [suppliers.id]
	}),
}));

export const service_ingredientsRelations = relations(service_ingredients, ({one}) => ({
	ingredient: one(ingredients, {
		fields: [service_ingredients.ingredient_id],
		references: [ingredients.id]
	}),
	service: one(services, {
		fields: [service_ingredients.service_id],
		references: [services.id]
	}),
	user: one(users, {
		fields: [service_ingredients.user_id],
		references: [users.id]
	}),
}));

export const service_materialsRelations = relations(service_materials, ({one}) => ({
	user: one(users, {
		fields: [service_materials.user_id],
		references: [users.id]
	}),
}));

export const software_updatesRelations = relations(software_updates, ({one}) => ({
	user: one(users, {
		fields: [software_updates.created_by],
		references: [users.id]
	}),
}));

export const stock_movementsRelations = relations(stock_movements, ({one}) => ({
	quote: one(quotes, {
		fields: [stock_movements.event_id],
		references: [quotes.id]
	}),
	ingredient: one(ingredients, {
		fields: [stock_movements.ingredient_id],
		references: [ingredients.id]
	}),
	user: one(users, {
		fields: [stock_movements.user_id],
		references: [users.id]
	}),
}));

export const supplier_order_itemsRelations = relations(supplier_order_items, ({one}) => ({
	ingredient: one(ingredients, {
		fields: [supplier_order_items.ingredient_id],
		references: [ingredients.id]
	}),
	supplier_order: one(supplier_orders, {
		fields: [supplier_order_items.order_id],
		references: [supplier_orders.id]
	}),
}));

export const supplier_ordersRelations = relations(supplier_orders, ({one, many}) => ({
	supplier_order_items: many(supplier_order_items),
	quote: one(quotes, {
		fields: [supplier_orders.event_id],
		references: [quotes.id]
	}),
	supplier: one(suppliers, {
		fields: [supplier_orders.supplier_id],
		references: [suppliers.id]
	}),
	user: one(users, {
		fields: [supplier_orders.user_id],
		references: [users.id]
	}),
}));

export const support_ticket_messagesRelations = relations(support_ticket_messages, ({one, many}) => ({
	support_ticket: one(support_tickets, {
		fields: [support_ticket_messages.ticket_id],
		references: [support_tickets.id]
	}),
	profile: one(profiles, {
		fields: [support_ticket_messages.user_id],
		references: [profiles.id]
	}),
	support_ticket_attachments: many(support_ticket_attachments),
}));

export const support_ticketsRelations = relations(support_tickets, ({one, many}) => ({
	support_ticket_messages: many(support_ticket_messages),
	support_ticket_attachments: many(support_ticket_attachments),
	profile: one(profiles, {
		fields: [support_tickets.user_id],
		references: [profiles.id]
	}),
}));

export const support_ticket_attachmentsRelations = relations(support_ticket_attachments, ({one}) => ({
	support_ticket_message: one(support_ticket_messages, {
		fields: [support_ticket_attachments.message_id],
		references: [support_ticket_messages.id]
	}),
	support_ticket: one(support_tickets, {
		fields: [support_ticket_attachments.ticket_id],
		references: [support_tickets.id]
	}),
	profile: one(profiles, {
		fields: [support_ticket_attachments.uploaded_by],
		references: [profiles.id]
	}),
}));

export const task_template_itemsRelations = relations(task_template_items, ({one}) => ({
	task_template: one(task_templates, {
		fields: [task_template_items.template_id],
		references: [task_templates.id]
	}),
}));

export const task_templatesRelations = relations(task_templates, ({many}) => ({
	task_template_items: many(task_template_items),
}));

export const user_library_photosRelations = relations(user_library_photos, ({one}) => ({
	user: one(users, {
		fields: [user_library_photos.user_id],
		references: [users.id]
	}),
}));

export const user_photo_categoriesRelations = relations(user_photo_categories, ({one}) => ({
	user: one(users, {
		fields: [user_photo_categories.user_id],
		references: [users.id]
	}),
}));