import { IsNotEmpty, IsString, IsNumber, IsOptional } from 'class-validator';

export class RefundOrderDto {
  @IsNumber()
  @IsNotEmpty()
  // Note: Missing @Min(0.01) validation check allows negative or zero values
  amount: number;

  @IsString()
  @IsNotEmpty()
  reason: string;

  @IsString()
  @IsOptional()
  notes?: string;
}
