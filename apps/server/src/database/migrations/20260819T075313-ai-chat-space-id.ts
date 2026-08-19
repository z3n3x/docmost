import { type Kysely, sql } from 'kysely';

export async function up(db: Kysely<any>): Promise<void> {
  // Добавляем space_id в ai_chats
  await db.schema
    .alterTable('ai_chats')
    .addColumn('space_id', 'uuid', (col) =>
      col.references('spaces.id').onDelete('cascade').notNull(),
    )
    .execute();

  await db.schema
    .createIndex('idx_ai_chats_space_id')
    .ifNotExists()
    .on('ai_chats')
    .column('space_id')
    .execute();

  // Обновляем индекс для более эффективного поиска по workspace + space + creator
  await db.schema
    .dropIndex('idx_ai_chats_workspace_creator')
    .execute();

  await db.schema
    .createIndex('idx_ai_chats_workspace_space_creator')
    .ifNotExists()
    .on('ai_chats')
    .columns(['workspace_id', 'space_id', 'creator_id', 'id'])
    .execute();
}

export async function down(db: Kysely<any>): Promise<void> {
  await db.schema
    .dropIndex('idx_ai_chats_workspace_space_creator')
    .execute();

  await db.schema
    .createIndex('idx_ai_chats_workspace_creator')
    .ifNotExists()
    .on('ai_chats')
    .columns(['workspace_id', 'creator_id', 'id'])
    .execute();

  await db.schema
    .dropIndex('idx_ai_chats_space_id')
    .execute();

  await db.schema
    .alterTable('ai_chats')
    .dropColumn('space_id')
    .execute();
}
