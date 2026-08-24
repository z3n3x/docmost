import { Module } from '@nestjs/common';
import { AiChatController } from './ai-chat.controller';
import { AiChatService } from './services/ai-chat.service';
import { AiProviderService } from './services/ai-provider.service';
import { AiRetrievalService } from './services/ai-retrieval.service';
import { AiEmbeddingService } from './services/ai-embedding.service';
import { AiVectorService } from './services/ai-vector.service';
import { AiPageIndexListener } from './services/ai-page-index.listener';
import { SearchModule } from '../search/search.module';
import { SpaceModule } from '../space/space.module';
import { AiChatRepo } from '@docmost/db/repos/ai-chat/ai-chat.repo';

@Module({
  imports: [SearchModule, SpaceModule],
  controllers: [AiChatController],
  providers: [
    AiChatService,
    AiProviderService,
    AiRetrievalService,
    AiEmbeddingService,
    AiVectorService,
    AiPageIndexListener,
    AiChatRepo,
  ],
  exports: [AiChatService, AiChatRepo],
})
export class AiChatModule {}
