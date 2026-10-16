import { IsNotEmpty, IsString, IsNumber, Min, IsOptional } from 'class-validator';

export class RefundOrderDto {
  @IsNumber({ maxDecimalPlaces: 2 }, { message: 'amount must not have more than 2 decimal places' })
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
