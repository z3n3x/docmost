import { Injectable } from '@nestjs/common';
import { SearchService } from '../../search/search.service';
import { PagePermissionRepo } from '@docmost/db/repos/page/page-permission.repo';
import { PageRepo } from '@docmost/db/repos/page/page.repo';

export interface RetrievalResult {
  pageId: string;
  title: string;
  slugId: string;
  spaceId: string;
  content: string;
  rank: number;
}

@Injectable()
export class AiRetrievalService {
  constructor(
    private searchService: SearchService,
    private pagePermissionRepo: PagePermissionRepo,
    private pageRepo: PageRepo,
  ) {}

  /**
   * Поиск релевантных страниц с учетом прав доступа
   * Использует существующую модель авторизации Docmost
   */
  async retrieveContext(params: {
    query: string;
    userId: string;
    workspaceId: string;
    spaceId?: string;
    limit?: number;
    maxContentLength?: number;
  }): Promise<RetrievalResult[]> {
    const { query, userId, workspaceId, spaceId, limit = 5, maxContentLength = 3000 } = params;

    // Если запрос пустой, пробуем вернуть последние страницы из Space (fallback)
    const isQueryEmpty = !query || query.trim().length === 0;
    
    // Используем существующий поиск с permission filtering
    const searchResults = await this.searchService.searchPage(
      {
        query: isQueryEmpty ? '' : query.trim(),
        limit: isQueryEmpty ? limit : limit * 2, // Берем больше для поиска, потом отфильтруем
        spaceId: spaceId,
      },
      {
        userId,
        workspaceId,
      },
    );

    let items = searchResults.items || [];

    // Fallback: если поиск ничего не дал, берем последние страницы из Space
    if (items.length === 0 && spaceId) {
      this.logger.log(`No search results for "${query}", fetching recent pages from space ${spaceId}`);
      
      try {
        // Получаем страницы пространства напрямую через репозиторий
        const recentPagesResult = await this.pageRepo.getRecentPagesInSpace(spaceId, {
          limit: limit,
        });
        
        const recentPages = recentPagesResult.items || [];
        
        // Фильтруем по правам доступа
        const pageIds = recentPages.map(p => p.id);
        const accessibleIds = await this.pagePermissionRepo.filterAccessiblePageIds({
          pageIds,
          userId,
        });
        
        items = recentPages
          .filter(p => accessibleIds.includes(p.id))
          .map(page => ({
            id: page.id,
            title: page.title,
            slugId: page.slugId,
            rank: 0,
          }));
      } catch (error) {
        this.logger.error(`Failed to fetch recent pages: ${error.message}`);
      }
    }

    if (items.length === 0) {
      return [];
    }

    // Загружаем полный контент для доступных страниц
    const results: RetrievalResult[] = [];
    for (const item of items) {
      try {
        const page = await this.pageRepo.findById(item.id, {
          includeContent: true,
          includeTextContent: true,
        });

        if (page) {
          const truncatedContent = page.textContent || '';
          results.push({
            pageId: page.id,
            title: page.title || 'Untitled',
            slugId: page.slugId,
            spaceId: page.spaceId,
            content: truncatedContent.slice(0, maxContentLength),
            rank: item.rank || 0,
          });
        }
      } catch (error) {
        // Пропускаем страницы, которые не удалось загрузить
        continue;
      }
    }

    // Возвращаем топ-N результатов
    return results.slice(0, limit);
  }

  /**
   * Проверка доступа пользователя к странице
   * AI использует ту же модель прав, что и пользователь
   */
  async canAccessPage(pageId: string, userId: string): Promise<boolean> {
    const accessibleIds = await this.pagePermissionRepo.filterAccessiblePageIds({
      pageIds: [pageId],
      userId,
    });
    return accessibleIds.includes(pageId);
  }

  /**
   * Формирование контекста для LLM из найденных страниц
   */
  buildContextPrompt(retrievedPages: RetrievalResult[]): string {
    if (retrievedPages.length === 0) {
      return '';
    }

    const contextParts = retrievedPages.map((page, index) => {
      return `---
Page ${index + 1}: ${page.title}
Space ID: ${page.spaceId}
Slug: ${page.slugId}

${page.content}
---`;
    });

    return `Context from relevant pages:\n\n${contextParts.join('\n\n')}`;
  }
}
