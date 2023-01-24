import { Injectable } from '@nestjs/common';
import { InjectConnection } from '@nestjs/mongoose';
import { Collection, Connection, FilterQuery } from 'mongoose';
import { getPagination } from '../../utils/pagination';
import { Role } from '../../constants';
import { DoctorRequestDto } from './dto';
import { searchKeyword } from '../../utils/searchKeyword';

@Injectable()
export class DoctorService {
  private readonly userCollection: Collection;
  constructor(@InjectConnection() private connection: Connection) {
    this.userCollection = this.connection.collection('users');
  }
  async getAll(input: DoctorRequestDto) {
    const { page: numPage, size, keyword } = input;
    const { page, skip, take } = getPagination(numPage, size);
    const filter: FilterQuery<unknown> = {};
    filter.role = Role.DOCTOR;

    if (keyword)
      filter.$or = [{ 'name.lastName': searchKeyword(keyword) }, { 'name.firstName': searchKeyword(keyword) }];

    const [totalRecords, data] = await Promise.all([
      this.userCollection.count(filter),
      this.userCollection
        .aggregate([
          {
            $match: filter
          },
          {
            $project: {
              password: 0
            }
          }
        ])
        .skip(skip)
        .limit(take)
        .toArray()
    ]);

    return {
      data,
      totalRecords,
      size: take,
      page
    };
  }
}
