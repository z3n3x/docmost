import { Injectable } from '@nestjs/common';
import { InjectKysely } from 'nestjs-kysely';
import { KyselyDB, KyselyTransaction } from '../../types/kysely.types';
import { dbOrTx } from '../../utils';
import { AiChat, AiChatMessage } from '@docmost/db/types/entity.types';
import { PaginationOptions } from '@docmost/db/pagination/pagination-options';
import { executeWithCursorPagination, defaultEncodeCursor, defaultDecodeCursor } from '@docmost/db/pagination/cursor-pagination';
import { jsonArrayFrom, jsonObjectFrom } from 'kysely/helpers/postgres';

@Injectable()
export class AiChatRepo {
  constructor(@InjectKysely() private readonly db: KyselyDB) {}

  async findById(
    chatId: string,
    opts?: {
      includeCreator?: boolean;
      trx?: KyselyTransaction;
    },
  ): Promise<AiChat | null> {
    const db = dbOrTx(this.db, opts?.trx);

    return db
      .selectFrom('aiChats')
      .selectAll('aiChats')
      .$if(opts?.includeCreator ?? false, (qb) =>
        qb.select((eb) => this.withCreator(eb)),
      )
      .where('id', '=', chatId)
      .where('deletedAt', 'is', null)
      .executeTakeFirst();
  }

  async findByWorkspaceAndCreator(
    workspaceId: string,
    creatorId: string,
    pagination: PaginationOptions,
    spaceId?: string,
  ): Promise<{ items: AiChat[]; hasMore: boolean }> {
    let query = this.db
      .selectFrom('aiChats')
      .selectAll('aiChats')
      .where('workspaceId', '=', workspaceId)
      .where('creatorId', '=', creatorId)
      .where('deletedAt', 'is', null)
      .orderBy('updatedAt', 'desc')
      .orderBy('id', 'desc');

    if (spaceId) {
      query = query.where('spaceId', '=', spaceId);
    }

    const result = await executeWithCursorPagination(query, {
      perPage: pagination.limit ?? 20,
      cursor: pagination.cursor,
      beforeCursor: pagination.beforeCursor,
      fields: [
        { expression: 'updatedAt', direction: 'desc' },
        { expression: 'id', direction: 'desc' },
      ] as const,
      parseCursor: (decoded) => ({
        updatedAt: new Date(decoded.updatedAt),
        id: decoded.id,
      }),
    });

    return {
      items: result.items,
      hasMore: result.meta.hasNextPage,
    };
  }

  async create(
    data: {
      workspaceId: string;
      spaceId: string;
      creatorId: string;
      title?: string;
    },
    trx?: KyselyTransaction,
  ): Promise<AiChat> {
    const db = dbOrTx(this.db, trx);

    const result = await db
      .insertInto('aiChats')
      .values({
        workspaceId: data.workspaceId,
        spaceId: data.spaceId,
        creatorId: data.creatorId,
        title: data.title,
      })
      .returningAll()
      .executeTakeFirstOrThrow();

    return result;
  }

  async update(
    chatId: string,
    data: {
      title?: string;
    },
    trx?: KyselyTransaction,
  ): Promise<AiChat> {
    const db = dbOrTx(this.db, trx);

    const result = await db
      .updateTable('aiChats')
      .set({
        ...data,
        updatedAt: new Date(),
      })
      .where('id', '=', chatId)
      .returningAll()
      .executeTakeFirstOrThrow();

    return result;
  }

  async softDelete(chatId: string, trx?: KyselyTransaction): Promise<void> {
    const db = dbOrTx(this.db, trx);

    await db
      .updateTable('aiChats')
      .set({
        deletedAt: new Date(),
        updatedAt: new Date(),
      })
      .where('id', '=', chatId)
      .execute();
  }

  async findMessages(
    chatId: string,
    pagination: PaginationOptions,
    opts?: {
      trx?: KyselyTransaction;
    },
  ): Promise<{ items: AiChatMessage[]; hasMore: boolean }> {
    const db = dbOrTx(this.db, opts?.trx);

    const query = db
      .selectFrom('aiChatMessages')
      .selectAll('aiChatMessages')
      .where('chatId', '=', chatId)
      .where('deletedAt', 'is', null)
      .orderBy('createdAt', 'asc')
      .orderBy('id', 'asc');

    const result = await executeWithCursorPagination(query, {
      perPage: pagination.limit ?? 20,
      cursor: pagination.cursor,
      beforeCursor: pagination.beforeCursor,
      fields: [
        { expression: 'createdAt', direction: 'asc' },
        { expression: 'id', direction: 'asc' },
      ] as const,
      parseCursor: (decoded) => ({
        createdAt: new Date(decoded.createdAt),
        id: decoded.id,
      }),
    });

    return {
      items: result.items,
      hasMore: result.meta.hasNextPage,
    };
  }

  async createMessage(
    data: {
      chatId: string;
      workspaceId: string;
      userId: string | null;
      role: 'user' | 'assistant' | 'tool';
      content?: string;
      toolCalls?: Record<string, unknown>;
      metadata?: Record<string, unknown>;
    },
    trx?: KyselyTransaction,
  ): Promise<AiChatMessage> {
    const db = dbOrTx(this.db, trx);

    const result = await db
      .insertInto('aiChatMessages')
      .values({
        chatId: data.chatId,
        workspaceId: data.workspaceId,
        userId: data.userId,
        role: data.role,
        content: data.content,
        toolCalls: data.toolCalls ? JSON.stringify(data.toolCalls) : null,
        metadata: data.metadata ? JSON.stringify(data.metadata) : null,
      })
      .returningAll()
      .executeTakeFirstOrThrow();

    return result;
  }

  async updateMessage(
    messageId: string,
    data: {
      content?: string;
      toolCalls?: Record<string, unknown>;
      metadata?: Record<string, unknown>;
    },
    trx?: KyselyTransaction,
  ): Promise<AiChatMessage> {
    const db = dbOrTx(this.db, trx);

    const result = await db
      .updateTable('aiChatMessages')
      .set({
        ...data,
        toolCalls: data.toolCalls ? JSON.stringify(data.toolCalls) : undefined,
        metadata: data.metadata ? JSON.stringify(data.metadata) : undefined,
        updatedAt: new Date(),
      })
      .where('id', '=', messageId)
      .returningAll()
      .executeTakeFirstOrThrow();

    return result;
  }

  async appendToMessageContent(
    messageId: string,
    text: string,
    trx?: KyselyTransaction,
  ): Promise<void> {
    const db = dbOrTx(this.db, trx);

    await db
      .updateTable('aiChatMessages')
      .set({
        content: (eb) =>
          eb.fn('concat', [
            eb.ref('content'),
            eb.val(text),
          ]),
        updatedAt: new Date(),
      })
      .where('id', '=', messageId)
      .execute();
  }

  async findLastAssistantMessage(
    chatId: string,
    opts?: {
      trx?: KyselyTransaction;
    },
  ): Promise<AiChatMessage | null> {
    const db = dbOrTx(this.db, opts?.trx);

    return db
      .selectFrom('aiChatMessages')
      .selectAll('aiChatMessages')
      .where('chatId', '=', chatId)
      .where('role', '=', 'assistant')
      .where('deletedAt', 'is', null)
      .orderBy('createdAt', 'desc')
      .orderBy('id', 'desc')
      .executeTakeFirst();
  }

  private withCreator(eb: any) {
    return jsonObjectFrom(eb.selectFrom('users').select(['id', 'name', 'email', 'avatarUrl']).whereRef('users.id', '=', 'aiChats.creatorId'))
      .as('creator');
  }
}
