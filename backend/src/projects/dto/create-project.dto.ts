import { IsNotEmpty, IsString, IsUrl } from 'class-validator';

export class CreateProjectDto {
  @IsString()
  @IsNotEmpty()
  name!: string;

  @IsString()
  @IsUrl({ require_protocol: true, require_tld: false })
  baseUrl!: string;
}
