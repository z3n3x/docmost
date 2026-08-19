import { IsString, IsOptional, IsArray, IsNotEmpty, MaxLength } from 'class-validator';

export class CreateAiChatDto {
  @IsString()
  @IsNotEmpty()
  spaceId: string;

  @IsOptional()
  @IsString()
  @MaxLength(200)
  title?: string;
}

export class SendMessageDto {
  @IsOptional()
  @IsString()
  chatId?: string;

  @IsString()
  @IsNotEmpty()
  @MaxLength(5000)
  content: string;

  @IsOptional()
  @IsArray()
  @IsString({ each: true })
  mentionedPageIds?: string[];

  @IsOptional()
  @IsString()
  contextPageId?: string;

  @IsOptional()
  @IsArray()
  @IsString({ each: true })
  attachmentIds?: string[];
}

export class GetChatInfoDto {
  @IsString()
  @IsNotEmpty()
  chatId: string;
}

export class DeleteChatDto {
  @IsString()
  @IsNotEmpty()
  chatId: string;
}

export class UpdateChatTitleDto {
  @IsString()
  @IsNotEmpty()
  chatId: string;

  @IsString()
  @IsNotEmpty()
  @MaxLength(200)
  title: string;
}
