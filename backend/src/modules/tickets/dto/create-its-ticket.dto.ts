import { IsBoolean, IsOptional, IsString } from 'class-validator';
import { CreateTicketDto } from './create-ticket.dto';

export class CreateITSTicketDto extends CreateTicketDto {
  // Borrow fields
  @IsBoolean()
  @IsOptional()
  borrowRequest?: boolean;

  @IsString()
  @IsOptional()
  borrowDetails?: string;

  // Maintenance fields
  @IsBoolean()
  @IsOptional()
  maintenanceDesktopLaptop?: boolean;

  @IsBoolean()
  @IsOptional()
  maintenanceInternetNetwork?: boolean;

  @IsBoolean()
  @IsOptional()
  maintenancePrinter?: boolean;

  @IsString()
  @IsOptional()
  maintenanceDetails?: string;
}
