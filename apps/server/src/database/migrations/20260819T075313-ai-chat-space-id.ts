import { type Kysely } from 'kysely';

export async function up(db: Kysely<any>): Promise<void> {
  // Existing ai_chats rows predate Space scoping and cannot be mapped to a
  // Space reliably. Keep the column nullable for those legacy rows; all new
  // chats are created with a non-null spaceId by AiChatService.
  await db.schema
    .alterTable('ai_chats')
    .addColumn('space_id', 'uuid', (col) =>
      col.references('spaces.id').onDelete('cascade'),
    )
    .execute();

  await db.schema
    .createIndex('idx_ai_chats_space_id')
    .ifNotExists()
    .on('ai_chats')
    .column('space_id')
    .execute();

  await db.schema
    .dropIndex('idx_ai_chats_workspace_creator')
    .ifExists()
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
    .ifExists()
    .execute();

  await db.schema
    .createIndex('idx_ai_chats_workspace_creator')
    .ifNotExists()
    .on('ai_chats')
    .columns(['workspace_id', 'creator_id', 'id'])
    .execute();

  await db.schema
    .dropIndex('idx_ai_chats_space_id')
    .ifExists()
    .execute();

  await db.schema
    .alterTable('ai_chats')
    .dropColumn('space_id')
    .execute();
}
