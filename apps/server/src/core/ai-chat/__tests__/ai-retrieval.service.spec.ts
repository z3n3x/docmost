import { Test, TestingModule } from '@nestjs/testing';
import { AiRetrievalService } from '../ai-retrieval.service';
import { SearchService } from '../../search/search.service';
import { PagePermissionRepo } from '@docmost/db/repos/page/page-permission.repo';
import { PageRepo } from '@docmost/db/repos/page/page.repo';

describe('AiRetrievalService', () => {
  let service: AiRetrievalService;
  let searchService: jest.Mocked<SearchService>;
  let pagePermissionRepo: jest.Mocked<PagePermissionRepo>;
  let pageRepo: jest.Mocked<PageRepo>;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        AiRetrievalService,
        {
          provide: SearchService,
          useValue: {
            searchPage: jest.fn(),
          },
        },
        {
          provide: PagePermissionRepo,
          useValue: {
            filterAccessiblePageIds: jest.fn(),
          },
        },
        {
          provide: PageRepo,
          useValue: {
            findById: jest.fn(),
          },
        },
      ],
    }).compile();

    service = module.get<AiRetrievalService>(AiRetrievalService);
    searchService = module.get(SearchService);
    pagePermissionRepo = module.get(PagePermissionRepo);
    pageRepo = module.get(PageRepo);
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  describe('retrieveContext', () => {
    it('should return empty array for empty query', async () => {
      const result = await service.retrieveContext({
        query: '',
        userId: 'user-123',
        workspaceId: 'workspace-123',
      });

      expect(result).toEqual([]);
      expect(searchService.searchPage).not.toHaveBeenCalled();
    });

    it('should retrieve pages within specified space only', async () => {
      const spaceId = 'space-123';
      const mockSearchResults = {
        items: [
          { id: 'page-1', rank: 1 },
          { id: 'page-2', rank: 2 },
        ],
      };

      searchService.searchPage.mockResolvedValue(mockSearchResults as any);
      pageRepo.findById.mockResolvedValue({
        id: 'page-1',
        title: 'Test Page',
        slugId: 'test-page',
        spaceId,
        textContent: 'Page content here',
      } as any);

      const result = await service.retrieveContext({
        query: 'test query',
        userId: 'user-123',
        workspaceId: 'workspace-123',
        spaceId,
        limit: 5,
      });

      expect(searchService.searchPage).toHaveBeenCalledWith(
        expect.objectContaining({
          spaceId,
          query: 'test query',
        }),
        expect.any(Object),
      );
      expect(result.length).toBeGreaterThan(0);
      expect(result[0].spaceId).toBe(spaceId);
    });

    it('should truncate page content to maxContentLength', async () => {
      const longContent = 'a'.repeat(5000);
      searchService.searchPage.mockResolvedValue({
        items: [{ id: 'page-1', rank: 1 }],
      } as any);
      pageRepo.findById.mockResolvedValue({
        id: 'page-1',
        title: 'Test Page',
        slugId: 'test-page',
        spaceId: 'space-123',
        textContent: longContent,
      } as any);

      const result = await service.retrieveContext({
        query: 'test',
        userId: 'user-123',
        workspaceId: 'workspace-123',
        maxContentLength: 1000,
      });

      expect(result[0].content.length).toBeLessThanOrEqual(1000);
    });

    it('should skip pages that fail to load', async () => {
      searchService.searchPage.mockResolvedValue({
        items: [
          { id: 'page-1', rank: 1 },
          { id: 'page-2', rank: 2 },
        ],
      } as any);

      pageRepo.findById
        .mockResolvedValueOnce({
          id: 'page-1',
          title: 'Valid Page',
          slugId: 'valid-page',
          spaceId: 'space-123',
          textContent: 'content',
        } as any)
        .mockRejectedValueOnce(new Error('Page not found'));

      const result = await service.retrieveContext({
        query: 'test',
        userId: 'user-123',
        workspaceId: 'workspace-123',
      });

      expect(result.length).toBe(1);
      expect(result[0].title).toBe('Valid Page');
    });
  });

  describe('canAccessPage', () => {
    it('should return true when page is accessible', async () => {
      pagePermissionRepo.filterAccessiblePageIds.mockResolvedValue(['page-123']);

      const result = await service.canAccessPage('page-123', 'user-123');

      expect(result).toBe(true);
      expect(pagePermissionRepo.filterAccessiblePageIds).toHaveBeenCalledWith({
        pageIds: ['page-123'],
        userId: 'user-123',
      });
    });

    it('should return false when page is not accessible', async () => {
      pagePermissionRepo.filterAccessiblePageIds.mockResolvedValue([]);

      const result = await service.canAccessPage('page-123', 'user-123');

      expect(result).toBe(false);
    });
  });

  describe('buildContextPrompt', () => {
    it('should return empty string for no pages', () => {
      const result = service.buildContextPrompt([]);
      expect(result).toBe('');
    });

    it('should format context prompt with page information', () => {
      const pages = [
        {
          pageId: 'page-1',
          title: 'Page One',
          slugId: 'page-one',
          spaceId: 'space-1',
          content: 'Content one',
          rank: 1,
        },
        {
          pageId: 'page-2',
          title: 'Page Two',
          slugId: 'page-two',
          spaceId: 'space-1',
          content: 'Content two',
          rank: 2,
        },
      ];

      const result = service.buildContextPrompt(pages);

      expect(result).toContain('Context from relevant pages');
      expect(result).toContain('Page 1: Page One');
      expect(result).toContain('Page 2: Page Two');
      expect(result).toContain('Space ID: space-1');
    });
  });
});
