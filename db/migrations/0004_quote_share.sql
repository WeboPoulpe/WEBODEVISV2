ALTER TABLE "quotes" ADD COLUMN "share_token" text;--> statement-breakpoint
ALTER TABLE "quotes" ADD COLUMN "sent_at" timestamp with time zone;--> statement-breakpoint
ALTER TABLE "quotes" ADD CONSTRAINT "quotes_share_token_unique" UNIQUE("share_token");