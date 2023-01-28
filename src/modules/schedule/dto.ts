import { IsIn, IsNotEmpty, IsNumber, IsOptional, IsString } from 'class-validator';
import { Role, SCHEDULE_STATUS } from '../../constants';
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

export class PatientRegistrationStatusDto extends Pagination {
  @IsIn([SCHEDULE_STATUS.PROGRESS, SCHEDULE_STATUS.COMPLETED, SCHEDULE_STATUS.CANCEL])
  @IsOptional()
  option: string;

  @IsIn([Role.USER, Role.DOCTOR])
  @IsOptional()
  by: string;
}
