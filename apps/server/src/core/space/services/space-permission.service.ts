import { Injectable } from '@nestjs/common';
import { SpaceMemberRepo } from '@docmost/db/repos/space/space-member.repo';
import { GroupUserRepo } from '@docmost/db/repos/group/group-user.repo';
import { SpaceRepo } from '@docmost/db/repos/space/space.repo';

@Injectable()
export class SpacePermissionService {
  constructor(
    private spaceMemberRepo: SpaceMemberRepo,
    private groupUserRepo: GroupUserRepo,
    private spaceRepo: SpaceRepo,
  ) {}

  /**
   * Проверка доступа пользователя к Space
   * Использует существующую модель membership Docmost
   */
  async canAccessSpace(spaceId: string, userId: string, workspaceId?: string): Promise<boolean> {
    // Проверяем существование Space
    const space = workspaceId 
      ? await this.spaceRepo.findById(spaceId, workspaceId)
      : await this.spaceRepo.findById(spaceId, '');
    
    if (!space) {
      return false;
    }

    // Проверяем прямое членство пользователя в Space
    const directMembership = await this.spaceMemberRepo.getSpaceMemberByTypeId(
      spaceId,
      { userId },
    );
    
    if (directMembership) {
      return true;
    }

    // Проверяем членство через группы
    const userGroupIds = await this.groupUserRepo.getUserGroupIds(userId);
    if (userGroupIds && userGroupIds.length > 0) {
      // Более полная проверка по всем группам
      for (const groupId of userGroupIds) {
        const groupMember = await this.spaceMemberRepo.getSpaceMemberByTypeId(
          spaceId,
          { groupId },
        );
        if (groupMember) {
          return true;
        }
      }
    }

    // Если Space публичный (visibility = 'public'), разрешаем доступ на чтение
    if (space.visibility === 'public') {
      return true;
    }

    return false;
  }

  /**
   * Проверка существования Space
   */
  async spaceExists(spaceId: string, workspaceId: string): Promise<boolean> {
    const space = await this.spaceRepo.findById(spaceId, workspaceId);
    return !!space;
  }
}
