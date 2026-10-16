import { IsString, IsNotEmpty, IsOptional, ValidateIf } from 'class-validator';

export class UpdateProfileDto {
  @IsOptional()
  @ValidateIf((_, v) => v !== undefined)
  @IsString()
  @IsNotEmpty()
  firstName?: string;

  @IsOptional()
  @ValidateIf((_, v) => v !== undefined)
  @IsString()
  @IsNotEmpty()
  lastName?: string;
}
