import { Injectable } from '@nestjs/common';
import { InjectKysely } from 'nestjs-kysely';
import { KyselyDB } from '@docmost/db/types/kysely.types';
import { PageRepo } from '@docmost/db/repos/page/page.repo';
import { PagePermissionRepo } from '@docmost/db/repos/page/page-permission.repo';
import { SearchService } from '../../search/search.service';
import { SearchDTO } from '../../search/dto/search.dto';

@Injectable()
export class AiRetrievalService {
  constructor(
    @InjectKysely() private readonly db: KyselyDB,
    private readonly searchService: SearchService,
    private readonly pageRepo: PageRepo,
    private readonly pagePermissionRepo: PagePermissionRepo,
  ) {}

  async retrieve(userId: string, workspaceId: string, spaceId: string, query: string) {
    let results: Array<{
      id: string;
      slugId: string;
      title: string;
      highlight?: string;
    }> = [];

    try {
      const search: SearchDTO = {
        query,
        spaceId,
        limit: 8,
        offset: 0,
      };
      const response = await this.searchService.searchPage(search, {
        userId,
        workspaceId,
      });
      results = response.items;
    } catch {
      // pg-tsquery can reject punctuation or natural-language input.
    }

    if (results.length === 0) {
      results = await this.fallbackTextSearch(workspaceId, spaceId, query);
    }

    if (results.length === 0) return [];

    const pageIds = results.map((item) => item.id);
    const accessibleIds = await this.pagePermissionRepo.filterAccessiblePageIds({
      pageIds,
      userId,
      spaceId,
    });
    const accessible = new Set(accessibleIds);

    const pages = await Promise.all(
      results
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

    return pages.filter(Boolean) as Array<{
      id: string;
      slugId: string;
      title: string;
      text: string;
      highlight: string;
    }>;
  }

  private async fallbackTextSearch(workspaceId: string, spaceId: string, query: string) {
    const terms = query
      .toLowerCase()
      .split(/\s+/)
      .map((term) => term.replace(/[^\p{L}\p{N}_-]/gu, ''))
      .filter((term) => term.length >= 2)
      .slice(0, 8);

    if (terms.length === 0) return [];

    return this.db
      .selectFrom('pages')
      .select(['id', 'slugId', 'title'])
      .where('workspaceId', '=', workspaceId)
      .where('spaceId', '=', spaceId)
      .where('deletedAt', 'is', null)
      .where((eb) =>
        eb.or(
          terms.map((term) =>
            eb.or([
              eb('title', 'ilike', `%${term}%`),
              eb('textContent', 'ilike', `%${term}%`),
            ]),
          ),
        ),
      )
      .limit(8)
      .execute();
  }
}
