import { Injectable, BadRequestException } from '@nestjs/common';
import { InjectConnection } from '@nestjs/mongoose';
import { ObjectId } from 'mongodb';
import { Collection, Connection, FilterQuery } from 'mongoose';
import { generate } from 'randomstring';
import { Role, SCHEDULE_STATUS, TimeLine } from '../../constants';
import { PatientRegistrationDto, PatientRegistrationStatusDto } from './dto';
import { addDays } from 'date-and-time';
import { getPagination } from '../../utils/pagination';
import * as date from 'date-and-time';
import { TimeLineDto } from '../../dto';

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

  async getAll(uId: string, by: string, input: PatientRegistrationStatusDto) {
    const userId = new ObjectId(uId);
    const { option, page: pageNum, size } = input;
    const { page, skip, take } = getPagination(pageNum, size);

    const filter: FilterQuery<unknown> = {};
    const sortData: FilterQuery<unknown> = {};

    switch (option) {
      case SCHEDULE_STATUS.COMPLETED:
        {
          filter.from = { $lt: new Date() };
          sortData.from = -1;
        }
        break;
      case SCHEDULE_STATUS.CANCEL:
        {
          filter.status = SCHEDULE_STATUS.CANCEL;
          sortData.from = -1;
        }
        break;
      default: {
        filter.from = { $gte: new Date() };
        sortData.from = 1;
      }
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
        .sort(sortData)
        .toArray()
    ]);

    return {
      data,
      page,
      size: take,
      totalRecords
    };
  }

  async roomAccess(uId: string, room: string) {
    const schedule = await this.scheduleCollection.findOne({ code: room, status: SCHEDULE_STATUS.PROGRESS });

    if (!schedule) throw new BadRequestException({ message: 'Phòng khám không tồn tại hoặc đã đóng' });
    const isUser = uId === schedule.userId?.toString();
    const isDoctor = uId === schedule.doctorId?.toString();

    if (isUser || isDoctor) return { status: true };

    throw new BadRequestException({ message: 'Bạn không thể vào phòng này' });
  }

  async schedulesChart(uId: string, query: TimeLineDto) {
    const now = new Date();
    const dayOnMonth = [];

    for (let i = 0; i <= TimeLine[query.timeline].day; i++) {
      dayOnMonth.unshift(date.addDays(now, -i));
    }

    const schedules = await this.scheduleCollection
      .aggregate([
        {
          $match: {
            doctorId: new ObjectId(uId),
            from: { $gte: new Date(dayOnMonth[0]) }
          }
        },
        {
          $group: {
            _id: {
              $dateToString: {
                format: '%Y-%m-%d',
                date: '$from'
              }
            },
            total: { $sum: 1 }
          }
        }
      ])
      .toArray();
    const labels = [];
    const data = [];

    dayOnMonth.forEach((v) => {
      const dayFormat = date.format(v, 'DD/MM');
      const hasValue = schedules.find((value) => {
        const day = new Date(value?._id);
        const dF = date.format(day, 'DD/MM');
        return dayFormat == dF;
      });

      if (hasValue) {
        labels.unshift(dayFormat);
        data.unshift(hasValue?.total || 0);
      } else {
        labels.unshift(dayFormat);
        data.unshift(0);
      }
    });

    return { labels: labels.reverse(), data: data.reverse() };
  }

  async getSchedule(id: string) {
    const schedule = await this.scheduleCollection
      .aggregate([
        { $match: { _id: new ObjectId(id) } },
        {
          $lookup: {
            from: 'users',
            localField: 'userId',
            foreignField: '_id',
            as: 'user',
            pipeline: [
              { $project: { phone: 1, numberId: 1, name: 1, job: 1, gender: 1, email: 1, birthday: 1, address: 1 } }
            ]
          }
        },
        { $unwind: '$user' },
        {
          $lookup: {
            from: 'users',
            localField: 'doctorId',
            foreignField: '_id',
            as: 'doctor',
            pipeline: [
              { $project: { phone: 1, numberId: 1, name: 1, job: 1, gender: 1, email: 1, birthday: 1, address: 1 } }
            ]
          }
        },
        { $unwind: '$doctor' }
      ])
      .toArray();
    const data = schedule[0];
    if (!data) throw new BadRequestException({ message: 'Không tìm thấy lịch khám' });
    return { ...schedule[0], dayIn: data?.from, status: '' };
  }

  async writeMedicalRecord(id: string) {
    const schedule = await this.scheduleCollection.count({ _id: new ObjectId(id) });
    if (!schedule) throw new BadRequestException({ message: 'Không tìm thấy lịch khám' });

    await this.scheduleCollection.findOneAndUpdate(
      { _id: new ObjectId(id) },
      { $set: { writeRecord: true, status: SCHEDULE_STATUS.COMPLETED, completedAt: new Date() } }
    );
    return { status: true };
  }

  async rating(id: string, rating: number) {
    await this.scheduleCollection.findOneAndUpdate({ _id: new ObjectId(id) }, { $set: { rating } });
    return { status: true };
  }
}
