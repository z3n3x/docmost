import {
  BadRequestException,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { AiChatRepo } from '@docmost/db/repos/ai-chat/ai-chat.repo';
import { AiProviderService, ChatMessage, StreamCallback } from './ai-provider.service';
import { AiRetrievalService } from './ai-retrieval.service';
import { User, Workspace } from '@docmost/db/types/entity.types';
import { PaginationOptions } from '@docmost/db/pagination/pagination-options';
import { SpacePermissionService } from '../../space/services/space-permission.service';
import { PageAccessService } from '../../page/page-access/page-access.service';

export interface SendMessageParams {
  chatId?: string;
  content: string;
  mentionedPageIds?: string[];
  contextPageId?: string;
  attachmentIds?: string[];
}

export interface CreateChatParams {
  spaceId: string;
  title?: string;
}

export interface StreamEvent {
  type: 'content' | 'sources' | 'done' | 'error';
  chatId?: string;
  messageId?: string;
  text?: string;
  sources?: Array<{ pageId: string; title: string; slugId: string; spaceId: string }>;
  usage?: { promptTokens: number; completionTokens: number };
  error?: string;
  code?: string;
  retryable?: boolean;
}

@Injectable()
export class AiChatService {
  private readonly rateLimitWindowMs = 60 * 1000;
  private readonly rateLimitMaxRequests = 20;
  private readonly userRequestTimestamps = new Map<string, number[]>();
  private readonly maxQueryLength = 5000;
  private readonly maxRetrievedPages = 8;

  constructor(
    private readonly aiChatRepo: AiChatRepo,
    private readonly aiProviderService: AiProviderService,
    private readonly aiRetrievalService: AiRetrievalService,
    private readonly spacePermissionService: SpacePermissionService,
  ) {}

  private checkRateLimit(userId: string): void {
    const now = Date.now();
    const timestamps = this.userRequestTimestamps.get(userId) || [];
    const validTimestamps = timestamps.filter(
      (timestamp) => now - timestamp < this.rateLimitWindowMs,
    );

    if (validTimestamps.length >= this.rateLimitMaxRequests) {
      throw new BadRequestException('Rate limit exceeded. Please try again later.');
    }

    validTimestamps.push(now);
    this.userRequestTimestamps.set(userId, validTimestamps);
  }

  async createChat(user: User, workspace: Workspace, params: CreateChatParams) {
    const hasAccess = await this.spacePermissionService.canAccessSpace(
      params.spaceId,
      user.id,
      workspace.id,
    );

    if (!hasAccess) {
      throw new ForbiddenException('You do not have access to this space');
    }

    return this.aiChatRepo.create({
      workspaceId: workspace.id,
      spaceId: params.spaceId,
      creatorId: user.id,
      title: params.title,
    });
  }

  async listChats(
    user: User,
    workspace: Workspace,
    pagination: PaginationOptions,
    spaceId?: string,
  ) {
    return this.aiChatRepo.findByWorkspaceAndCreator(
      workspace.id,
      user.id,
      pagination,
      spaceId,
    );
  }

  async getChatInfo(chatId: string, user: User, workspace: Workspace) {
    const chat = await this.aiChatRepo.findById(chatId);

    if (!chat || chat.workspaceId !== workspace.id || chat.creatorId !== user.id) {
      throw new NotFoundException('Chat not found');
    }

    if (!chat.spaceId) {
      throw new NotFoundException('Chat is not associated with a Space');
    }

    const hasSpaceAccess = await this.spacePermissionService.canAccessSpace(
      chat.spaceId,
      user.id,
      workspace.id,
    );

    if (!hasSpaceAccess) {
      throw new ForbiddenException('You no longer have access to this space');
    }

    const messages = await this.aiChatRepo.findMessages(chat.id, { 
      limit: 50,
      query: '',
      adminView: false,
    });
    
    return { chat, messages: messages.items };
  }

  async deleteChat(chatId: string, user: User, workspace: Workspace) {
    const chat = await this.aiChatRepo.findById(chatId);

    if (!chat || chat.workspaceId !== workspace.id || chat.creatorId !== user.id) {
      throw new NotFoundException('Chat not found');
    }

    await this.aiChatRepo.softDelete(chatId);
  }

  async updateChatTitle(chatId: string, title: string, user: User, workspace: Workspace) {
    const chat = await this.aiChatRepo.findById(chatId);

    if (!chat || chat.workspaceId !== workspace.id || chat.creatorId !== user.id) {
      throw new NotFoundException('Chat not found');
    }

    return this.aiChatRepo.update(chatId, { title });
  }

  async sendMessageStream(
    params: SendMessageParams,
    user: User,
    workspace: Workspace,
    sendEvent: (event: StreamEvent) => void,
    signal?: AbortSignal,
  ): Promise<void> {
    this.checkRateLimit(user.id);

    const content = params.content.trim();
    if (content.length === 0) {
      throw new BadRequestException('Content is required');
    }
    if (content.length > this.maxQueryLength) {
      throw new BadRequestException(
        `Query is too long. Maximum length is ${this.maxQueryLength} characters.`,
      );
    }

    if (!params.chatId) {
      throw new BadRequestException(
        'chatId is required. Create a new chat first with a spaceId.',
      );
    }

    const chat = await this.aiChatRepo.findById(params.chatId);
    if (!chat || chat.workspaceId !== workspace.id || chat.creatorId !== user.id) {
      sendEvent({
        type: 'error',
        error: 'Chat not found',
        code: 'NOT_FOUND',
        retryable: false,
      });
      return;
    }

    if (!chat.spaceId) {
      sendEvent({
        type: 'error',
        error: 'Chat is not associated with a Space',
        code: 'INVALID_CHAT',
        retryable: false,
      });
      return;
    }

    const hasSpaceAccess = await this.spacePermissionService.canAccessSpace(
      chat.spaceId,
      user.id,
      workspace.id,
    );
    if (!hasSpaceAccess) {
      sendEvent({
        type: 'error',
        error: 'You no longer have access to this space',
        code: 'FORBIDDEN',
        retryable: false,
      });
      return;
    }

    await this.aiChatRepo.createMessage({
      chatId: chat.id,
      workspaceId: workspace.id,
      userId: user.id,
      role: 'user',
      content,
    });

    const retrievedPages = await this.aiRetrievalService.retrieveContext({
      query: content,
      userId: user.id,
      workspaceId: workspace.id,
      spaceId: chat.spaceId,
      limit: this.maxRetrievedPages,
    });

    // Формируем историю сообщений для контекста
    const recentMessages = await this.aiChatRepo.findMessages(chat.id, { 
      limit: 10,
      query: '',
      adminView: false,
    });
    const messageHistory: ChatMessage[] = recentMessages.items.map(msg => ({
      role: msg.role as 'user' | 'assistant' | 'system',
      content: msg.content || '',
    }));

    const assistantMessage = await this.aiChatRepo.createMessage({
      chatId: chat.id,
      workspaceId: workspace.id,
      userId: null,
      role: 'assistant',
      content: '',
      metadata: {
        citedPageIds: retrievedPages.map((page) => page.pageId),
      },
    });

    if (retrievedPages.length > 0) {
      sendEvent({
        type: 'sources',
        sources: retrievedPages.map((page) => ({
          pageId: page.pageId,
          title: page.title,
          slugId: page.slugId,
          spaceId: page.spaceId,
        })),
      });
    }

    let accumulatedContent = '';
    let generationFinished = false;

    const callback: StreamCallback = {
      onToken: async (token) => {
        accumulatedContent += token;
        sendEvent({ type: 'content', text: token });
      },
      onError: async (error) => {
        await this.aiChatRepo.updateMessage(assistantMessage.id, {
          content: accumulatedContent,
          metadata: {
            citedPageIds: retrievedPages.map((page) => page.pageId),
            error: error.message,
          },
        });
        sendEvent({
          type: 'error',
          error: error.message,
          code: 'GENERATION_ERROR',
          retryable: true,
        });
      },
      onComplete: async (usage) => {
        generationFinished = true;
        await this.aiChatRepo.updateMessage(assistantMessage.id, {
          content: accumulatedContent,
          metadata: {
            citedPageIds: retrievedPages.map((page) => page.pageId),
            usage,
          },
        });
        sendEvent({
          type: 'done',
          messageId: assistantMessage.id,
          usage,
        });
      },
    };

    await this.aiProviderService.generateStream(
      messageHistory,
      retrievedPages,
      callback,
      signal,
    );

    if (signal?.aborted && !generationFinished) {
      await this.aiChatRepo.updateMessage(assistantMessage.id, {
        content: accumulatedContent,
        metadata: {
          citedPageIds: retrievedPages.map((page) => page.pageId),
          aborted: true,
        },
      });
    }
  }

  async verifyPageAccess(pageId: string, userId: string): Promise<boolean> {
    return this.aiRetrievalService.canAccessPage(pageId, userId);
  }

  /**
   * Получение истории сообщений чата
   */
  async getChatMessages(
    chatId: string,
    user: User,
    workspace: Workspace,
    limit?: number,
  ): Promise<{ items: any[] }> {
    const chat = await this.aiChatRepo.findById(chatId);
    
    if (!chat || chat.workspaceId !== workspace.id || chat.creatorId !== user.id) {
      throw new NotFoundException('Chat not found');
    }

    // Проверяем доступ к Space чата
    const hasSpaceAccess = await this.spacePermissionService.canAccessSpace(chat.spaceId, user.id);
    if (!hasSpaceAccess) {
      throw new ForbiddenException('You no longer have access to this space');
    }

    const messages = await this.aiChatRepo.findMessages(chat.id, { 
      limit: limit || 50,
      query: '',
      adminView: false,
    });
    
    return { items: messages.items };
  }
}
