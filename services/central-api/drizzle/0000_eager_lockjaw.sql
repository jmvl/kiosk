CREATE TABLE "audit_log" (
	"audit_id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"actor" text NOT NULL,
	"action" text NOT NULL,
	"subject_type" varchar(64) NOT NULL,
	"subject_id" text NOT NULL,
	"occurred_at" timestamp with time zone DEFAULT now() NOT NULL,
	"metadata" jsonb DEFAULT '{}'::jsonb NOT NULL
);
--> statement-breakpoint
CREATE TABLE "command_results" (
	"command_id" varchar(96) PRIMARY KEY NOT NULL,
	"kiosk_id" varchar(96) NOT NULL,
	"status" varchar(32) NOT NULL,
	"started_at" timestamp with time zone,
	"completed_at" timestamp with time zone NOT NULL,
	"message" text,
	"error_code" text,
	"evidence" jsonb DEFAULT '{}'::jsonb NOT NULL
);
--> statement-breakpoint
CREATE TABLE "device_commands" (
	"command_id" varchar(96) PRIMARY KEY NOT NULL,
	"kiosk_id" varchar(96) NOT NULL,
	"type" varchar(64) NOT NULL,
	"status" varchar(32) DEFAULT 'pending' NOT NULL,
	"payload" jsonb DEFAULT '{}'::jsonb NOT NULL,
	"issued_at" timestamp with time zone DEFAULT now() NOT NULL,
	"expires_at" timestamp with time zone NOT NULL,
	"requires_confirmation" boolean DEFAULT false NOT NULL,
	"idempotency_key" text NOT NULL,
	"created_by" text DEFAULT 'system' NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "events" (
	"event_id" varchar(128) PRIMARY KEY NOT NULL,
	"kiosk_id" varchar(96) NOT NULL,
	"session_id" varchar(96),
	"local_sequence" integer NOT NULL,
	"event_type" text NOT NULL,
	"occurred_at" timestamp with time zone NOT NULL,
	"payload" jsonb DEFAULT '{}'::jsonb NOT NULL,
	"schema_version" integer DEFAULT 1 NOT NULL,
	"ingested_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "heartbeats" (
	"heartbeat_id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"kiosk_id" varchar(96) NOT NULL,
	"location_id" varchar(96) NOT NULL,
	"received_at" timestamp with time zone DEFAULT now() NOT NULL,
	"payload" jsonb NOT NULL
);
--> statement-breakpoint
CREATE TABLE "kiosks" (
	"kiosk_id" varchar(96) PRIMARY KEY NOT NULL,
	"location_id" varchar(96) NOT NULL,
	"name" text NOT NULL,
	"status" varchar(32) DEFAULT 'unknown' NOT NULL,
	"agent_version" text,
	"runtime_version" text,
	"player_version" text,
	"active_package" text,
	"schedule_version" integer DEFAULT 0 NOT NULL,
	"last_heartbeat_at" timestamp with time zone,
	"last_session_at" timestamp with time zone,
	"last_error" text,
	"metadata" jsonb DEFAULT '{}'::jsonb NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "locations" (
	"location_id" varchar(96) PRIMARY KEY NOT NULL,
	"name" text NOT NULL,
	"timezone" text DEFAULT 'UTC' NOT NULL,
	"metadata" jsonb DEFAULT '{}'::jsonb NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "sessions" (
	"session_id" varchar(96) PRIMARY KEY NOT NULL,
	"kiosk_id" varchar(96) NOT NULL,
	"package_id" text,
	"package_version" text,
	"status" varchar(48) NOT NULL,
	"started_at" timestamp with time zone,
	"completed_at" timestamp with time zone,
	"payload" jsonb DEFAULT '{}'::jsonb NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "tickets" (
	"ticket_id" varchar(96) PRIMARY KEY NOT NULL,
	"kiosk_id" varchar(96) NOT NULL,
	"session_id" varchar(96),
	"public_ticket_id" varchar(64) NOT NULL,
	"campaign_short_code" varchar(24) NOT NULL,
	"ticket_code" text NOT NULL,
	"redemption_model" varchar(64) DEFAULT 'staff_visual_v1' NOT NULL,
	"hmac_algorithm" varchar(64) NOT NULL,
	"key_version" varchar(64) NOT NULL,
	"check_length" integer NOT NULL,
	"render_payload" jsonb DEFAULT '{}'::jsonb NOT NULL,
	"print_status" varchar(32) DEFAULT 'unknown' NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"reconciled_at" timestamp with time zone
);
--> statement-breakpoint
ALTER TABLE "command_results" ADD CONSTRAINT "command_results_command_id_device_commands_command_id_fk" FOREIGN KEY ("command_id") REFERENCES "public"."device_commands"("command_id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "command_results" ADD CONSTRAINT "command_results_kiosk_id_kiosks_kiosk_id_fk" FOREIGN KEY ("kiosk_id") REFERENCES "public"."kiosks"("kiosk_id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "device_commands" ADD CONSTRAINT "device_commands_kiosk_id_kiosks_kiosk_id_fk" FOREIGN KEY ("kiosk_id") REFERENCES "public"."kiosks"("kiosk_id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "events" ADD CONSTRAINT "events_kiosk_id_kiosks_kiosk_id_fk" FOREIGN KEY ("kiosk_id") REFERENCES "public"."kiosks"("kiosk_id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "heartbeats" ADD CONSTRAINT "heartbeats_kiosk_id_kiosks_kiosk_id_fk" FOREIGN KEY ("kiosk_id") REFERENCES "public"."kiosks"("kiosk_id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "heartbeats" ADD CONSTRAINT "heartbeats_location_id_locations_location_id_fk" FOREIGN KEY ("location_id") REFERENCES "public"."locations"("location_id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "kiosks" ADD CONSTRAINT "kiosks_location_id_locations_location_id_fk" FOREIGN KEY ("location_id") REFERENCES "public"."locations"("location_id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "sessions" ADD CONSTRAINT "sessions_kiosk_id_kiosks_kiosk_id_fk" FOREIGN KEY ("kiosk_id") REFERENCES "public"."kiosks"("kiosk_id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "tickets" ADD CONSTRAINT "tickets_kiosk_id_kiosks_kiosk_id_fk" FOREIGN KEY ("kiosk_id") REFERENCES "public"."kiosks"("kiosk_id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "tickets" ADD CONSTRAINT "tickets_session_id_sessions_session_id_fk" FOREIGN KEY ("session_id") REFERENCES "public"."sessions"("session_id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "audit_subject_idx" ON "audit_log" USING btree ("subject_type","subject_id");--> statement-breakpoint
CREATE INDEX "audit_occurred_idx" ON "audit_log" USING btree ("occurred_at");--> statement-breakpoint
CREATE INDEX "command_results_kiosk_completed_idx" ON "command_results" USING btree ("kiosk_id","completed_at");--> statement-breakpoint
CREATE UNIQUE INDEX "device_commands_kiosk_idempotency_uq" ON "device_commands" USING btree ("kiosk_id","idempotency_key");--> statement-breakpoint
CREATE INDEX "device_commands_kiosk_status_idx" ON "device_commands" USING btree ("kiosk_id","status","expires_at");--> statement-breakpoint
CREATE UNIQUE INDEX "events_kiosk_local_sequence_uq" ON "events" USING btree ("kiosk_id","local_sequence");--> statement-breakpoint
CREATE INDEX "events_kiosk_occurred_idx" ON "events" USING btree ("kiosk_id","occurred_at");--> statement-breakpoint
CREATE INDEX "events_session_idx" ON "events" USING btree ("session_id");--> statement-breakpoint
CREATE INDEX "heartbeats_kiosk_received_idx" ON "heartbeats" USING btree ("kiosk_id","received_at");--> statement-breakpoint
CREATE INDEX "kiosks_location_idx" ON "kiosks" USING btree ("location_id");--> statement-breakpoint
CREATE INDEX "sessions_kiosk_created_idx" ON "sessions" USING btree ("kiosk_id","created_at");--> statement-breakpoint
CREATE UNIQUE INDEX "tickets_public_ticket_id_uq" ON "tickets" USING btree ("public_ticket_id");--> statement-breakpoint
CREATE UNIQUE INDEX "tickets_ticket_code_uq" ON "tickets" USING btree ("ticket_code");--> statement-breakpoint
CREATE INDEX "tickets_kiosk_created_idx" ON "tickets" USING btree ("kiosk_id","created_at");