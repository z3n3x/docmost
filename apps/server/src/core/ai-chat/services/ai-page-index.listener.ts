import { Injectable, Logger } from '@nestjs/common';
import { OnEvent } from '@nestjs/event-emitter';
import { PageRepo } from '@docmost/db/repos/page/page.repo';
import { AiVectorService } from './ai-vector.service';

export const AI_PAGE_CHANGED_EVENT = 'ai.page.changed';

interface AiPageChangedEvent {
  pageId: string;
  deleted?: boolean;
}

@Injectable()
export class AiPageIndexListener {
  private readonly logger = new Logger(AiPageIndexListener.name);

  constructor(
    private readonly pageRepo: PageRepo,
    private readonly vectorService: AiVectorService,
  ) {}

  @OnEvent(AI_PAGE_CHANGED_EVENT, { async: true })
  async handlePageChanged(event: AiPageChangedEvent): Promise<void> {
    try {
      if (event.deleted) {
        await this.vectorService.removePage(event.pageId);
        return;
      }

      const page = await this.pageRepo.findById(event.pageId, {
        includeContent: false,
        includeTextContent: true,
      });

      if (!page || page.deletedAt || !page.textContent) {
        await this.vectorService.removePage(event.pageId);
        return;
      }

      await this.vectorService.indexPage({
        id: page.id,
        spaceId: page.spaceId,
        textContent: page.textContent,
      });
    } catch (error) {
      this.logger.warn(
        `Failed to update AI index for page ${event.pageId}: ${error instanceof Error ? error.message : String(error)}`,
      );
    }
  }
}
