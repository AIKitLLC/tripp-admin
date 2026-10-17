import { MigrateUpArgs, MigrateDownArgs, sql } from '@payloadcms/db-d1-sqlite'

export async function up({ db, payload, req }: MigrateUpArgs): Promise<void> {
  await db.run(sql`ALTER TABLE \`users\` ADD \`reset_password_requested_at\` text;`)
  await db.run(sql`ALTER TABLE \`users\` ADD \`_verified\` integer;`)
  await db.run(sql`ALTER TABLE \`users\` ADD \`_verificationtoken\` text;`)
  await db.run(sql`UPDATE \`users\` SET \`_verified\` = 1 WHERE \`_verified\` IS NULL;`)
  await db.run(sql`ALTER TABLE \`media\` ADD \`_objectkey\` text;`)
  await db.run(sql`ALTER TABLE \`reading_sessions\` ADD \`user_id\` integer REFERENCES users(id) ON DELETE SET NULL;`)
  await db.run(sql`CREATE INDEX \`reading_sessions_user_idx\` ON \`reading_sessions\` (\`user_id\`);`)
}

export async function down({ db, payload, req }: MigrateDownArgs): Promise<void> {
  await db.run(sql`PRAGMA foreign_keys=OFF;`)
  await db.run(sql`CREATE TABLE \`__new_reading_sessions\` (
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
  await db.run(sql`INSERT INTO \`__new_reading_sessions\`("id", "session_id", "question", "spread_id", "drawn_cards", "turns", "model", "token_usage", "status", "language", "client_ip", "updated_at", "created_at") SELECT "id", "session_id", "question", "spread_id", "drawn_cards", "turns", "model", "token_usage", "status", "language", "client_ip", "updated_at", "created_at" FROM \`reading_sessions\`;`)
  await db.run(sql`DROP TABLE \`reading_sessions\`;`)
  await db.run(sql`ALTER TABLE \`__new_reading_sessions\` RENAME TO \`reading_sessions\`;`)
  await db.run(sql`PRAGMA foreign_keys=ON;`)
  await db.run(sql`CREATE INDEX \`reading_sessions_session_id_idx\` ON \`reading_sessions\` (\`session_id\`);`)
  await db.run(sql`CREATE INDEX \`reading_sessions_updated_at_idx\` ON \`reading_sessions\` (\`updated_at\`);`)
  await db.run(sql`CREATE INDEX \`reading_sessions_created_at_idx\` ON \`reading_sessions\` (\`created_at\`);`)
  await db.run(sql`ALTER TABLE \`users\` DROP COLUMN \`reset_password_requested_at\`;`)
  await db.run(sql`ALTER TABLE \`users\` DROP COLUMN \`_verified\`;`)
  await db.run(sql`ALTER TABLE \`users\` DROP COLUMN \`_verificationtoken\`;`)
  await db.run(sql`ALTER TABLE \`media\` DROP COLUMN \`_objectkey\`;`)
}
