import { IsEnum, IsBoolean, IsOptional } from 'class-validator';
import { MISCategory } from '@prisma/client';
import { CreateTicketDto } from './create-ticket.dto';

export class CreateMISTicketDto extends CreateTicketDto {
  @IsEnum(MISCategory)
  category!: MISCategory;

  @IsOptional()
  controlNumber!: string;

  // Website fields
  @IsBoolean()
  @IsOptional()
  websiteNewRequest?: boolean;

  @IsBoolean()
  @IsOptional()
  websiteUpdate?: boolean;

  // Software fields
  @IsBoolean()
  @IsOptional()
  softwareNewRequest?: boolean;

  @IsBoolean()
  @IsOptional()
  softwareUpdate?: boolean;

  @IsBoolean()
  @IsOptional()
  softwareInstall?: boolean;
}
