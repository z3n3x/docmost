import { Injectable, BadRequestException, NotFoundException, ForbiddenException } from '@nestjs/common';
import { AiChatRepo } from '@docmost/db/repos/ai-chat/ai-chat.repo';
import { AiProviderService, ChatMessage, StreamCallback } from './ai-provider.service';
import { AiRetrievalService, RetrievalResult } from './ai-retrieval.service';
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
  type: 'chat_created' | 'content' | 'sources' | 'tool_call' | 'tool_result' | 'done' | 'error';
  chatId?: string;
  messageId?: string;
  text?: string;
  sources?: Array<{ pageId: string; title: string; slugId: string; spaceId: string }>;
  error?: string;
  code?: string;
  retryable?: boolean;
  usage?: { promptTokens: number; completionTokens: number };
}

@Injectable()
export class AiChatService {
  private readonly rateLimitWindowMs = 60 * 1000; // 1 минута
  private readonly rateLimitMaxRequests = 20; // 20 запросов в минуту
  private readonly userRequestTimestamps = new Map<string, number[]>();
  
  // Context limits
  private readonly maxQueryLength = 5000;
  private readonly maxRetrievedPages = 8;
  private readonly maxPageContentLength = 3000;
  private readonly maxContextTokens = 8000; // approximate

  constructor(
    private aiChatRepo: AiChatRepo,
    private aiProviderService: AiProviderService,
    private aiRetrievalService: AiRetrievalService,
    private spacePermissionService: SpacePermissionService,
    private pageAccessService: PageAccessService,
  ) {}

  /**
   * Rate limiting: проверка лимита запросов для пользователя
   */
  private checkRateLimit(userId: string): void {
    const now = Date.now();
    const timestamps = this.userRequestTimestamps.get(userId) || [];
    
    // Удаляем старые timestamp'ы за пределами окна
    const validTimestamps = timestamps.filter(ts => now - ts < this.rateLimitWindowMs);
    
    if (validTimestamps.length >= this.rateLimitMaxRequests) {
      throw new BadRequestException('Rate limit exceeded. Please try again later.');
    }
    
    validTimestamps.push(now);
    this.userRequestTimestamps.set(userId, validTimestamps);
  }

  /**
   * Создание нового чата с обязательным spaceId
   */
  async createChat(user: User, workspace: Workspace, params: CreateChatParams) {
    // Проверяем доступ пользователя к Space
    const hasAccess = await this.spacePermissionService.canAccessSpace(params.spaceId, user.id);
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

  /**
   * Получение списка чатов пользователя
   */
  async listChats(
    user: User,
    workspace: Workspace,
    pagination: PaginationOptions,
    spaceId?: string,
  ) {
    return this.aiChatRepo.findByWorkspaceAndCreator(workspace.id, user.id, pagination, spaceId);
  }

  /**
   * Получение информации о чате с сообщениями
   */
  async getChatInfo(chatId: string, user: User, workspace: Workspace) {
    const chat = await this.aiChatRepo.findById(chatId);
    
    if (!chat || chat.workspaceId !== workspace.id || chat.creatorId !== user.id) {
      throw new NotFoundException('Chat not found');
    }

    // Проверяем доступ к Space чата
    const hasSpaceAccess = await this.spacePermissionService.canAccessSpace(chat.spaceId, user.id);
    if (!hasSpaceAccess) {
      throw new ForbiddenException('You no longer have access to this space');
    }

    const messages = await this.aiChatRepo.findMessages(chatId, { 
      limit: 50,
      query: '',
      adminView: false,
    });
    
    return { chat, messages: messages.items };
  }

  /**
   * Удаление чата
   */
  async deleteChat(chatId: string, user: User, workspace: Workspace) {
    const chat = await this.aiChatRepo.findById(chatId);
    
    if (!chat || chat.workspaceId !== workspace.id || chat.creatorId !== user.id) {
      throw new NotFoundException('Chat not found');
    }

    await this.aiChatRepo.softDelete(chatId);
  }

  /**
   * Обновление названия чата
   */
  async updateChatTitle(chatId: string, title: string, user: User, workspace: Workspace) {
    const chat = await this.aiChatRepo.findById(chatId);
    
    if (!chat || chat.workspaceId !== workspace.id || chat.creatorId !== user.id) {
      throw new NotFoundException('Chat not found');
    }

    return this.aiChatRepo.update(chatId, { title });
  }

  /**
   * Отправка сообщения с streaming ответом
   */
  async sendMessageStream(
    params: SendMessageParams,
    user: User,
    workspace: Workspace,
    sendEvent: (event: StreamEvent) => void,
    signal?: AbortSignal,
  ): Promise<void> {
    // Rate limiting
    this.checkRateLimit(user.id);

    // Валидация длины запроса
    if (params.content.length > this.maxQueryLength) {
      throw new BadRequestException(`Query is too long. Maximum length is ${this.maxQueryLength} characters.`);
    }

    let chatId = params.chatId;
    let isNewChat = false;
    let spaceId: string | undefined;

    // Создаем новый чат если не указан
    if (!chatId) {
      // Для нового чата spaceId должен быть передан через контекст или параметры
      // В текущей реализации frontend передает spaceId при создании чата
      throw new BadRequestException('chatId is required. Create a new chat first with a spaceId.');
    } else {
      // Проверяем доступ к чату и получаем spaceId из чата
      const chat = await this.aiChatRepo.findById(chatId);
      if (!chat || chat.workspaceId !== workspace.id || chat.creatorId !== user.id) {
        sendEvent({ 
          type: 'error', 
          error: 'Chat not found', 
          code: 'NOT_FOUND',
          retryable: false 
        });
        return;
      }
      
      spaceId = chat.spaceId;
      
      // Проверяем доступ пользователя к Space чата
      const hasSpaceAccess = await this.spacePermissionService.canAccessSpace(spaceId, user.id);
      if (!hasSpaceAccess) {
        sendEvent({
          type: 'error',
          error: 'You no longer have access to this space',
          code: 'FORBIDDEN',
          retryable: false,
        });
        return;
      }
    }

    // Сохраняем сообщение пользователя
    const userMessage = await this.aiChatRepo.createMessage({
      chatId,
      workspaceId: workspace.id,
      userId: user.id,
      role: 'user',
      content: params.content,
    });

    // Retrieval: поиск релевантных страниц ТОЛЬКО в рамках Space чата
    const retrievedPages = await this.aiRetrievalService.retrieveContext({
      query: params.content,
      userId: user.id,
      workspaceId: workspace.id,
      spaceId: spaceId, // Обязательно ограничиваем Space чата
      limit: this.maxRetrievedPages,
      maxContentLength: this.maxPageContentLength,
    });

    // Формируем историю сообщений для контекста
    const recentMessages = await this.aiChatRepo.findMessages(chatId, { 
      limit: 10,
      query: '',
      adminView: false,
    });
    const messageHistory: ChatMessage[] = recentMessages.items.map(msg => ({
      role: msg.role as 'user' | 'assistant' | 'system',
      content: msg.content || '',
    }));

    // НЕ добавляем текущее сообщение - оно уже сохранено в БД и будет частью history при следующем запросе
    // LLM получит только предыдущие сообщения + retrieval context

    // Создаем сообщение для ответа ассистента
    const assistantMessage = await this.aiChatRepo.createMessage({
      chatId,
      workspaceId: workspace.id,
      userId: null,
      role: 'assistant',
      content: '',
      metadata: {
        citedPageIds: retrievedPages.map(p => p.pageId),
      },
    });

    let accumulatedContent = '';

    // Отправляем источники сразу после retrieval
    if (retrievedPages.length > 0) {
      sendEvent({
        type: 'sources',
        sources: retrievedPages.map(p => ({
          pageId: p.pageId,
          title: p.title,
          slugId: p.slugId,
          spaceId: p.spaceId,
        })),
      });
    }

    // Streaming callback
    const callback: StreamCallback = {
      onToken: async (token: string) => {
        accumulatedContent += token;
        sendEvent({ type: 'content', text: token });
        // НЕ делаем UPDATE во время streaming - накапливаем в памяти
      },
      onError: async (error: Error) => {
        sendEvent({ 
          type: 'error', 
          error: error.message, 
          code: 'GENERATION_ERROR',
          retryable: true 
        });
        
        // Обновляем сообщение об ошибке
        await this.aiChatRepo.updateMessage(assistantMessage.id, {
          metadata: { error: error.message },
        });
      },
      onComplete: async (usage) => {
        // ОДИН UPDATE после завершения генерации
        await this.aiChatRepo.updateMessage(assistantMessage.id, {
          content: accumulatedContent,
          metadata: {
            citedPageIds: retrievedPages.map(p => p.pageId),
            usage,
          },
        });
        
        sendEvent({ 
          type: 'done', 
          messageId: assistantMessage.id,
          usage: usage ? { ...usage } : undefined,
        });
      },
    };

    // Генерация ответа через LLM
    await this.aiProviderService.generateStream(
      messageHistory,
      retrievedPages,
      callback,
      signal,
    );
  }

  /**
   * Проверка доступа к странице для citations
   */
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

    const messages = await this.aiChatRepo.findMessages(chatId, { 
      limit: limit || 50,
      query: '',
      adminView: false,
    });
    
    return { items: messages.items };
  }
}
