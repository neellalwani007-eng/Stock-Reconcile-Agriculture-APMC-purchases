CREATE TABLE IF NOT EXISTS "sessions" (
	"sid" varchar PRIMARY KEY NOT NULL,
	"sess" jsonb NOT NULL,
	"expire" timestamp NOT NULL
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "subscriptions" (
	"id" varchar PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" varchar NOT NULL,
	"duration_years" integer DEFAULT 1 NOT NULL,
	"activated_on" timestamp with time zone NOT NULL,
	"expires_on" timestamp with time zone NOT NULL,
	"payment_source" varchar(160),
	"payment_reference" varchar(200),
	"issued_by" varchar DEFAULT 'admin',
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "users" (
	"id" varchar PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"email" varchar,
	"first_name" varchar,
	"last_name" varchar,
	"profile_image_url" varchar,
	"google_refresh_token" varchar,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "users_email_unique" UNIQUE("email")
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "purchase_records" (
	"id" serial PRIMARY KEY NOT NULL,
	"user_id" text NOT NULL,
	"bill_date" text NOT NULL,
	"purchase_date" text NOT NULL,
	"item" text NOT NULL,
	"qty" numeric(12, 4) NOT NULL,
	"rate" numeric(12, 4) NOT NULL,
	"amount" numeric(14, 4) NOT NULL,
	"status" text DEFAULT 'Unmatched' NOT NULL,
	"created_at" timestamp DEFAULT now()
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "sale_records" (
	"id" serial PRIMARY KEY NOT NULL,
	"user_id" text NOT NULL,
	"sale_date" text NOT NULL,
	"item" text NOT NULL,
	"qty" numeric(12, 4) NOT NULL,
	"rate" numeric(12, 4) NOT NULL,
	"amount" numeric(14, 4) NOT NULL,
	"purchase_bill_date" text,
	"status" text DEFAULT 'Pending' NOT NULL,
	"created_at" timestamp DEFAULT now()
);
--> statement-breakpoint
ALTER TABLE "subscriptions" ADD COLUMN IF NOT EXISTS "payment_source" varchar(160);
--> statement-breakpoint
ALTER TABLE "subscriptions" ADD COLUMN IF NOT EXISTS "payment_reference" varchar(200);
--> statement-breakpoint
DO $$
BEGIN
	IF NOT EXISTS (
		SELECT 1 FROM pg_constraint
		WHERE conname = 'subscriptions_user_id_users_id_fk'
		  AND conrelid = 'subscriptions'::regclass
	) THEN
		ALTER TABLE "subscriptions"
			ADD CONSTRAINT "subscriptions_user_id_users_id_fk"
			FOREIGN KEY ("user_id") REFERENCES "public"."users"("id")
			ON DELETE cascade ON UPDATE no action;
	END IF;
END $$;
--> statement-breakpoint
CREATE UNIQUE INDEX IF NOT EXISTS "users_email_unique" ON "users" USING btree ("email");
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "IDX_session_expire" ON "sessions" USING btree ("expire");
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "purchase_records_user_idx" ON "purchase_records" USING btree ("user_id");
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "purchase_records_date_idx" ON "purchase_records" USING btree ("user_id","bill_date");
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "sale_records_user_idx" ON "sale_records" USING btree ("user_id");
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "sale_records_date_idx" ON "sale_records" USING btree ("user_id","sale_date");