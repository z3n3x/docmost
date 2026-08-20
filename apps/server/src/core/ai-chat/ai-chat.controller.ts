import {
  BadRequestException,
  Body,
  Controller,
  Post,
  Res,
  UseGuards,
} from '@nestjs/common';
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

type AiChatReply = {
  raw: {
    setHeader(name: string, value: string): void;
    write(chunk: string): boolean;
    end(): void;
    on(event: string, listener: () => void): void;
    writableEnded: boolean;
  };
  hijack(): void;
};

@UseGuards(JwtAuthGuard)
@Controller('ai/chats')
export class AiChatController {
  constructor(private readonly aiChatService: AiChatService) {}

  @Post('/create')
  async create(
    @Body('spaceId') spaceId: string,
    @AuthUser() user: User,
    @AuthWorkspace() workspace: Workspace,
  ) {
    if (!spaceId) {
      throw new BadRequestException('spaceId is required');
    }
    return this.aiChatService.createChat(user, workspace, { spaceId });
  }

  @Post('/')
  async list(
    @AuthUser() user: User,
    @AuthWorkspace() workspace: Workspace,
    @Body('spaceId') spaceId?: string,
    @Body('limit') limit?: number,
    @Body('query') query?: string,
    @Body('adminView') adminView?: boolean,
  ) {
    const pagination: PaginationOptions = {
      limit: limit || 20,
      query: query || '',
      adminView: adminView || false,
    };
    return this.aiChatService.listChats(user, workspace, pagination, spaceId);
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

  @Post('/search')
  async search(
    @Body('query') query: string,
    @AuthUser() user: User,
    @AuthWorkspace() workspace: Workspace,
  ) {
    return [];
  }

  @Post('/messages')
  async getMessages(
    @Body('chatId') chatId: string,
    @AuthUser() user: User,
    @AuthWorkspace() workspace: Workspace,
    @Body('limit') limit?: number,
  ) {
    if (!chatId) {
      throw new BadRequestException('chatId is required');
    }
    return this.aiChatService.getChatMessages(chatId, user, workspace, limit);
  }

  @Post('/upload')
  async upload(
    @Body('file') file: any,
    @Body('chatId') chatId: string,
    @AuthUser() user: User,
    @AuthWorkspace() workspace: Workspace,
  ) {
    throw new BadRequestException('File upload not implemented yet');
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
    @Res() res: AiChatReply,
  ) {
    if (!content || content.trim().length === 0) {
      throw new BadRequestException('Content is required');
    }

    res.hijack();

    const raw = res.raw;
    raw.setHeader('Content-Type', 'text/event-stream');
    raw.setHeader('Cache-Control', 'no-cache');
    raw.setHeader('Connection', 'keep-alive');
    raw.setHeader('X-Accel-Buffering', 'no');

    const abortController = new AbortController();
    raw.on('close', () => abortController.abort());

    const sendEvent = (event: StreamEvent) => {
      if (!raw.writableEnded) {
        raw.write(`data: ${JSON.stringify(event)}\n\n`);
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
      if (!raw.writableEnded) {
        raw.end();
      }
    }
  }
}
