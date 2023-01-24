import { Injectable } from '@nestjs/common';
import { InjectConnection } from '@nestjs/mongoose';
import { Collection, Connection } from 'mongoose';
import { Role } from '../../constants';

@Injectable()
export class HomeService {
  private readonly homeCollection: Collection;
  private readonly postCollection: Collection;
  private readonly userCollection: Collection;
  constructor(@InjectConnection() private connection: Connection) {
    this.homeCollection = this.connection.collection('homepage');
    this.postCollection = this.connection.collection('posts');
    this.userCollection = this.connection.collection('users');
  }

  getInformationHomePage = async () => {
    const [postCount, userCount, doctorCount, homepage] = await Promise.all([
      this.postCollection.count(),
      this.userCollection.count({ role: Role.USER }),
      this.userCollection.count({ role: Role.DOCTOR }),
      this.homeCollection.findOne()
    ]);

    return {
      systemInfo: {
        postCount,
        doctorCount,
        userCount
      },
      banner: homepage?.banner,
      slogans: [homepage?.slogan1, homepage?.slogan2]
    };
  };
}
