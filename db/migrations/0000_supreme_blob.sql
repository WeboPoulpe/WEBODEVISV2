-- Current sql file was generated after introspecting the database
-- If you want to run this migration please uncomment this code before executing migrations
/*
CREATE TYPE "public"."customer_type" AS ENUM('particulier', 'entreprise');--> statement-breakpoint
CREATE TYPE "public"."subscription_type" AS ENUM('free', 'premium', 'entreprise');--> statement-breakpoint
CREATE TYPE "public"."support_ticket_status" AS ENUM('Ouvert', 'En cours', 'En attente de réponse', 'Résolu', 'Fermé');--> statement-breakpoint
CREATE TYPE "public"."support_ticket_type" AS ENUM('Bug technique', 'Question fonctionnelle', 'Suggestion d''amélioration', 'Problème de facturation', 'Autre');--> statement-breakpoint
CREATE TYPE "public"."user_role" AS ENUM('admin', 'user');--> statement-breakpoint
CREATE TABLE "collaborator_roles" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"owner_user_id" uuid NOT NULL,
	"name" text NOT NULL,
	"description" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "users" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"email" text NOT NULL,
	"password_hash" text NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "users_email_key" UNIQUE("email")
);
--> statement-breakpoint
CREATE TABLE "password_reset_tokens" (
	"token_hash" text PRIMARY KEY NOT NULL,
	"user_id" uuid NOT NULL,
	"expires_at" timestamp with time zone NOT NULL,
	"used_at" timestamp with time zone
);
--> statement-breakpoint
CREATE TABLE "material_categories" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"owner_user_id" uuid NOT NULL,
	"name" text NOT NULL,
	"description" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "notifications" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" uuid NOT NULL,
	"title" text NOT NULL,
	"message" text NOT NULL,
	"type" text NOT NULL,
	"priority" text DEFAULT 'medium' NOT NULL,
	"is_read" boolean DEFAULT false NOT NULL,
	"data" jsonb,
	"action_url" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"read_at" timestamp with time zone,
	"expires_at" timestamp with time zone,
	CONSTRAINT "notifications_priority_check" CHECK (priority = ANY (ARRAY['low'::text, 'medium'::text, 'high'::text])),
	CONSTRAINT "notifications_type_check" CHECK (type = ANY (ARRAY['prospect_request'::text, 'upcoming_event'::text, 'invoice_due'::text, 'support_ticket'::text, 'system_update'::text, 'task_reminder'::text, 'stock_alert'::text]))
);
--> statement-breakpoint
CREATE TABLE "collaborators" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"owner_user_id" uuid NOT NULL,
	"first_name" text NOT NULL,
	"last_name" text NOT NULL,
	"email" text NOT NULL,
	"role" text,
	"phone" text,
	"notes" text,
	"is_active" boolean DEFAULT true NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "collaborators_user_id_email_key" UNIQUE("email","owner_user_id")
);
--> statement-breakpoint
CREATE TABLE "briefing_tokens" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"quote_id" uuid NOT NULL,
	"collaborator_id" uuid NOT NULL,
	"token" uuid DEFAULT gen_random_uuid() NOT NULL,
	"expires_at" timestamp with time zone NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "briefing_tokens_quote_id_collaborator_id_key" UNIQUE("collaborator_id","quote_id"),
	CONSTRAINT "briefing_tokens_token_key" UNIQUE("token")
);
--> statement-breakpoint
CREATE TABLE "quotes" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"owner_user_id" uuid NOT NULL,
	"client_name" text NOT NULL,
	"event_date" date NOT NULL,
	"event_type" text NOT NULL,
	"guest_count" integer NOT NULL,
	"remarks" text,
	"total_amount" numeric(10, 2) DEFAULT '0',
	"status" text DEFAULT 'draft' NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	"internal_notes" text,
	"customer_id" uuid,
	"name" text,
	"is_archived" boolean DEFAULT false,
	"total_cost_price" numeric DEFAULT '0',
	"event_status" text DEFAULT 'en_cours',
	"team_arrival_time" time,
	"event_location" text,
	"quote_number" text,
	"edited_client_name" text,
	"edited_event_type" text,
	"edited_event_location" text,
	"edited_remarks" text,
	"edited_services_intro" text,
	"edited_services_details" text,
	"edited_conditions" text,
	"checklist" jsonb DEFAULT '[]'::jsonb,
	"images" jsonb DEFAULT '[]'::jsonb,
	"template" text DEFAULT 'standard',
	"services" jsonb DEFAULT '[]'::jsonb,
	"client_first_name" text,
	"client_last_name" text,
	"client_email" text,
	"client_phone" text,
	"client_address" text,
	"client_type" text DEFAULT 'particulier',
	"company_name" text,
	"contact_person_name" text,
	"vat_rate" numeric DEFAULT '20',
	"hide_price" boolean DEFAULT false,
	"user_id" uuid,
	"content_html" text,
	"event_materials" jsonb DEFAULT '[]'::jsonb,
	"selected_font" varchar(100) DEFAULT 'Georgia',
	"selected_font_size" integer,
	"language" text DEFAULT 'fr',
	"imported" boolean DEFAULT false,
	"imported_file_url" text,
	"imported_file_name" text,
	"guest_count_adults" integer,
	"guest_count_children" integer,
	"cover_page_config" jsonb,
	"photos_page_config" jsonb,
	"prospect_id" text,
	"extra_costs" jsonb DEFAULT '[]'::jsonb,
	"client_siret" text,
	"recipient_contact_email" text,
	"recipient_contact_phone" text,
	"recipient_contact_role" text,
	"recipient_contact_id" text,
	"internal_name" text,
	"folder_id" uuid,
	CONSTRAINT "quotes_guest_count_check" CHECK (guest_count > 0),
	CONSTRAINT "quotes_status_check" CHECK (status = ANY (ARRAY['nouveau'::text, 'broch_envoyee'::text, 'devis_a_faire'::text, 'devis_envoye'::text, 'rdv_deg_a_venir'::text, 'rdv_deg_fait'::text, 'devis_final'::text, 'valide'::text, 'acompte'::text, 'paye'::text, 'refus_client'::text, 'refus_traiteur'::text]))
);
--> statement-breakpoint
CREATE TABLE "customers" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"customer_type" "customer_type" NOT NULL,
	"email" text NOT NULL,
	"phone" text,
	"address" text,
	"service_address" text,
	"notes" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	"first_name" text,
	"last_name" text,
	"company_name" text,
	"siret_number" text,
	"contact_person_name" text,
	"contact_person_email" text,
	"contact_person_phone" text,
	"owner_user_id" uuid NOT NULL,
	"user_id" uuid,
	CONSTRAINT "check_entreprise_fields" CHECK (((customer_type = 'entreprise'::customer_type) AND (company_name IS NOT NULL) AND (contact_person_name IS NOT NULL)) OR (customer_type <> 'entreprise'::customer_type)),
	CONSTRAINT "check_particulier_fields" CHECK (((customer_type = 'particulier'::customer_type) AND (first_name IS NOT NULL) AND (last_name IS NOT NULL)) OR (customer_type <> 'particulier'::customer_type))
);
--> statement-breakpoint
CREATE TABLE "customer_contacts" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"customer_id" uuid NOT NULL,
	"owner_user_id" uuid NOT NULL,
	"name" text NOT NULL,
	"role" text,
	"email" text,
	"phone" text,
	"notes" text,
	"is_primary" boolean DEFAULT false NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "demo_quotes" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"session_id" text,
	"client_name" text NOT NULL,
	"event_date" date NOT NULL,
	"event_type" text NOT NULL,
	"guest_count" integer NOT NULL,
	"total_amount" numeric DEFAULT '0',
	"status" text DEFAULT 'draft',
	"remarks" text,
	"name" text,
	"created_at" timestamp with time zone DEFAULT now(),
	"total_cost_price" numeric DEFAULT '0'
);
--> statement-breakpoint
CREATE TABLE "demo_quote_services" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"quote_id" uuid,
	"service_id" uuid,
	"quantity" integer DEFAULT 1,
	"unit_price" numeric NOT NULL,
	"is_option" boolean DEFAULT false,
	"is_free" boolean DEFAULT false,
	"sort_order" integer DEFAULT 0,
	"cost_price" numeric DEFAULT '0'
);
--> statement-breakpoint
CREATE TABLE "demo_services" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"session_id" text,
	"name" text NOT NULL,
	"description" text,
	"price" numeric NOT NULL,
	"is_variable_price" boolean DEFAULT false,
	"created_at" timestamp with time zone DEFAULT now(),
	"cost_price" numeric DEFAULT '0'
);
--> statement-breakpoint
CREATE TABLE "demo_sessions" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"session_id" text NOT NULL,
	"created_at" timestamp with time zone DEFAULT now(),
	"expires_at" timestamp with time zone DEFAULT (now() + '01:00:00'::interval),
	CONSTRAINT "demo_sessions_session_id_key" UNIQUE("session_id")
);
--> statement-breakpoint
CREATE TABLE "devis_templates" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" uuid NOT NULL,
	"name" text NOT NULL,
	"services" jsonb DEFAULT '[]'::jsonb,
	"content_html" text,
	"template" text DEFAULT 'standard',
	"selected_font" text,
	"selected_font_size" integer DEFAULT 12,
	"remarks" text,
	"vat_rate" numeric DEFAULT '20',
	"hide_price" boolean DEFAULT false,
	"created_at" timestamp with time zone DEFAULT now(),
	"updated_at" timestamp with time zone DEFAULT now()
);
--> statement-breakpoint
CREATE TABLE "event_attachments" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"quote_id" uuid NOT NULL,
	"file_name" text NOT NULL,
	"file_path" text NOT NULL,
	"file_size" integer,
	"mime_type" text,
	"uploaded_by" uuid NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"visibility_type" text DEFAULT 'all',
	"visible_to_collaborators" uuid[] DEFAULT '{""}',
	CONSTRAINT "event_attachments_visibility_type_check" CHECK (visibility_type = ANY (ARRAY['all'::text, 'specific'::text]))
);
--> statement-breakpoint
CREATE TABLE "event_attachment_visibility" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"attachment_id" uuid NOT NULL,
	"collaborator_id" uuid NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "event_attachment_visibility_attachment_id_collaborator_id_key" UNIQUE("attachment_id","collaborator_id")
);
--> statement-breakpoint
CREATE TABLE "extras" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" uuid NOT NULL,
	"name" text NOT NULL,
	"phone" text,
	"email" text,
	"role" text,
	"access_token" text DEFAULT encode(gen_random_bytes(16), 'hex'::text),
	"created_at" timestamp with time zone DEFAULT now(),
	CONSTRAINT "extras_access_token_key" UNIQUE("access_token")
);
--> statement-breakpoint
CREATE TABLE "event_extras" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"quote_id" uuid NOT NULL,
	"extra_id" uuid NOT NULL,
	"status" text DEFAULT 'a_solliciter' NOT NULL,
	"arrival_time" text,
	"mission_notes" text,
	"assign_courses" boolean DEFAULT false NOT NULL,
	"created_at" timestamp with time zone DEFAULT now(),
	CONSTRAINT "event_extras_quote_id_extra_id_key" UNIQUE("extra_id","quote_id")
);
--> statement-breakpoint
CREATE TABLE "ingredients" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"owner_user_id" uuid,
	"name" text NOT NULL,
	"category" text,
	"unit" text DEFAULT 'Unité',
	"image_url" text,
	"off_product_id" text,
	"created_at" timestamp with time zone DEFAULT now(),
	"sub_category" text,
	"user_id" uuid,
	"stock_quantity" numeric DEFAULT '0',
	"min_stock_alert" numeric DEFAULT '0',
	"volume_unit_price" numeric DEFAULT '0',
	"preferred_supplier_id" uuid
);
--> statement-breakpoint
CREATE TABLE "event_ingredients" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"quote_id" uuid NOT NULL,
	"ingredient_id" uuid NOT NULL,
	"quantity" numeric DEFAULT '1' NOT NULL,
	"unit" text,
	"supplier_id" uuid,
	"notes" text,
	"checked" boolean DEFAULT false NOT NULL,
	"created_at" timestamp with time zone DEFAULT now()
);
--> statement-breakpoint
CREATE TABLE "suppliers" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"owner_user_id" uuid NOT NULL,
	"name" text NOT NULL,
	"contact_person" text,
	"email" text,
	"phone" text,
	"address" text,
	"notes" text,
	"is_active" boolean DEFAULT true NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	"user_id" uuid
);
--> statement-breakpoint
CREATE TABLE "event_personal_materials" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"quote_id" uuid NOT NULL,
	"personal_material_id" uuid NOT NULL,
	"allocated_quantity" integer DEFAULT 0 NOT NULL,
	"notes" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	"assigned_to" uuid,
	CONSTRAINT "event_personal_materials_quote_id_personal_material_id_key" UNIQUE("personal_material_id","quote_id")
);
--> statement-breakpoint
CREATE TABLE "personal_materials" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"owner_user_id" uuid NOT NULL,
	"name" text NOT NULL,
	"description" text,
	"total_quantity" integer DEFAULT 0 NOT NULL,
	"category" text,
	"notes" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "event_tasks" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"quote_id" uuid NOT NULL,
	"name" text NOT NULL,
	"assigned_to" uuid,
	"status" text DEFAULT 'a_faire' NOT NULL,
	"created_by" uuid NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	"sort_order" integer DEFAULT 0 NOT NULL,
	CONSTRAINT "event_tasks_status_check" CHECK (status = ANY (ARRAY['a_faire'::text, 'fait'::text]))
);
--> statement-breakpoint
CREATE TABLE "event_team_assignments" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"quote_id" uuid NOT NULL,
	"collaborator_id" uuid NOT NULL,
	"assigned_at" timestamp with time zone DEFAULT now() NOT NULL,
	"created_by" uuid NOT NULL,
	CONSTRAINT "event_team_assignments_quote_id_collaborator_id_key" UNIQUE("collaborator_id","quote_id")
);
--> statement-breakpoint
CREATE TABLE "invitation_links" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"token" text NOT NULL,
	"created_by" uuid NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"expires_at" timestamp with time zone DEFAULT (now() + '7 days'::interval) NOT NULL,
	"used_at" timestamp with time zone,
	"used_by" uuid,
	"is_active" boolean DEFAULT true NOT NULL,
	"max_uses" integer DEFAULT 1 NOT NULL,
	"current_uses" integer DEFAULT 0 NOT NULL,
	CONSTRAINT "invitation_links_token_key" UNIQUE("token")
);
--> statement-breakpoint
CREATE TABLE "invoices" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"quote_id" uuid NOT NULL,
	"invoice_number" text NOT NULL,
	"owner_user_id" uuid NOT NULL,
	"client_name" text NOT NULL,
	"total_amount" numeric NOT NULL,
	"status" text DEFAULT 'pending' NOT NULL,
	"invoice_date" date DEFAULT CURRENT_DATE NOT NULL,
	"due_date" date DEFAULT (CURRENT_DATE + '30 days'::interval) NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "invoices_invoice_number_key" UNIQUE("invoice_number")
);
--> statement-breakpoint
CREATE TABLE "invoice_services" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"invoice_id" uuid NOT NULL,
	"service_name" text NOT NULL,
	"quantity" integer DEFAULT 1 NOT NULL,
	"unit_price" numeric NOT NULL,
	"description" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "invoice_status_history" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"invoice_id" uuid NOT NULL,
	"old_status" text,
	"new_status" text NOT NULL,
	"changed_at" timestamp with time zone DEFAULT now() NOT NULL,
	"changed_by" uuid NOT NULL,
	"notes" text
);
--> statement-breakpoint
CREATE TABLE "prestation_categories" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" uuid,
	"name" text NOT NULL,
	"icon" text,
	"sort_order" integer DEFAULT 0,
	"created_at" timestamp with time zone DEFAULT now()
);
--> statement-breakpoint
CREATE TABLE "prestation_subcategories" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"category_id" uuid NOT NULL,
	"user_id" uuid,
	"name" text NOT NULL,
	"sort_order" integer DEFAULT 0,
	"created_at" timestamp with time zone DEFAULT now()
);
--> statement-breakpoint
CREATE TABLE "prestations" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" uuid NOT NULL,
	"name" text NOT NULL,
	"unit_price" numeric DEFAULT '0' NOT NULL,
	"category" text,
	"description" text,
	"created_at" timestamp with time zone DEFAULT now(),
	"sub_category" text,
	"is_option" boolean DEFAULT false,
	"cost_price" numeric DEFAULT '0',
	"gastro_card_html" text,
	"gastro_card_html_en" text,
	"category_id" uuid,
	"sub_category_id" uuid,
	"child_unit_price" numeric,
	"photo_url" text
);
--> statement-breakpoint
CREATE TABLE "profiles" (
	"id" uuid PRIMARY KEY NOT NULL,
	"email" text NOT NULL,
	"first_name" text,
	"last_name" text,
	"role" "user_role" DEFAULT 'user' NOT NULL,
	"is_active" boolean DEFAULT true NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	"subscription_type" text DEFAULT 'free',
	"company_name" text,
	"company_siret" text,
	"company_address" text,
	"company_phone" text,
	"company_email" text,
	"company_logo_url" text,
	"company_cgv" text,
	"company_website" text,
	"completed_tutorial_pages" jsonb DEFAULT '[]'::jsonb,
	"pdf_main_color" text DEFAULT '#2563eb',
	"pdf_table_header_color" text DEFAULT '#2563eb',
	"pdf_option_text_color" text DEFAULT '#f97316',
	"pdf_free_text_color" text DEFAULT '#22c55e',
	"pdf_total_color" text DEFAULT '#2563eb',
	"pdf_hide_prices" boolean DEFAULT false,
	"pdf_hide_descriptions_page" boolean DEFAULT false,
	"quotes_count" integer DEFAULT 0,
	"company_bank_name" text,
	"company_iban" text,
	"company_bic" text,
	"company_bank_account_holder" text,
	"preferred_payment_method" text DEFAULT 'virement',
	"custom_vat_rate" numeric DEFAULT '20',
	"parent_user_id" uuid,
	"subscription_plan" text DEFAULT 'free' NOT NULL,
	"max_linked_users" integer DEFAULT 1 NOT NULL,
	"can_view_all_company_data" boolean DEFAULT false NOT NULL,
	"pdf_font_size_client_name" integer DEFAULT 16,
	"pdf_font_size_event_type" integer DEFAULT 16,
	"pdf_font_size_event_location" integer DEFAULT 16,
	"pdf_font_size_remarks" integer DEFAULT 14,
	"pdf_font_size_services_intro" integer DEFAULT 14,
	"pdf_font_size_services_details" integer DEFAULT 14,
	"pdf_font_size_conditions" integer DEFAULT 12,
	"has_completed_onboarding" boolean DEFAULT false,
	"default_vat_rate" integer DEFAULT 20,
	"cgv" text,
	"siret" text,
	"logo_url" text,
	CONSTRAINT "profiles_custom_vat_rate_check" CHECK ((custom_vat_rate >= (0)::numeric) AND (custom_vat_rate <= (100)::numeric)),
	CONSTRAINT "profiles_subscription_type_check" CHECK (subscription_type = ANY (ARRAY['free'::text, 'premium'::text]))
);
--> statement-breakpoint
CREATE TABLE "user_prospect_tokens" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" uuid NOT NULL,
	"token" text NOT NULL,
	"is_active" boolean DEFAULT true NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	"brochure_url" text,
	CONSTRAINT "user_prospect_tokens_token_key" UNIQUE("token")
);
--> statement-breakpoint
CREATE TABLE "prospect_requests" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"first_name" text NOT NULL,
	"last_name" text NOT NULL,
	"email" text NOT NULL,
	"phone" text,
	"address" text,
	"service_address" text,
	"guest_count" integer,
	"event_type" text,
	"event_date" date,
	"message" text,
	"status" text DEFAULT 'nouveau' NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	"owner_user_id" uuid,
	"user_token" text,
	"guest_count_children" integer,
	CONSTRAINT "prospect_requests_status_check" CHECK (status = ANY (ARRAY['nouveau'::text, 'broch_envoyee'::text, 'devis_a_faire'::text, 'devis_envoye'::text, 'rdv_deg_a_venir'::text, 'rdv_deg_fait'::text, 'devis_final'::text, 'valide'::text, 'acompte'::text, 'paye'::text, 'refus_client'::text, 'refus_traiteur'::text]))
);
--> statement-breakpoint
CREATE TABLE "purchase_orders" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"owner_user_id" uuid NOT NULL,
	"quote_id" uuid NOT NULL,
	"supplier_id" uuid,
	"po_number" text NOT NULL,
	"status" text DEFAULT 'draft' NOT NULL,
	"order_date" date DEFAULT CURRENT_DATE NOT NULL,
	"expected_delivery_date" date,
	"assigned_to" uuid,
	"notes" text,
	"total_amount" numeric DEFAULT '0' NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	"attach_pdf_to_briefing" boolean DEFAULT false NOT NULL
);
--> statement-breakpoint
CREATE TABLE "purchase_order_items" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"purchase_order_id" uuid NOT NULL,
	"service_id" uuid,
	"item_name" text NOT NULL,
	"description" text,
	"quantity" integer DEFAULT 1 NOT NULL,
	"unit_price" numeric DEFAULT '0' NOT NULL,
	"notes" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "services" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"owner_user_id" uuid NOT NULL,
	"name" text NOT NULL,
	"description" text,
	"price" numeric(10, 2) NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	"is_variable_price" boolean DEFAULT false NOT NULL,
	"cost_price" numeric DEFAULT '0',
	"category_id" uuid,
	"supplier_id" uuid,
	"parent_service_id" uuid,
	"internal_note" text,
	CONSTRAINT "services_price_check" CHECK (price >= (0)::numeric)
);
--> statement-breakpoint
CREATE TABLE "quote_folders" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"owner_user_id" uuid NOT NULL,
	"parent_id" uuid,
	"name" text NOT NULL,
	"color" text DEFAULT 'purple' NOT NULL,
	"icon" text DEFAULT 'folder' NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "quote_photos" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" uuid NOT NULL,
	"quote_id" uuid,
	"file_name" text NOT NULL,
	"file_path" text NOT NULL,
	"file_url" text NOT NULL,
	"caption" text,
	"sort_order" integer DEFAULT 0 NOT NULL,
	"is_base_photo" boolean DEFAULT false NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "quote_services" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"quote_id" uuid NOT NULL,
	"service_id" uuid NOT NULL,
	"quantity" integer DEFAULT 1 NOT NULL,
	"unit_price" numeric(10, 2) NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"sort_order" integer DEFAULT 0,
	"is_option" boolean DEFAULT false,
	"is_free" boolean DEFAULT false,
	"cost_price" numeric DEFAULT '0',
	"custom_name" text,
	"custom_description" text,
	CONSTRAINT "quote_services_quote_id_service_id_key" UNIQUE("quote_id","service_id"),
	CONSTRAINT "quote_services_quantity_check" CHECK (quantity > 0),
	CONSTRAINT "quote_services_unit_price_check" CHECK (unit_price >= (0)::numeric)
);
--> statement-breakpoint
CREATE TABLE "quote_status_history" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"quote_id" uuid NOT NULL,
	"old_status" text,
	"new_status" text NOT NULL,
	"changed_by" uuid NOT NULL,
	"changed_at" timestamp with time zone DEFAULT now() NOT NULL,
	"notes" text
);
--> statement-breakpoint
CREATE TABLE "quote_template_services" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"template_id" uuid NOT NULL,
	"service_id" uuid NOT NULL,
	"quantity" integer DEFAULT 1 NOT NULL,
	"unit_price" numeric NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "quote_templates" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"owner_user_id" uuid NOT NULL,
	"name" text NOT NULL,
	"event_type" text NOT NULL,
	"guest_count" integer NOT NULL,
	"remarks" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	"user_id" uuid,
	"base_template" text DEFAULT 'standard' NOT NULL,
	"accent_color" text DEFAULT '#9c27b0' NOT NULL,
	"header_note" text,
	"footer_note" text,
	"is_default" boolean DEFAULT false NOT NULL,
	"primary_color" varchar(20) DEFAULT '#9c27b0',
	"font_family" varchar(100) DEFAULT 'Georgia',
	"layout_type" varchar(50) DEFAULT 'standard'
);
--> statement-breakpoint
CREATE TABLE "rental_items" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"quote_id" uuid NOT NULL,
	"material_name" text NOT NULL,
	"qty" numeric DEFAULT '1',
	"unit" text,
	"supplier_id" uuid,
	"price_per_unit" numeric DEFAULT '0',
	"notes" text,
	"created_at" timestamp with time zone DEFAULT now(),
	"source" text DEFAULT 'manual',
	"ordered" boolean DEFAULT false
);
--> statement-breakpoint
CREATE TABLE "service_ingredients" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" uuid NOT NULL,
	"service_id" uuid NOT NULL,
	"ingredient_id" uuid NOT NULL,
	"qty_per_person" numeric DEFAULT '1' NOT NULL,
	"unit" text,
	"created_at" timestamp with time zone DEFAULT now(),
	"quantity_per_guest" numeric DEFAULT '0',
	CONSTRAINT "service_ingredients_service_id_ingredient_id_key" UNIQUE("ingredient_id","service_id")
);
--> statement-breakpoint
CREATE TABLE "service_materials" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" uuid NOT NULL,
	"service_name" text NOT NULL,
	"material_name" text NOT NULL,
	"qty_per_unit" numeric DEFAULT '1' NOT NULL,
	"multiply_by" text DEFAULT 'guest' NOT NULL,
	"unit" text DEFAULT 'unité',
	"created_at" timestamp with time zone DEFAULT now()
);
--> statement-breakpoint
CREATE TABLE "service_categories" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"owner_user_id" uuid NOT NULL,
	"name" text NOT NULL,
	"description" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "software_updates" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"title" text NOT NULL,
	"version" text NOT NULL,
	"content" text NOT NULL,
	"published_at" timestamp with time zone DEFAULT now() NOT NULL,
	"created_by" uuid,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "software_updates_version_key" UNIQUE("version")
);
--> statement-breakpoint
CREATE TABLE "stock_movements" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" uuid NOT NULL,
	"ingredient_id" uuid NOT NULL,
	"movement_type" text NOT NULL,
	"quantity" numeric NOT NULL,
	"reason" text,
	"event_id" uuid,
	"order_id" uuid,
	"created_at" timestamp with time zone DEFAULT now(),
	CONSTRAINT "stock_movements_movement_type_check" CHECK (movement_type = ANY (ARRAY['in'::text, 'out'::text, 'adjust'::text]))
);
--> statement-breakpoint
CREATE TABLE "supplier_order_items" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"order_id" uuid NOT NULL,
	"ingredient_id" uuid NOT NULL,
	"quantity" numeric NOT NULL,
	"unit_price" numeric DEFAULT '0',
	"received_quantity" numeric DEFAULT '0',
	"created_at" timestamp with time zone DEFAULT now()
);
--> statement-breakpoint
CREATE TABLE "supplier_orders" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" uuid NOT NULL,
	"supplier_id" uuid NOT NULL,
	"event_id" uuid,
	"status" text DEFAULT 'draft' NOT NULL,
	"total_amount" numeric DEFAULT '0',
	"notes" text,
	"ordered_at" timestamp with time zone,
	"received_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now(),
	"updated_at" timestamp with time zone DEFAULT now(),
	CONSTRAINT "supplier_orders_status_check" CHECK (status = ANY (ARRAY['draft'::text, 'sent'::text, 'received'::text, 'cancelled'::text]))
);
--> statement-breakpoint
CREATE TABLE "support_ticket_messages" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"ticket_id" uuid NOT NULL,
	"user_id" uuid NOT NULL,
	"message" text NOT NULL,
	"is_admin_message" boolean DEFAULT false NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "support_ticket_attachments" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"ticket_id" uuid NOT NULL,
	"message_id" uuid,
	"file_path" text NOT NULL,
	"file_name" text NOT NULL,
	"mime_type" text,
	"file_size" integer,
	"uploaded_by" uuid NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "support_tickets" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" uuid NOT NULL,
	"ticket_type" "support_ticket_type" NOT NULL,
	"subject" text NOT NULL,
	"description" text NOT NULL,
	"status" "support_ticket_status" DEFAULT 'Ouvert' NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "task_templates" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"owner_user_id" uuid NOT NULL,
	"name" text NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "task_template_items" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"template_id" uuid NOT NULL,
	"name" text NOT NULL,
	"sort_order" integer DEFAULT 0 NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "user_library_photos" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" uuid NOT NULL,
	"file_name" text NOT NULL,
	"file_path" text NOT NULL,
	"file_url" text NOT NULL,
	"custom_name" text NOT NULL,
	"category" text NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "user_photo_categories" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" uuid NOT NULL,
	"name" text NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "user_photo_categories_user_id_name_key" UNIQUE("name","user_id")
);
--> statement-breakpoint
ALTER TABLE "password_reset_tokens" ADD CONSTRAINT "password_reset_tokens_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "collaborators" ADD CONSTRAINT "collaborators_user_id_fkey" FOREIGN KEY ("owner_user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "briefing_tokens" ADD CONSTRAINT "briefing_tokens_collaborator_id_fkey" FOREIGN KEY ("collaborator_id") REFERENCES "public"."collaborators"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "briefing_tokens" ADD CONSTRAINT "briefing_tokens_quote_id_fkey" FOREIGN KEY ("quote_id") REFERENCES "public"."quotes"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "quotes" ADD CONSTRAINT "quotes_customer_id_fkey" FOREIGN KEY ("customer_id") REFERENCES "public"."customers"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "quotes" ADD CONSTRAINT "quotes_folder_id_fkey" FOREIGN KEY ("folder_id") REFERENCES "public"."quote_folders"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "quotes" ADD CONSTRAINT "quotes_user_id_fkey" FOREIGN KEY ("owner_user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "quotes" ADD CONSTRAINT "quotes_user_id_fkey1" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "customers" ADD CONSTRAINT "customers_user_id_fkey" FOREIGN KEY ("owner_user_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "customers" ADD CONSTRAINT "customers_user_id_fkey1" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "customer_contacts" ADD CONSTRAINT "customer_contacts_customer_id_fkey" FOREIGN KEY ("customer_id") REFERENCES "public"."customers"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "demo_quotes" ADD CONSTRAINT "demo_quotes_session_id_fkey" FOREIGN KEY ("session_id") REFERENCES "public"."demo_sessions"("session_id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "demo_quote_services" ADD CONSTRAINT "demo_quote_services_quote_id_fkey" FOREIGN KEY ("quote_id") REFERENCES "public"."demo_quotes"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "demo_quote_services" ADD CONSTRAINT "demo_quote_services_service_id_fkey" FOREIGN KEY ("service_id") REFERENCES "public"."demo_services"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "demo_services" ADD CONSTRAINT "demo_services_session_id_fkey" FOREIGN KEY ("session_id") REFERENCES "public"."demo_sessions"("session_id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "devis_templates" ADD CONSTRAINT "devis_templates_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "event_attachments" ADD CONSTRAINT "event_attachments_quote_id_fkey" FOREIGN KEY ("quote_id") REFERENCES "public"."quotes"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "event_attachments" ADD CONSTRAINT "event_attachments_uploaded_by_fkey" FOREIGN KEY ("uploaded_by") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "event_attachment_visibility" ADD CONSTRAINT "event_attachment_visibility_attachment_id_fkey" FOREIGN KEY ("attachment_id") REFERENCES "public"."event_attachments"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "event_attachment_visibility" ADD CONSTRAINT "event_attachment_visibility_collaborator_id_fkey" FOREIGN KEY ("collaborator_id") REFERENCES "public"."collaborators"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "extras" ADD CONSTRAINT "extras_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "event_extras" ADD CONSTRAINT "event_extras_extra_id_fkey" FOREIGN KEY ("extra_id") REFERENCES "public"."extras"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "event_extras" ADD CONSTRAINT "event_extras_quote_id_fkey" FOREIGN KEY ("quote_id") REFERENCES "public"."quotes"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "ingredients" ADD CONSTRAINT "ingredients_owner_user_id_fkey" FOREIGN KEY ("owner_user_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "ingredients" ADD CONSTRAINT "ingredients_preferred_supplier_id_fkey" FOREIGN KEY ("preferred_supplier_id") REFERENCES "public"."suppliers"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "ingredients" ADD CONSTRAINT "ingredients_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "event_ingredients" ADD CONSTRAINT "event_ingredients_ingredient_id_fkey" FOREIGN KEY ("ingredient_id") REFERENCES "public"."ingredients"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "event_ingredients" ADD CONSTRAINT "event_ingredients_quote_id_fkey" FOREIGN KEY ("quote_id") REFERENCES "public"."quotes"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "event_ingredients" ADD CONSTRAINT "event_ingredients_supplier_id_fkey" FOREIGN KEY ("supplier_id") REFERENCES "public"."suppliers"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "suppliers" ADD CONSTRAINT "suppliers_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "event_personal_materials" ADD CONSTRAINT "event_personal_materials_assigned_to_fkey" FOREIGN KEY ("assigned_to") REFERENCES "public"."collaborators"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "event_personal_materials" ADD CONSTRAINT "event_personal_materials_personal_material_id_fkey" FOREIGN KEY ("personal_material_id") REFERENCES "public"."personal_materials"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "event_personal_materials" ADD CONSTRAINT "event_personal_materials_quote_id_fkey" FOREIGN KEY ("quote_id") REFERENCES "public"."quotes"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "event_tasks" ADD CONSTRAINT "event_tasks_assigned_to_fkey" FOREIGN KEY ("assigned_to") REFERENCES "public"."collaborators"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "event_tasks" ADD CONSTRAINT "event_tasks_created_by_fkey" FOREIGN KEY ("created_by") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "event_tasks" ADD CONSTRAINT "event_tasks_quote_id_fkey" FOREIGN KEY ("quote_id") REFERENCES "public"."quotes"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "event_team_assignments" ADD CONSTRAINT "event_team_assignments_collaborator_id_fkey" FOREIGN KEY ("collaborator_id") REFERENCES "public"."collaborators"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "event_team_assignments" ADD CONSTRAINT "event_team_assignments_created_by_fkey" FOREIGN KEY ("created_by") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "event_team_assignments" ADD CONSTRAINT "event_team_assignments_quote_id_fkey" FOREIGN KEY ("quote_id") REFERENCES "public"."quotes"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "invitation_links" ADD CONSTRAINT "invitation_links_created_by_fkey" FOREIGN KEY ("created_by") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "invitation_links" ADD CONSTRAINT "invitation_links_used_by_fkey" FOREIGN KEY ("used_by") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "invoices" ADD CONSTRAINT "invoices_quote_id_fkey" FOREIGN KEY ("quote_id") REFERENCES "public"."quotes"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "invoice_services" ADD CONSTRAINT "invoice_services_invoice_id_fkey" FOREIGN KEY ("invoice_id") REFERENCES "public"."invoices"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "invoice_status_history" ADD CONSTRAINT "fk_invoice" FOREIGN KEY ("invoice_id") REFERENCES "public"."invoices"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "invoice_status_history" ADD CONSTRAINT "invoice_status_history_invoice_id_fkey" FOREIGN KEY ("invoice_id") REFERENCES "public"."invoices"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "prestation_categories" ADD CONSTRAINT "prestation_categories_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "prestation_subcategories" ADD CONSTRAINT "prestation_subcategories_category_id_fkey" FOREIGN KEY ("category_id") REFERENCES "public"."prestation_categories"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "prestation_subcategories" ADD CONSTRAINT "prestation_subcategories_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "prestations" ADD CONSTRAINT "prestations_category_id_fkey" FOREIGN KEY ("category_id") REFERENCES "public"."prestation_categories"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "prestations" ADD CONSTRAINT "prestations_sub_category_id_fkey" FOREIGN KEY ("sub_category_id") REFERENCES "public"."prestation_subcategories"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "prestations" ADD CONSTRAINT "prestations_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "profiles" ADD CONSTRAINT "profiles_id_fkey" FOREIGN KEY ("id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "profiles" ADD CONSTRAINT "profiles_parent_user_id_fkey" FOREIGN KEY ("parent_user_id") REFERENCES "public"."profiles"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "prospect_requests" ADD CONSTRAINT "prospect_requests_user_token_fkey" FOREIGN KEY ("user_token") REFERENCES "public"."user_prospect_tokens"("token") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "purchase_orders" ADD CONSTRAINT "purchase_orders_assigned_to_fkey" FOREIGN KEY ("assigned_to") REFERENCES "public"."collaborators"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "purchase_orders" ADD CONSTRAINT "purchase_orders_quote_id_fkey" FOREIGN KEY ("quote_id") REFERENCES "public"."quotes"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "purchase_orders" ADD CONSTRAINT "purchase_orders_supplier_id_fkey" FOREIGN KEY ("supplier_id") REFERENCES "public"."suppliers"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "purchase_order_items" ADD CONSTRAINT "purchase_order_items_purchase_order_id_fkey" FOREIGN KEY ("purchase_order_id") REFERENCES "public"."purchase_orders"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "purchase_order_items" ADD CONSTRAINT "purchase_order_items_service_id_fkey" FOREIGN KEY ("service_id") REFERENCES "public"."services"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "services" ADD CONSTRAINT "services_category_id_fkey" FOREIGN KEY ("category_id") REFERENCES "public"."service_categories"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "services" ADD CONSTRAINT "services_parent_service_id_fkey" FOREIGN KEY ("parent_service_id") REFERENCES "public"."services"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "services" ADD CONSTRAINT "services_supplier_id_fkey" FOREIGN KEY ("supplier_id") REFERENCES "public"."suppliers"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "services" ADD CONSTRAINT "services_user_id_fkey" FOREIGN KEY ("owner_user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "quote_folders" ADD CONSTRAINT "quote_folders_parent_id_fkey" FOREIGN KEY ("parent_id") REFERENCES "public"."quote_folders"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "quote_photos" ADD CONSTRAINT "quote_photos_quote_id_fkey" FOREIGN KEY ("quote_id") REFERENCES "public"."quotes"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "quote_services" ADD CONSTRAINT "quote_services_quote_id_fkey" FOREIGN KEY ("quote_id") REFERENCES "public"."quotes"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "quote_services" ADD CONSTRAINT "quote_services_service_id_fkey" FOREIGN KEY ("service_id") REFERENCES "public"."services"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "quote_status_history" ADD CONSTRAINT "quote_status_history_changed_by_fkey" FOREIGN KEY ("changed_by") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "quote_status_history" ADD CONSTRAINT "quote_status_history_quote_id_fkey" FOREIGN KEY ("quote_id") REFERENCES "public"."quotes"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "quote_template_services" ADD CONSTRAINT "quote_template_services_service_id_fkey" FOREIGN KEY ("service_id") REFERENCES "public"."services"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "quote_template_services" ADD CONSTRAINT "quote_template_services_template_id_fkey" FOREIGN KEY ("template_id") REFERENCES "public"."quote_templates"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "quote_templates" ADD CONSTRAINT "quote_templates_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "rental_items" ADD CONSTRAINT "rental_items_quote_id_fkey" FOREIGN KEY ("quote_id") REFERENCES "public"."quotes"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "rental_items" ADD CONSTRAINT "rental_items_supplier_id_fkey" FOREIGN KEY ("supplier_id") REFERENCES "public"."suppliers"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "service_ingredients" ADD CONSTRAINT "service_ingredients_ingredient_id_fkey" FOREIGN KEY ("ingredient_id") REFERENCES "public"."ingredients"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "service_ingredients" ADD CONSTRAINT "service_ingredients_service_id_fkey" FOREIGN KEY ("service_id") REFERENCES "public"."services"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "service_ingredients" ADD CONSTRAINT "service_ingredients_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "service_materials" ADD CONSTRAINT "service_materials_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "software_updates" ADD CONSTRAINT "software_updates_created_by_fkey" FOREIGN KEY ("created_by") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "stock_movements" ADD CONSTRAINT "stock_movements_event_id_fkey" FOREIGN KEY ("event_id") REFERENCES "public"."quotes"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "stock_movements" ADD CONSTRAINT "stock_movements_ingredient_id_fkey" FOREIGN KEY ("ingredient_id") REFERENCES "public"."ingredients"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "stock_movements" ADD CONSTRAINT "stock_movements_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "supplier_order_items" ADD CONSTRAINT "supplier_order_items_ingredient_id_fkey" FOREIGN KEY ("ingredient_id") REFERENCES "public"."ingredients"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "supplier_order_items" ADD CONSTRAINT "supplier_order_items_order_id_fkey" FOREIGN KEY ("order_id") REFERENCES "public"."supplier_orders"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "supplier_orders" ADD CONSTRAINT "supplier_orders_event_id_fkey" FOREIGN KEY ("event_id") REFERENCES "public"."quotes"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "supplier_orders" ADD CONSTRAINT "supplier_orders_supplier_id_fkey" FOREIGN KEY ("supplier_id") REFERENCES "public"."suppliers"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "supplier_orders" ADD CONSTRAINT "supplier_orders_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "support_ticket_messages" ADD CONSTRAINT "support_ticket_messages_ticket_id_fkey" FOREIGN KEY ("ticket_id") REFERENCES "public"."support_tickets"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "support_ticket_messages" ADD CONSTRAINT "support_ticket_messages_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "public"."profiles"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "support_ticket_attachments" ADD CONSTRAINT "support_ticket_attachments_message_id_fkey" FOREIGN KEY ("message_id") REFERENCES "public"."support_ticket_messages"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "support_ticket_attachments" ADD CONSTRAINT "support_ticket_attachments_ticket_id_fkey" FOREIGN KEY ("ticket_id") REFERENCES "public"."support_tickets"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "support_ticket_attachments" ADD CONSTRAINT "support_ticket_attachments_uploaded_by_fkey" FOREIGN KEY ("uploaded_by") REFERENCES "public"."profiles"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "support_tickets" ADD CONSTRAINT "support_tickets_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "public"."profiles"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "task_template_items" ADD CONSTRAINT "task_template_items_template_id_fkey" FOREIGN KEY ("template_id") REFERENCES "public"."task_templates"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "user_library_photos" ADD CONSTRAINT "user_library_photos_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "user_photo_categories" ADD CONSTRAINT "user_photo_categories_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "idx_quotes_customer_id" ON "quotes" USING btree ("customer_id" uuid_ops);--> statement-breakpoint
CREATE INDEX "idx_quotes_folder" ON "quotes" USING btree ("folder_id" uuid_ops);--> statement-breakpoint
CREATE UNIQUE INDEX "customers_email_owner_unique" ON "customers" USING btree ("email" text_ops,"owner_user_id" text_ops);--> statement-breakpoint
CREATE UNIQUE INDEX "customers_siret_owner_unique" ON "customers" USING btree ("siret_number" uuid_ops,"owner_user_id" uuid_ops) WHERE (siret_number IS NOT NULL);--> statement-breakpoint
CREATE INDEX "idx_customers_company_name" ON "customers" USING btree ("company_name" text_ops) WHERE (customer_type = 'entreprise'::customer_type);--> statement-breakpoint
CREATE INDEX "idx_customers_customer_type" ON "customers" USING btree ("customer_type" enum_ops);--> statement-breakpoint
CREATE INDEX "idx_customers_email" ON "customers" USING btree ("email" text_ops);--> statement-breakpoint
CREATE INDEX "idx_customers_last_name" ON "customers" USING btree ("last_name" text_ops) WHERE (customer_type = 'particulier'::customer_type);--> statement-breakpoint
CREATE INDEX "idx_customers_user_id" ON "customers" USING btree ("owner_user_id" uuid_ops);--> statement-breakpoint
CREATE INDEX "idx_customer_contacts_customer" ON "customer_contacts" USING btree ("customer_id" uuid_ops);--> statement-breakpoint
CREATE INDEX "idx_event_ingredients_quote_id" ON "event_ingredients" USING btree ("quote_id" uuid_ops);--> statement-breakpoint
CREATE INDEX "idx_prestation_categories_user" ON "prestation_categories" USING btree ("user_id" uuid_ops);--> statement-breakpoint
CREATE INDEX "idx_prestation_subcategories_cat" ON "prestation_subcategories" USING btree ("category_id" uuid_ops);--> statement-breakpoint
CREATE INDEX "idx_prestation_subcategories_user" ON "prestation_subcategories" USING btree ("user_id" uuid_ops);--> statement-breakpoint
CREATE INDEX "idx_prestations_category_id" ON "prestations" USING btree ("category_id" uuid_ops);--> statement-breakpoint
CREATE INDEX "idx_prestations_sub_category_id" ON "prestations" USING btree ("sub_category_id" uuid_ops);--> statement-breakpoint
CREATE INDEX "idx_profiles_company_siret" ON "profiles" USING btree ("company_siret" text_ops);--> statement-breakpoint
CREATE INDEX "idx_services_category_id" ON "services" USING btree ("category_id" uuid_ops);--> statement-breakpoint
CREATE INDEX "idx_services_parent_service_id" ON "services" USING btree ("parent_service_id" uuid_ops);--> statement-breakpoint
CREATE INDEX "idx_quote_folders_owner" ON "quote_folders" USING btree ("owner_user_id" uuid_ops);--> statement-breakpoint
CREATE INDEX "idx_quote_folders_parent" ON "quote_folders" USING btree ("parent_id" uuid_ops);--> statement-breakpoint
CREATE INDEX "idx_quote_photos_quote_id" ON "quote_photos" USING btree ("quote_id" uuid_ops);--> statement-breakpoint
CREATE INDEX "idx_quote_photos_user_id" ON "quote_photos" USING btree ("user_id" uuid_ops);--> statement-breakpoint
CREATE INDEX "idx_quote_services_sort_order" ON "quote_services" USING btree ("quote_id" uuid_ops,"sort_order" uuid_ops);--> statement-breakpoint
CREATE INDEX "idx_software_updates_published_at" ON "software_updates" USING btree ("published_at" timestamptz_ops);--> statement-breakpoint
CREATE INDEX "idx_stock_movements_event" ON "stock_movements" USING btree ("event_id" uuid_ops);--> statement-breakpoint
CREATE INDEX "idx_stock_movements_ingredient" ON "stock_movements" USING btree ("ingredient_id" uuid_ops);--> statement-breakpoint
CREATE INDEX "idx_stock_movements_user" ON "stock_movements" USING btree ("user_id" uuid_ops);--> statement-breakpoint
CREATE INDEX "idx_supplier_order_items_ingredient" ON "supplier_order_items" USING btree ("ingredient_id" uuid_ops);--> statement-breakpoint
CREATE INDEX "idx_supplier_order_items_order" ON "supplier_order_items" USING btree ("order_id" uuid_ops);--> statement-breakpoint
CREATE INDEX "idx_supplier_orders_event" ON "supplier_orders" USING btree ("event_id" uuid_ops);--> statement-breakpoint
CREATE INDEX "idx_supplier_orders_supplier" ON "supplier_orders" USING btree ("supplier_id" uuid_ops);--> statement-breakpoint
CREATE INDEX "idx_supplier_orders_user" ON "supplier_orders" USING btree ("user_id" uuid_ops);
*/