import { AuthGuard } from '@nestjs/passport';
import { Controller, Get, Post, UseGuards, Query, UsePipes } from '@nestjs/common';
import { JwtGuard } from '../auth/JwtGuard';
import { DoctorService } from './doctor.service';
import { DoctorRequestDto } from './dto';
import { MainValidationPipe } from '../../utils/validate';

@Controller('doctor')
export class DoctorController {
  constructor(private readonly doctorService: DoctorService) {}
  @Post()
  @UseGuards(JwtGuard)
  createPost() {
    return { status: true };
  }

  @Get()
  @UsePipes(new MainValidationPipe())
  getAll(@Query() query: DoctorRequestDto) {
    return this.doctorService.getAll(query);
  }
}
