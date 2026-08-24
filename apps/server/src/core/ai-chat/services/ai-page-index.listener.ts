import { Injectable, Logger } from '@nestjs/common';
import { OnEvent } from '@nestjs/event-emitter';
import { PageRepo } from '@docmost/db/repos/page/page.repo';
import { EventName } from '../../../common/events/event.contants';
import { AiVectorService } from './ai-vector.service';

interface PageEventPayload {
  id?: string;
  pageId?: string;
}

@Injectable()
export class AiPageIndexListener {
  private readonly logger = new Logger(AiPageIndexListener.name);

  constructor(
    private readonly pageRepo: PageRepo,
    private readonly vectorService: AiVectorService,
  ) {}

  @OnEvent(EventName.PAGE_CREATED, { async: true })
  @OnEvent(EventName.PAGE_UPDATED, { async: true })
  @OnEvent(EventName.PAGE_CONTENT_UPDATED, { async: true })
  async handlePageChanged(event: PageEventPayload | string): Promise<void> {
    const pageId = typeof event === 'string' ? event : event?.pageId || event?.id;
    if (!pageId) return;

    try {
      const page = await this.pageRepo.findById(pageId, {
        includeContent: false,
        includeTextContent: true,
      });

      if (!page || page.deletedAt || !page.textContent) {
        await this.vectorService.removePage(pageId);
        return;
      }

      await this.vectorService.indexPage({
        id: page.id,
        spaceId: page.spaceId,
        textContent: page.textContent,
      });
    } catch (error) {
      this.logger.warn(
        `Failed to update AI index for page ${pageId}: ${error instanceof Error ? error.message : String(error)}`,
      );
    }
  }

  @OnEvent(EventName.PAGE_DELETED, { async: true })
  @OnEvent(EventName.PAGE_SOFT_DELETED, { async: true })
  async handlePageDeleted(event: PageEventPayload | string): Promise<void> {
    const pageId = typeof event === 'string' ? event : event?.pageId || event?.id;
    if (!pageId) return;

    try {
      await this.vectorService.removePage(pageId);
    } catch (error) {
      this.logger.warn(
        `Failed to remove deleted page ${pageId} from AI index: ${error instanceof Error ? error.message : String(error)}`,
      );
    }
  }
}
