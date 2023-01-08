import { IsNumber, IsOptional } from 'class-validator';
import { Request } from 'express';

export class Pagination {
  @IsNumber()
  @IsOptional()
  page: number;

  @IsNumber()
  @IsOptional()
  size: number;
}

export interface AuthRequest extends Request {
  user: AuthPayload;
}

export interface AuthPayload {
  id: string;
  role: string;
}
