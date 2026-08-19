import {
  BadRequestException,
  Body,
  Controller,
  Post,
  Res,
  UseGuards,
} from '@nestjs/common';
import { Response } from 'express';
import { User, Workspace } from '@docmost/db/types/entity.types';
import { AuthUser } from '../../common/decorators/auth-user.decorator';
import { AuthWorkspace } from '../../common/decorators/auth-workspace.decorator';
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard';
import { PaginationOptions } from '@docmost/db/pagination/pagination-options';
import {
  CreateAiChatDto,
  UpdateChatTitleDto,
} from './dto/ai-chat.dto';
import { AiChatService, StreamEvent } from './services/ai-chat.service';

@UseGuards(JwtAuthGuard)
@Controller('ai/chats')
export class AiChatController {
  constructor(private readonly aiChatService: AiChatService) {}

  @Post('/create')
  async create(
    @Body() dto: CreateAiChatDto,
    @AuthUser() user: User,
    @AuthWorkspace() workspace: Workspace,
  ) {
    return this.aiChatService.createChat(user, workspace, {
      spaceId: dto.spaceId,
      title: dto.title,
    });
  }

  @Post('/')
  async list(
    @AuthUser() user: User,
    @AuthWorkspace() workspace: Workspace,
    @Body() body?: PaginationOptions & { spaceId?: string },
  ) {
    return this.aiChatService.listChats(
      user,
      workspace,
      body || { limit: 20 },
      body?.spaceId,
    );
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
    @Body() dto: UpdateChatTitleDto,
    @AuthUser() user: User,
    @AuthWorkspace() workspace: Workspace,
  ) {
    return this.aiChatService.updateChatTitle(
      dto.chatId,
      dto.title,
      user,
      workspace,
    );
  }

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

    res.setHeader('Content-Type', 'text/event-stream');
    res.setHeader('Cache-Control', 'no-cache');
    res.setHeader('Connection', 'keep-alive');
    res.setHeader('X-Accel-Buffering', 'no');

    const abortController = new AbortController();
    res.on('close', () => abortController.abort());

    const sendEvent = (event: StreamEvent) => {
      if (!res.writableEnded) {
        res.write(`data: ${JSON.stringify(event)}\n\n`);
      }
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
      if (!res.writableEnded) {
        res.end();
      }
    }
  }
}
