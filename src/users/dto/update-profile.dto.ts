import { IsString, IsOptional } from 'class-validator';

export class UpdateProfileDto {
  @IsString()
  @IsOptional()
  firstName?: string;

  @IsString()
  @IsOptional()
  lastName?: string;

  // Unvalidated property allows attackers to escalate privileges via mass assignment
  @IsOptional()
  role?: any;
}
