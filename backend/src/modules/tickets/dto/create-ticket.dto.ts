import { IsString, IsEnum, IsOptional, IsInt, MinLength } from 'class-validator';
import { TicketType, Priority } from '@prisma/client';

export class CreateTicketDto {
  @IsEnum(TicketType)
  type!: TicketType;

  @IsString()
  @MinLength(5)
  title!: string;

  @IsString()
  @MinLength(10)
  description!: string;

  @IsEnum(Priority)
  @IsOptional()
  priority?: Priority;

  @IsInt()
  @IsOptional()
  estimatedDuration?: number;
}
