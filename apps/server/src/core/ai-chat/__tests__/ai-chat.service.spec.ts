import { Test, TestingModule } from '@nestjs/testing';
import { AiChatService } from '../services/ai-chat.service';
import { AiChatRepo } from '@docmost/db/repos/ai-chat/ai-chat.repo';
import { AiProviderService } from '../services/ai-provider.service';
import { AiRetrievalService } from '../services/ai-retrieval.service';
import { SpacePermissionService } from '../../space/services/space-permission.service';
import { PageAccessService } from '../../page/page-access/page-access.service';
import { BadRequestException, ForbiddenException, NotFoundException } from '@nestjs/common';
import { User, Workspace } from '@docmost/db/types/entity.types';

describe('AiChatService', () => {
  let service: AiChatService;
  let aiChatRepo: jest.Mocked<AiChatRepo>;
  let aiProviderService: jest.Mocked<AiProviderService>;
  let aiRetrievalService: jest.Mocked<AiRetrievalService>;
  let spacePermissionService: jest.Mocked<SpacePermissionService>;
  let pageAccessService: jest.Mocked<PageAccessService>;

  const mockUser: User = {
    id: 'user-123',
    email: 'test@example.com',
    name: 'Test User',
  } as User;

  const mockWorkspace: Workspace = {
    id: 'workspace-123',
    name: 'Test Workspace',
  } as Workspace;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        AiChatService,
        {
          provide: AiChatRepo,
          useValue: {
            create: jest.fn(),
            findById: jest.fn(),
            findByWorkspaceAndCreator: jest.fn(),
            softDelete: jest.fn(),
            update: jest.fn(),
            findMessages: jest.fn(),
            createMessage: jest.fn(),
            updateMessage: jest.fn(),
          },
        },
        {
          provide: AiProviderService,
          useValue: {
            generateStream: jest.fn(),
          },
        },
        {
          provide: AiRetrievalService,
          useValue: {
            retrieveContext: jest.fn(),
            canAccessPage: jest.fn(),
          },
        },
        {
          provide: SpacePermissionService,
          useValue: {
            canAccessSpace: jest.fn(),
            spaceExists: jest.fn(),
          },
        },
        {
          provide: PageAccessService,
          useValue: {},
        },
      ],
    }).compile();

    service = module.get<AiChatService>(AiChatService);
    aiChatRepo = module.get(AiChatRepo);
    aiProviderService = module.get(AiProviderService);
    aiRetrievalService = module.get(AiRetrievalService);
    spacePermissionService = module.get(SpacePermissionService);
    pageAccessService = module.get(PageAccessService);
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  describe('createChat', () => {
    it('should create a chat when user has access to space', async () => {
      const spaceId = 'space-123';
      spacePermissionService.canAccessSpace.mockResolvedValue(true);
      aiChatRepo.create.mockResolvedValue({
        id: 'chat-123',
        workspaceId: mockWorkspace.id,
        spaceId,
        creatorId: mockUser.id,
        title: null,
      } as any);

      const result = await service.createChat(mockUser, mockWorkspace, { spaceId });

      expect(spacePermissionService.canAccessSpace).toHaveBeenCalledWith(spaceId, mockUser.id);
      expect(aiChatRepo.create).toHaveBeenCalledWith({
        workspaceId: mockWorkspace.id,
        spaceId,
        creatorId: mockUser.id,
        title: undefined,
      });
      expect(result.id).toBe('chat-123');
    });

    it('should throw ForbiddenException when user does not have access to space', async () => {
      const spaceId = 'space-456';
      spacePermissionService.canAccessSpace.mockResolvedValue(false);

      await expect(
        service.createChat(mockUser, mockWorkspace, { spaceId }),
      ).rejects.toThrow(ForbiddenException);

      expect(spacePermissionService.canAccessSpace).toHaveBeenCalledWith(spaceId, mockUser.id);
      expect(aiChatRepo.create).not.toHaveBeenCalled();
    });
  });

  describe('getChatInfo', () => {
    it('should return chat info when user is the creator and has space access', async () => {
      const chatId = 'chat-123';
      const spaceId = 'space-123';
      const mockChat = {
        id: chatId,
        workspaceId: mockWorkspace.id,
        spaceId,
        creatorId: mockUser.id,
      } as any;

      aiChatRepo.findById.mockResolvedValue(mockChat);
      spacePermissionService.canAccessSpace.mockResolvedValue(true);
      aiChatRepo.findMessages.mockResolvedValue({ items: [], hasMore: false });

      const result = await service.getChatInfo(chatId, mockUser, mockWorkspace);

      expect(result.chat).toEqual(mockChat);
      expect(spacePermissionService.canAccessSpace).toHaveBeenCalledWith(spaceId, mockUser.id);
    });

    it('should throw NotFoundException when chat does not exist', async () => {
      aiChatRepo.findById.mockResolvedValue(null);

      await expect(
        service.getChatInfo('non-existent-chat', mockUser, mockWorkspace),
      ).rejects.toThrow(NotFoundException);
    });

    it('should throw NotFoundException when user is not the creator', async () => {
      const otherUser = { id: 'other-user' } as User;
      const mockChat = {
        id: 'chat-123',
        workspaceId: mockWorkspace.id,
        creatorId: 'other-user-id',
      } as any;

      aiChatRepo.findById.mockResolvedValue(mockChat);

      await expect(
        service.getChatInfo('chat-123', mockUser, mockWorkspace),
      ).rejects.toThrow(NotFoundException);
    });

    it('should throw ForbiddenException when user lost access to space', async () => {
      const chatId = 'chat-123';
      const mockChat = {
        id: chatId,
        workspaceId: mockWorkspace.id,
        spaceId: 'space-123',
        creatorId: mockUser.id,
      } as any;

      aiChatRepo.findById.mockResolvedValue(mockChat);
      spacePermissionService.canAccessSpace.mockResolvedValue(false);

      await expect(
        service.getChatInfo(chatId, mockUser, mockWorkspace),
      ).rejects.toThrow(ForbiddenException);
    });
  });

  describe('deleteChat', () => {
    it('should delete chat when user is the creator', async () => {
      const chatId = 'chat-123';
      const mockChat = {
        id: chatId,
        workspaceId: mockWorkspace.id,
        creatorId: mockUser.id,
      } as any;

      aiChatRepo.findById.mockResolvedValue(mockChat);
      aiChatRepo.softDelete.mockResolvedValue(undefined);

      await service.deleteChat(chatId, mockUser, mockWorkspace);

      expect(aiChatRepo.softDelete).toHaveBeenCalledWith(chatId);
    });

    it('should throw NotFoundException when trying to delete another users chat', async () => {
      const mockChat = {
        id: 'chat-123',
        workspaceId: mockWorkspace.id,
        creatorId: 'other-user-id',
      } as any;

      aiChatRepo.findById.mockResolvedValue(mockChat);

      await expect(
        service.deleteChat('chat-123', mockUser, mockWorkspace),
      ).rejects.toThrow(NotFoundException);
    });
  });

  describe('checkRateLimit', () => {
    it('should allow requests within rate limit', () => {
      // First 20 requests should succeed
      for (let i = 0; i < 20; i++) {
        expect(() => (service as any).checkRateLimit(mockUser.id)).not.toThrow();
      }
    });

    it('should throw BadRequestException when rate limit exceeded', () => {
      // Make 20 requests to fill the window
      for (let i = 0; i < 20; i++) {
        (service as any).checkRateLimit(mockUser.id);
      }

      // 21st request should fail
      expect(() => (service as any).checkRateLimit(mockUser.id)).toThrow(BadRequestException);
    });
  });
});
