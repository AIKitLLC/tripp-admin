import { MigrateUpArgs, MigrateDownArgs, sql } from '@payloadcms/db-d1-sqlite'

export async function up({ db, payload, req }: MigrateUpArgs): Promise<void> {
  await db.run(sql`CREATE TABLE \`cards\` (
  	\`id\` integer PRIMARY KEY NOT NULL,
  	\`card_id\` numeric NOT NULL,
  	\`name\` text NOT NULL,
  	\`english\` text NOT NULL,
  	\`arcana\` text NOT NULL,
  	\`suit\` text,
  	\`rank\` text,
  	\`glyph\` text,
  	\`upright\` text,
  	\`reversed\` text,
  	\`upright_english\` text,
  	\`reversed_english\` text,
  	\`updated_at\` text DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now')) NOT NULL,
  	\`created_at\` text DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now')) NOT NULL
  );
  `)
  await db.run(sql`CREATE UNIQUE INDEX \`cards_card_id_idx\` ON \`cards\` (\`card_id\`);`)
  await db.run(sql`CREATE INDEX \`cards_updated_at_idx\` ON \`cards\` (\`updated_at\`);`)
  await db.run(sql`CREATE INDEX \`cards_created_at_idx\` ON \`cards\` (\`created_at\`);`)
  await db.run(sql`CREATE TABLE \`spreads\` (
  	\`id\` integer PRIMARY KEY NOT NULL,
  	\`spread_id\` text NOT NULL,
  	\`name\` text NOT NULL,
  	\`name_english\` text NOT NULL,
  	\`description\` text,
  	\`description_english\` text,
  	\`card_count\` numeric DEFAULT 3 NOT NULL,
  	\`positions\` text,
  	\`updated_at\` text DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now')) NOT NULL,
  	\`created_at\` text DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now')) NOT NULL
  );
  `)
  await db.run(sql`CREATE UNIQUE INDEX \`spreads_spread_id_idx\` ON \`spreads\` (\`spread_id\`);`)
  await db.run(sql`CREATE INDEX \`spreads_updated_at_idx\` ON \`spreads\` (\`updated_at\`);`)
  await db.run(sql`CREATE INDEX \`spreads_created_at_idx\` ON \`spreads\` (\`created_at\`);`)
  await db.run(sql`CREATE TABLE \`context_flows\` (
  	\`id\` integer PRIMARY KEY NOT NULL,
  	\`name\` text DEFAULT 'Default Flow' NOT NULL,
  	\`branch\` text DEFAULT 'conversation' NOT NULL,
  	\`status\` text DEFAULT 'published' NOT NULL,
  	\`revision\` numeric DEFAULT 1,
  	\`tone\` text DEFAULT 'warm',
  	\`depth\` text DEFAULT 'balanced',
  	\`owner_quality_instructions\` text,
  	\`tester_quality_instructions\` text,
  	\`nodes\` text,
  	\`updated_at\` text DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now')) NOT NULL,
  	\`created_at\` text DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now')) NOT NULL
  );
  `)
  await db.run(sql`CREATE INDEX \`context_flows_updated_at_idx\` ON \`context_flows\` (\`updated_at\`);`)
  await db.run(sql`CREATE INDEX \`context_flows_created_at_idx\` ON \`context_flows\` (\`created_at\`);`)
  await db.run(sql`CREATE TABLE \`reading_sessions\` (
  	\`id\` integer PRIMARY KEY NOT NULL,
  	\`session_id\` text NOT NULL,
  	\`question\` text,
  	\`spread_id\` text,
  	\`drawn_cards\` text,
  	\`turns\` numeric DEFAULT 1,
  	\`model\` text DEFAULT '@cf/qwen/qwen3-30b-a3b-fp8',
  	\`token_usage\` text,
  	\`status\` text DEFAULT 'active',
  	\`language\` text DEFAULT 'vi',
  	\`client_ip\` text,
  	\`updated_at\` text DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now')) NOT NULL,
  	\`created_at\` text DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now')) NOT NULL
  );
  `)
  await db.run(sql`CREATE INDEX \`reading_sessions_session_id_idx\` ON \`reading_sessions\` (\`session_id\`);`)
  await db.run(sql`CREATE INDEX \`reading_sessions_updated_at_idx\` ON \`reading_sessions\` (\`updated_at\`);`)
  await db.run(sql`CREATE INDEX \`reading_sessions_created_at_idx\` ON \`reading_sessions\` (\`created_at\`);`)
  await db.run(sql`CREATE TABLE \`audit_logs\` (
  	\`id\` integer PRIMARY KEY NOT NULL,
  	\`action\` text NOT NULL,
  	\`actor\` text NOT NULL,
  	\`target\` text,
  	\`details\` text,
  	\`ip_address\` text,
  	\`updated_at\` text DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now')) NOT NULL,
  	\`created_at\` text DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now')) NOT NULL
  );
  `)
  await db.run(sql`CREATE INDEX \`audit_logs_updated_at_idx\` ON \`audit_logs\` (\`updated_at\`);`)
  await db.run(sql`CREATE INDEX \`audit_logs_created_at_idx\` ON \`audit_logs\` (\`created_at\`);`)
  await db.run(sql`CREATE TABLE \`payload_kv\` (
  	\`id\` integer PRIMARY KEY NOT NULL,
  	\`key\` text NOT NULL,
  	\`data\` text NOT NULL
  );
  `)
  await db.run(sql`CREATE UNIQUE INDEX \`payload_kv_key_idx\` ON \`payload_kv\` (\`key\`);`)
  await db.run(sql`ALTER TABLE \`users\` ADD \`role\` text DEFAULT 'editor' NOT NULL;`)
  await db.run(sql`ALTER TABLE \`users\` ADD \`status\` text DEFAULT 'active';`)
  await db.run(sql`ALTER TABLE \`users\` ADD \`telegram_id\` text;`)
  await db.run(sql`ALTER TABLE \`users\` ADD \`last_login_at\` text;`)
  await db.run(sql`ALTER TABLE \`payload_locked_documents_rels\` ADD \`cards_id\` integer REFERENCES cards(id);`)
  await db.run(sql`ALTER TABLE \`payload_locked_documents_rels\` ADD \`spreads_id\` integer REFERENCES spreads(id);`)
  await db.run(sql`ALTER TABLE \`payload_locked_documents_rels\` ADD \`context_flows_id\` integer REFERENCES context_flows(id);`)
  await db.run(sql`ALTER TABLE \`payload_locked_documents_rels\` ADD \`reading_sessions_id\` integer REFERENCES reading_sessions(id);`)
  await db.run(sql`ALTER TABLE \`payload_locked_documents_rels\` ADD \`audit_logs_id\` integer REFERENCES audit_logs(id);`)
  await db.run(sql`CREATE INDEX \`payload_locked_documents_rels_cards_id_idx\` ON \`payload_locked_documents_rels\` (\`cards_id\`);`)
  await db.run(sql`CREATE INDEX \`payload_locked_documents_rels_spreads_id_idx\` ON \`payload_locked_documents_rels\` (\`spreads_id\`);`)
  await db.run(sql`CREATE INDEX \`payload_locked_documents_rels_context_flows_id_idx\` ON \`payload_locked_documents_rels\` (\`context_flows_id\`);`)
  await db.run(sql`CREATE INDEX \`payload_locked_documents_rels_reading_sessions_id_idx\` ON \`payload_locked_documents_rels\` (\`reading_sessions_id\`);`)
  await db.run(sql`CREATE INDEX \`payload_locked_documents_rels_audit_logs_id_idx\` ON \`payload_locked_documents_rels\` (\`audit_logs_id\`);`)
}

export async function down({ db, payload, req }: MigrateDownArgs): Promise<void> {
  await db.run(sql`DROP TABLE \`cards\`;`)
  await db.run(sql`DROP TABLE \`spreads\`;`)
  await db.run(sql`DROP TABLE \`context_flows\`;`)
  await db.run(sql`DROP TABLE \`reading_sessions\`;`)
  await db.run(sql`DROP TABLE \`audit_logs\`;`)
  await db.run(sql`DROP TABLE \`payload_kv\`;`)
  await db.run(sql`PRAGMA foreign_keys=OFF;`)
  await db.run(sql`CREATE TABLE \`__new_payload_locked_documents_rels\` (
  	\`id\` integer PRIMARY KEY NOT NULL,
  	\`order\` integer,
  	\`parent_id\` integer NOT NULL,
  	\`path\` text NOT NULL,
  	\`users_id\` integer,
  	\`media_id\` integer,
  	FOREIGN KEY (\`parent_id\`) REFERENCES \`payload_locked_documents\`(\`id\`) ON UPDATE no action ON DELETE cascade,
  	FOREIGN KEY (\`users_id\`) REFERENCES \`users\`(\`id\`) ON UPDATE no action ON DELETE cascade,
  	FOREIGN KEY (\`media_id\`) REFERENCES \`media\`(\`id\`) ON UPDATE no action ON DELETE cascade
  );
  `)
  await db.run(sql`INSERT INTO \`__new_payload_locked_documents_rels\`("id", "order", "parent_id", "path", "users_id", "media_id") SELECT "id", "order", "parent_id", "path", "users_id", "media_id" FROM \`payload_locked_documents_rels\`;`)
  await db.run(sql`DROP TABLE \`payload_locked_documents_rels\`;`)
  await db.run(sql`ALTER TABLE \`__new_payload_locked_documents_rels\` RENAME TO \`payload_locked_documents_rels\`;`)
  await db.run(sql`PRAGMA foreign_keys=ON;`)
  await db.run(sql`CREATE INDEX \`payload_locked_documents_rels_order_idx\` ON \`payload_locked_documents_rels\` (\`order\`);`)
  await db.run(sql`CREATE INDEX \`payload_locked_documents_rels_parent_idx\` ON \`payload_locked_documents_rels\` (\`parent_id\`);`)
  await db.run(sql`CREATE INDEX \`payload_locked_documents_rels_path_idx\` ON \`payload_locked_documents_rels\` (\`path\`);`)
  await db.run(sql`CREATE INDEX \`payload_locked_documents_rels_users_id_idx\` ON \`payload_locked_documents_rels\` (\`users_id\`);`)
  await db.run(sql`CREATE INDEX \`payload_locked_documents_rels_media_id_idx\` ON \`payload_locked_documents_rels\` (\`media_id\`);`)
  await db.run(sql`ALTER TABLE \`users\` DROP COLUMN \`role\`;`)
  await db.run(sql`ALTER TABLE \`users\` DROP COLUMN \`status\`;`)
  await db.run(sql`ALTER TABLE \`users\` DROP COLUMN \`telegram_id\`;`)
  await db.run(sql`ALTER TABLE \`users\` DROP COLUMN \`last_login_at\`;`)
}
