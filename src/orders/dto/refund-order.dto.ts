import { IsNotEmpty, IsString, IsNumber, Min, IsOptional } from 'class-validator';

export class RefundOrderDto {
  @IsNumber()
  @Min(0.01)
  @IsNotEmpty()
  amount: number;

  @IsString()
  @IsNotEmpty()
  reason: string;

  @IsString()
  @IsOptional()
  notes?: string;
}
