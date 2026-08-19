import { Injectable, BadRequestException, NotFoundException } from '@nestjs/common';
import { AiChatRepo } from '@docmost/db/repos/ai-chat/ai-chat.repo';
import { AiProviderService, ChatMessage, StreamCallback } from './ai-provider.service';
import { AiRetrievalService, RetrievalResult } from './ai-retrieval.service';
import { User, Workspace } from '@docmost/db/types/entity.types';
import { PaginationOptions } from '@docmost/db/pagination/pagination-options';

export interface SendMessageParams {
  chatId?: string;
  content: string;
  mentionedPageIds?: string[];
  contextPageId?: string;
  attachmentIds?: string[];
}

export interface StreamEvent {
  type: 'chat_created' | 'content' | 'tool_call' | 'tool_result' | 'done' | 'error';
  chatId?: string;
  messageId?: string;
  text?: string;
  error?: string;
  code?: string;
  retryable?: boolean;
}

@Injectable()
export class AiChatService {
  private readonly rateLimitWindowMs = 60 * 1000; // 1 минута
  private readonly rateLimitMaxRequests = 20; // 20 запросов в минуту
  private readonly userRequestTimestamps = new Map<string, number[]>();

  constructor(
    private aiChatRepo: AiChatRepo,
    private aiProviderService: AiProviderService,
    private aiRetrievalService: AiRetrievalService,
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
   * Создание нового чата
   */
  async createChat(user: User, workspace: Workspace) {
    return this.aiChatRepo.create({
      workspaceId: workspace.id,
      creatorId: user.id,
    });
  }

  /**
   * Получение списка чатов пользователя
   */
  async listChats(user: User, workspace: Workspace, pagination: PaginationOptions) {
    return this.aiChatRepo.findByWorkspaceAndCreator(workspace.id, user.id, pagination);
  }

  /**
   * Получение информации о чате с сообщениями
   */
  async getChatInfo(chatId: string, user: User, workspace: Workspace) {
    const chat = await this.aiChatRepo.findById(chatId);
    
    if (!chat || chat.workspaceId !== workspace.id || chat.creatorId !== user.id) {
      throw new NotFoundException('Chat not found');
    }

    const messages = await this.aiChatRepo.findMessages(chatId, { limit: 50 });
    
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

    let chatId = params.chatId;
    let isNewChat = false;

    // Создаем новый чат если не указан
    if (!chatId) {
      const chat = await this.createChat(user, workspace);
      chatId = chat.id;
      isNewChat = true;
      sendEvent({ type: 'chat_created', chatId });
    } else {
      // Проверяем доступ к чату
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
    }

    // Сохраняем сообщение пользователя
    const userMessage = await this.aiChatRepo.createMessage({
      chatId,
      workspaceId: workspace.id,
      userId: user.id,
      role: 'user',
      content: params.content,
    });

    // Retrieval: поиск релевантных страниц
    const retrievedPages = await this.aiRetrievalService.retrieveContext({
      query: params.content,
      userId: user.id,
      workspaceId: workspace.id,
      spaceId: undefined, // Можно ограничить текущим space
      limit: 5,
    });

    // Формируем историю сообщений для контекста
    const recentMessages = await this.aiChatRepo.findMessages(chatId, { limit: 10 });
    const messageHistory: ChatMessage[] = recentMessages.items.map(msg => ({
      role: msg.role as 'user' | 'assistant' | 'system',
      content: msg.content || '',
    }));

    // Добавляем текущее сообщение
    messageHistory.push({ role: 'user', content: params.content });

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

    // Streaming callback
    const callback: StreamCallback = {
      onToken: async (token: string) => {
        accumulatedContent += token;
        sendEvent({ type: 'content', text: token });
        
        // Периодически обновляем сообщение в БД (каждые ~100 токенов)
        if (accumulatedContent.length % 100 < token.length) {
          await this.aiChatRepo.appendToMessageContent(assistantMessage.id, token);
        }
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
        // Финальное обновление сообщения
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
}
