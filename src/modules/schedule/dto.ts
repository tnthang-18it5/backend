import { IsNotEmpty, IsNumber, IsOptional, IsString } from 'class-validator';
import { Pagination } from '../../dto';

export class PatientRegistrationDto {
  @IsString()
  @IsNotEmpty()
  doctorId: string;

  @IsString()
  @IsNotEmpty()
  from: string;

  @IsString()
  @IsNotEmpty()
  to: string;
}
