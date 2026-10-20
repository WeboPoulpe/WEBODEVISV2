CREATE TABLE "login_attempts" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"email_hash" text NOT NULL,
	"ip_hash" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE INDEX "idx_login_attempts_email" ON "login_attempts" USING btree ("email_hash" text_ops,"created_at" timestamptz_ops);--> statement-breakpoint
CREATE INDEX "idx_login_attempts_ip" ON "login_attempts" USING btree ("ip_hash" text_ops,"created_at" timestamptz_ops);