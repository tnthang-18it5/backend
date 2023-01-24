import { IsNotEmpty, IsOptional, IsString } from 'class-validator';
import { Pagination } from '../../dto';

export class DoctorCreateDto {
  @IsString()
  @IsNotEmpty()
  title: string;
}

export class DoctorRequestDto extends Pagination {
  @IsString()
  @IsOptional()
  keyword: string;
}
