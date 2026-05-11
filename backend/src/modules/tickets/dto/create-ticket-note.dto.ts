import { IsString, IsBoolean, IsOptional, MinLength } from "class-validator";

export class CreateTicketNoteDto {
  @IsString()
  @MinLength(1)
  content!: string;

  @IsBoolean()
  @IsOptional()
  isInternal?: boolean;
}

export class UpdateTicketNoteDto {
  @IsBoolean()
  @IsOptional()
  isInternal?: boolean;

  @IsString()
  @MinLength(1)
  @IsOptional()
  content?: string;
}
