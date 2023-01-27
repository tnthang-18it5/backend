import { Injectable, BadRequestException } from '@nestjs/common';
import { InjectConnection } from '@nestjs/mongoose';
import { ObjectId } from 'mongodb';
import { Collection, Connection } from 'mongoose';
import { generate } from 'randomstring';
import { SCHEDULE_STATUS } from '../../constants';
import { PatientRegistrationDto } from './dto';
import { addDays } from 'date-and-time';

@Injectable()
export class ScheduleService {
  private readonly scheduleCollection: Collection;
  constructor(@InjectConnection() private connection: Connection) {
    this.scheduleCollection = this.connection.collection('schedules');
  }

  async patientRegistration(uId: string, input: PatientRegistrationDto) {
    const { doctorId, from, to } = input;
    const regisExisted = await this.scheduleCollection.findOne({
      doctorId: new ObjectId(doctorId),
      from: new Date(from)
    });

    if (regisExisted) throw new BadRequestException({ message: 'Lịch đã được ai đó đặt trước' });

    await this.scheduleCollection.insertOne({
      userId: new ObjectId(uId),
      doctorId: new ObjectId(doctorId),
      code: generate(10),
      from: new Date(from),
      to: new Date(to),
      status: SCHEDULE_STATUS.PROGRESS,
      createdAt: new Date()
    });

    return { message: 'Đặt lịch hoàn tất' };
  }

  async booked(doctorId: string) {
    const now = new Date();
    const toDay = new Date(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate());
    const currentDay = now.getDay();

    const from = addDays(toDay, 0 - currentDay);
    const to = addDays(toDay, 7 - currentDay);
    // console.log(from, to);
    const schedulesOfWeek = await this.scheduleCollection
      .find<any>({
        doctorId: new ObjectId(doctorId),
        from: { $gte: from },
        to: { $lt: to }
      })
      .toArray();

    const data = schedulesOfWeek.map((v) => v?.from);
    return data;
  }
}
