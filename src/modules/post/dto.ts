import { IsNotEmpty, IsOptional, IsString } from 'class-validator';
import { Pagination } from '../../dto';

export class PostRequestDto extends Pagination {
  @IsString()
  @IsOptional()
  keyword: string;
}
