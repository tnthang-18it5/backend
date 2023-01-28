import { Injectable, BadRequestException } from '@nestjs/common';
import { InjectConnection } from '@nestjs/mongoose';
import { ObjectId } from 'mongodb';
import { Collection, Connection, FilterQuery } from 'mongoose';
import { generate } from 'randomstring';
import { Role, SCHEDULE_STATUS } from '../../constants';
import { PatientRegistrationDto, PatientRegistrationStatusDto } from './dto';
import { addDays } from 'date-and-time';
import { getPagination } from '../../utils/pagination';
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

  async getAll(uId: string, input: PatientRegistrationStatusDto) {
    const userId = new ObjectId(uId);
    const { option, by, page: pageNum, size } = input;
    const { page, skip, take } = getPagination(pageNum, size);

    const filter: FilterQuery<unknown> = {};

    // if (option) filter.status = option;
    // else filter.status = SCHEDULE_STATUS.PROGRESS;
    switch (option) {
      case SCHEDULE_STATUS.COMPLETED:
        filter.from = { $lt: new Date() };
        break;
      case SCHEDULE_STATUS.CANCEL:
        filter.status = SCHEDULE_STATUS.CANCEL;
        break;
      default:
        filter.from = { $gte: new Date() };
    }

    if (by == Role.USER) filter.userId = userId;
    else filter.doctorId = userId;

    const [totalRecords, data] = await Promise.all([
      this.scheduleCollection.count(filter),
      this.scheduleCollection
        .aggregate([
          { $match: filter },
          {
            $lookup: {
              from: 'users',
              localField: 'userId',
              foreignField: '_id',
              as: 'user',
              pipeline: [{ $project: { password: 0 } }]
            }
          },
          {
            $lookup: {
              from: 'users',
              localField: 'doctorId',
              foreignField: '_id',
              as: 'doctor',
              pipeline: [{ $project: { password: 0 } }]
            }
          },
          { $unwind: '$user' },
          { $unwind: '$doctor' }
        ])
        .skip(skip)
        .limit(take)
        .sort({ createdAt: -1 })
        .toArray()
    ]);

    return {
      data,
      page,
      size: take,
      totalRecords
    };
  }
}
