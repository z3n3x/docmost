import {
  Body,
  Controller,
  Post,
  UseGuards,
  Res,
  BadRequestException,
  NotFoundException,
} from '@nestjs/common';
import { Response } from 'express';
import { AiChatService, StreamEvent } from './services/ai-chat.service';
import { AuthUser } from '../../common/decorators/auth-user.decorator';
import { AuthWorkspace } from '../../common/decorators/auth-workspace.decorator';
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard';
import { User, Workspace } from '@docmost/db/types/entity.types';
import { PaginationOptions } from '@docmost/db/pagination/pagination-options';

@UseGuards(JwtAuthGuard)
@Controller('ai/chats')
export class AiChatController {
  constructor(private readonly aiChatService: AiChatService) {}

  @Post('/create')
  async create(@AuthUser() user: User, @AuthWorkspace() workspace: Workspace) {
    return this.aiChatService.createChat(user, workspace);
  }

  @Post('/')
  async list(
    @AuthUser() user: User,
    @AuthWorkspace() workspace: Workspace,
    @Body() pagination?: PaginationOptions,
  ) {
    return this.aiChatService.listChats(user, workspace, pagination || { limit: 20 });
  }

  @Post('/info')
  async info(
    @Body('chatId') chatId: string,
    @AuthUser() user: User,
    @AuthWorkspace() workspace: Workspace,
  ) {
    if (!chatId) {
      throw new BadRequestException('chatId is required');
    }
    return this.aiChatService.getChatInfo(chatId, user, workspace);
  }

  @Post('/delete')
  async delete(
    @Body('chatId') chatId: string,
    @AuthUser() user: User,
    @AuthWorkspace() workspace: Workspace,
  ) {
    if (!chatId) {
      throw new BadRequestException('chatId is required');
    }
    await this.aiChatService.deleteChat(chatId, user, workspace);
  }

  @Post('/update')
  async update(
    @Body('chatId') chatId: string,
    @Body('title') title: string,
    @AuthUser() user: User,
    @AuthWorkspace() workspace: Workspace,
  ) {
    if (!chatId || !title) {
      throw new BadRequestException('chatId and title are required');
    }
    return this.aiChatService.updateChatTitle(chatId, title, user, workspace);
  }

  @Post('/search')
  async search(
    @Body('query') query: string,
    @AuthUser() user: User,
    @AuthWorkspace() workspace: Workspace,
  ) {
    // TODO: реализовать поиск по чатам
    return [];
  }

  @Post('/upload')
  async upload(
    @Body('file') file: any,
    @Body('chatId') chatId: string,
    @AuthUser() user: User,
    @AuthWorkspace() workspace: Workspace,
  ) {
    // TODO: реализовать загрузку файлов
    throw new BadRequestException('File upload not implemented yet');
  }

  /**
   * SSE streaming endpoint для отправки сообщений
   */
  @Post('/send')
  async send(
    @Body('chatId') chatId: string | undefined,
    @Body('content') content: string,
    @Body('mentionedPageIds') mentionedPageIds: string[] | undefined,
    @Body('contextPageId') contextPageId: string | undefined,
    @Body('attachmentIds') attachmentIds: string[] | undefined,
    @AuthUser() user: User,
    @AuthWorkspace() workspace: Workspace,
    @Res() res: Response,
  ) {
    if (!content || content.trim().length === 0) {
      throw new BadRequestException('Content is required');
    }

    // Устанавливаем SSE headers
    res.setHeader('Content-Type', 'text/event-stream');
    res.setHeader('Cache-Control', 'no-cache');
    res.setHeader('Connection', 'keep-alive');
    res.setHeader('X-Accel-Buffering', 'no');

    const abortController = new AbortController();
    
    // Обработка отключения клиента
    res.on('close', () => {
      abortController.abort();
    });

    const sendEvent = (event: StreamEvent) => {
      res.write(`data: ${JSON.stringify(event)}\n\n`);
    };

    try {
      await this.aiChatService.sendMessageStream(
        {
          chatId,
          content,
          mentionedPageIds,
          contextPageId,
          attachmentIds,
        },
        user,
        workspace,
        sendEvent,
        abortController.signal,
      );
    } catch (error) {
      sendEvent({
        type: 'error',
        error: error instanceof Error ? error.message : 'Unknown error',
        code: 'INTERNAL_ERROR',
        retryable: true,
      });
    } finally {
      res.end();
    }
  }
}
