import { IsEnum, IsOptional, IsString } from 'class-validator';
import { TicketStatus } from '@prisma/client';

export class UpdateTicketStatusDto {
  @IsEnum(TicketStatus)
  status!: TicketStatus;

  @IsString()
  @IsOptional()
  comment?: string;

  // Optional: developers can update the target completion date when changing status
  @IsString()
  @IsOptional()
  targetCompletionDate?: string;
}
