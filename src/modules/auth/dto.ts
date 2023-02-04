import { IsEmail, IsNotEmpty, IsString, IsOptional } from 'class-validator';

export class AccountDto {
  @IsNotEmpty()
  @IsEmail()
  email: string;

  @IsString()
  @IsNotEmpty()
  password: string;
}

export class VerifyEmailDto {
  @IsString()
  @IsNotEmpty()
  token: string;
}

export class ProfileUpdateDto {
  @IsOptional()
  @IsString()
  firstName: string;

  @IsOptional()
  @IsString()
  lastName: string;

  @IsOptional()
  @IsString()
  phone: string;

  @IsOptional()
  @IsString()
  gender: string;

  @IsOptional()
  @IsString()
  birthday: string;

  @IsOptional()
  @IsString()
  address: string;

  @IsOptional()
  @IsString()
  degree: string;

  @IsOptional()
  @IsString()
  experience: string;

  @IsOptional()
  @IsString()
  job: string;

  @IsOptional()
  @IsString()
  numberId: string;
}
