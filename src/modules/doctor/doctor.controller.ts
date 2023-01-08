import { AuthGuard } from '@nestjs/passport';
import { Controller, Post, UseGuards } from '@nestjs/common';
import { JwtGuard } from '../auth/JwtGuard';

@Controller('doctor')
export class DoctorController {
  @Post()
  @UseGuards(JwtGuard)
  createPost() {
    return { status: true };
  }
}
