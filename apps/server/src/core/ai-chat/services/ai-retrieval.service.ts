import { Injectable } from '@nestjs/common';
import { PageRepo } from '@docmost/db/repos/page/page.repo';
import { PagePermissionRepo } from '@docmost/db/repos/page/page-permission.repo';
import { SearchService } from '../../search/search.service';
import { SearchDTO } from '../../search/dto/search.dto';

@Injectable()
export class AiRetrievalService {
  constructor(
    private readonly searchService: SearchService,
    private readonly pageRepo: PageRepo,
    private readonly pagePermissionRepo: PagePermissionRepo,
  ) {}

  async retrieve(userId: string, workspaceId: string, spaceId: string, query: string) {
    const search: SearchDTO = {
      query,
      spaceId,
      limit: 8,
      offset: 0,
    };

    const results = await this.searchService.searchPage(search, {
      userId,
      workspaceId,
    });

    if (results.items.length === 0) return [];

    const pageIds = results.items.map((item) => item.id);
    const accessibleIds = await this.pagePermissionRepo.filterAccessiblePageIds({
      pageIds,
      userId,
      spaceId,
    });
    const accessible = new Set(accessibleIds);

    const pages = await Promise.all(
      results.items
        .filter((item) => accessible.has(item.id))
        .map(async (item) => {
          const page = await this.pageRepo.findById(item.id, {
            includeContent: false,
            includeSpace: true,
          });

          return page
            ? {
                id: page.id,
                slugId: page.slugId,
                title: page.title,
                text: page.textContent ?? '',
                highlight: item.highlight ?? '',
              }
            : null;
        }),
    );

    return pages.filter(Boolean);
  }
}
