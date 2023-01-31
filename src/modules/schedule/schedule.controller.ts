import { Body, Controller, Post, Req, Get, Param, UseGuards, UsePipes, Query } from '@nestjs/common';
import { MainValidationPipe } from '../../utils/validate';
import { JwtGuard } from '../auth/JwtGuard';
import { AuthRequest, TimeLineDto } from './../../dto/index';
import { PatientRegistrationDto, PatientRegistrationStatusDto } from './dto';
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

  @Get('patient-registration')
  @UseGuards(JwtGuard)
  @UsePipes(new MainValidationPipe())
  getAll(@Query() input: PatientRegistrationStatusDto, @Req() req: AuthRequest) {
    return this.scheduleService.getAll(req.user.id, req.user.role, input);
  }

  @Get('room-access/:id')
  @UseGuards(JwtGuard)
  roomAccess(@Req() req: AuthRequest, @Param('id') id: string) {
    return this.scheduleService.roomAccess(req.user.id, id);
  }

  @Get('chart/all')
  @UseGuards(JwtGuard)
  @UsePipes(new MainValidationPipe())
  schedulesChart(@Req() req: AuthRequest, @Query() query: TimeLineDto) {
    return this.scheduleService.schedulesChart(req.user.id, query);
  }
}
