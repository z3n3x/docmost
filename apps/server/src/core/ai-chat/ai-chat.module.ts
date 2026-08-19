import { Module } from '@nestjs/common';
import { AiChatController } from './ai-chat.controller';
import { AiChatService } from './services/ai-chat.service';
import { AiProviderService } from './services/ai-provider.service';
import { AiRetrievalService } from './services/ai-retrieval.service';
import { SearchModule } from '../search/search.module';

@Module({
  imports: [SearchModule],
  controllers: [AiChatController],
  providers: [AiChatService, AiProviderService, AiRetrievalService],
})
export class AiChatModule {}
