import { IsString, IsNotEmpty, IsOptional, ValidateIf } from 'class-validator';
import { Transform } from 'class-transformer';

export class UpdateProfileDto {
  @IsOptional()
  @ValidateIf((_, v) => v !== undefined)
  @Transform(({ value }) => (typeof value === 'string' ? value.trim() : value))
  @IsString()
  @IsNotEmpty({ message: 'firstName cannot be empty or whitespace' })
  firstName?: string;

  @IsOptional()
  @ValidateIf((_, v) => v !== undefined)
  @Transform(({ value }) => (typeof value === 'string' ? value.trim() : value))
  @IsString()
  @IsNotEmpty({ message: 'lastName cannot be empty or whitespace' })
  lastName?: string;
}
