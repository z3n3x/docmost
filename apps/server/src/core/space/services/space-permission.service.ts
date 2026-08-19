import { Injectable } from '@nestjs/common';
import { SpaceMemberRepo } from '@docmost/db/repos/space/space-member.repo';
import { GroupUserRepo } from '@docmost/db/repos/group/group-user.repo';
import { SpaceRepo } from '@docmost/db/repos/space/space.repo';

@Injectable()
export class SpacePermissionService {
  constructor(
    private readonly spaceMemberRepo: SpaceMemberRepo,
    private readonly groupUserRepo: GroupUserRepo,
    private readonly spaceRepo: SpaceRepo,
  ) {}

  async canAccessSpace(
    spaceId: string,
    userId: string,
    workspaceId: string,
  ): Promise<boolean> {
    const space = await this.spaceRepo.findByIdOnly(spaceId);
    if (!space || space.workspaceId !== workspaceId) {
      return false;
    }

    const directMembership = await this.spaceMemberRepo.getSpaceMemberByTypeId(
      spaceId,
      { userId },
    );
    if (directMembership) {
      return true;
    }

    const userGroupIds = await this.groupUserRepo.getUserGroupIds(userId);
    for (const groupId of userGroupIds || []) {
      const groupMembership = await this.spaceMemberRepo.getSpaceMemberByTypeId(
        spaceId,
        { groupId },
      );
      if (groupMembership) {
        return true;
      }
    }

    return space.visibility === 'public';
  }

  async spaceExists(spaceId: string, workspaceId?: string): Promise<boolean> {
    const space = await this.spaceRepo.findByIdOnly(spaceId);
    return !!space && (!workspaceId || space.workspaceId === workspaceId);
  }
}
