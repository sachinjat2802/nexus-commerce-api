import {
  IsArray,
  ValidateNested,
  ArrayMinSize,
  ArrayMaxSize,
  IsString,
  IsNotEmpty,
  IsInt,
  Min,
} from 'class-validator';
import { Type } from 'class-transformer';

export class BatchReserveItemDto {
  @IsString()
  @IsNotEmpty()
  productId: string;

  // Enforce integer quantities (Fixes fractional stock decrement)
  @IsInt()
  @Min(1)
  quantity: number;
}

export class BatchReserveDto {
  @IsArray()
  @ArrayMinSize(1)
  @ArrayMaxSize(50) // Bound batch size to prevent sequential load starvation
  @ValidateNested({ each: true })
  @Type(() => BatchReserveItemDto)
  items: BatchReserveItemDto[];
}
