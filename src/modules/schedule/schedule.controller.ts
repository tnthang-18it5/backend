import { Body, Controller, Post, Req, Get, Param, UseGuards, UsePipes } from '@nestjs/common';
import { MainValidationPipe } from '../../utils/validate';
import { JwtGuard } from '../auth/JwtGuard';
import { AuthRequest } from './../../dto/index';
import { PatientRegistrationDto } from './dto';
import { ScheduleService } from './schedule.service';

@Controller('schedule')
export class ScheduleController {
  constructor(private readonly scheduleService: ScheduleService) {}

  @Post('patient-registration')
  @UseGuards(JwtGuard)
  @UsePipes(new MainValidationPipe())
  patientRegistration(@Body() body: PatientRegistrationDto, @Req() req: AuthRequest) {
    return this.scheduleService.patientRegistration(req.user.id, body);
  }

  @Get('booked/:id')
  booked(@Param('id') id: string) {
    return this.scheduleService.booked(id);
  }
}
