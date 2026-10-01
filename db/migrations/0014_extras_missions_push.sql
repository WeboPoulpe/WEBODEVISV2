CREATE TABLE "push_subscriptions" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"endpoint" text NOT NULL,
	"p256dh" text NOT NULL,
	"auth" text NOT NULL,
	"user_id" uuid,
	"extra_id" uuid,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "push_subscriptions_owner_check" CHECK ((user_id IS NOT NULL) <> (extra_id IS NOT NULL))
);
--> statement-breakpoint
ALTER TABLE "notifications" DROP CONSTRAINT "notifications_type_check";--> statement-breakpoint
ALTER TABLE "event_extras" ADD COLUMN "departure_time" text;--> statement-breakpoint
ALTER TABLE "event_extras" ADD COLUMN "invited_at" timestamp with time zone;--> statement-breakpoint
ALTER TABLE "event_extras" ADD COLUMN "responded_at" timestamp with time zone;--> statement-breakpoint
ALTER TABLE "event_extras" ADD COLUMN "reminded_at" timestamp with time zone;--> statement-breakpoint
ALTER TABLE "extras" ADD COLUMN "unavailable_dates" date[] DEFAULT '{}'::date[] NOT NULL;--> statement-breakpoint
ALTER TABLE "push_subscriptions" ADD CONSTRAINT "push_subscriptions_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "push_subscriptions" ADD CONSTRAINT "push_subscriptions_extra_id_fkey" FOREIGN KEY ("extra_id") REFERENCES "public"."extras"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE UNIQUE INDEX "push_subscriptions_endpoint_key" ON "push_subscriptions" USING btree ("endpoint" text_ops);--> statement-breakpoint
ALTER TABLE "notifications" ADD CONSTRAINT "notifications_type_check" CHECK (type = ANY (ARRAY['prospect_request'::text, 'upcoming_event'::text, 'invoice_due'::text, 'support_ticket'::text, 'system_update'::text, 'task_reminder'::text, 'stock_alert'::text, 'extra_response'::text]));