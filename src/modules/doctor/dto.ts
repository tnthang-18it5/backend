import { IsNotEmpty, IsString } from 'class-validator';

export class DoctorCreateDto {
  @IsString()
  @IsNotEmpty()
  title: string;
}
