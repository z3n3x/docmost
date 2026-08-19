import { IsNotEmpty, IsString, IsUUID, MaxLength } from 'class-validator';

export class AiChatDto {
  @IsUUID()
  spaceId: string;

  @IsString()
  @IsNotEmpty()
  @MaxLength(4000)
  message: string;
}
