import { Module } from '@nestjs/common';
import { SpaceService } from './services/space.service';
import { SpaceController } from './space.controller';
import { SpaceMemberService } from './services/space-member.service';
import { SpacePermissionService } from './services/space-permission.service';

@Module({
  imports: [],
  controllers: [SpaceController],
  providers: [SpaceService, SpaceMemberService, SpacePermissionService],
  exports: [SpaceService, SpaceMemberService, SpacePermissionService],
})
export class SpaceModule {}
