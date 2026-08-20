import { Module } from '@nestjs/common';
import { SpaceService } from './services/space.service';
import { SpaceController } from './space.controller';
import { SpaceMemberService } from './services/space-member.service';
import { SpacePermissionService } from './services/space-permission.service';
import { SpaceMemberRepo } from '@docmost/db/repos/space/space-member.repo';
import { GroupUserRepo } from '@docmost/db/repos/group/group-user.repo';
import { SpaceRepo } from '@docmost/db/repos/space/space.repo';

@Module({
  imports: [],
  controllers: [SpaceController],
  providers: [
    SpaceService,
    SpaceMemberService,
    SpacePermissionService,
    SpaceMemberRepo,
    GroupUserRepo,
    SpaceRepo,
  ],
  exports: [SpaceService, SpaceMemberService, SpacePermissionService],
})
export class SpaceModule {}
