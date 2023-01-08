import { Injectable } from '@nestjs/common';
import { InjectConnection } from '@nestjs/mongoose';
import { Collection, Connection, Document, FilterQuery } from 'mongoose';
import { getPagination } from '../../utils/pagination';
import { searchKeyword } from '../../utils/searchKeyword';
import { PostRequestDto } from './dto';
import { ObjectId } from 'mongodb';

@Injectable()
export class PostService {
  private readonly postCollection: Collection;
  private readonly postActionsCollection: Collection;
  private readonly postGroupCollection: Collection;
  private readonly commentsCollection: Collection;
  constructor(@InjectConnection() private connection: Connection) {
    this.postCollection = this.connection.collection('posts');
    this.postActionsCollection = this.connection.collection('posts_action');
    this.postGroupCollection = this.connection.collection('post_groups');
    this.commentsCollection = this.connection.collection('comments');
  }

  async getAll(query: PostRequestDto) {
    const { page: numPage, size, keyword } = query;
    const { page, skip, take } = getPagination(numPage, size);
    const filter: FilterQuery<unknown> = {};
    if (keyword) filter.title = searchKeyword(keyword);
    const [totalRecords, posts] = await Promise.all([
      this.postCollection.count(filter),
      this.postCollection
        .aggregate([
          { $match: filter },
          {
            $lookup: {
              from: 'users',
              localField: 'createdBy',
              foreignField: '_id',
              as: 'createdBy',
              pipeline: [{ $project: { avatar: 1, name: 1 } }]
            }
          },
          { $unwind: '$createdBy' },
          {
            $lookup: {
              from: 'post_groups',
              localField: 'groupBy',
              foreignField: '_id',
              as: 'groupBy'
            }
          },
          { $unwind: '$groupBy' },
          {
            $project: {
              title: 1,
              description: 1,
              createdBy: 1,
              comments: 1,
              groupBy: 1,
              createdAt: 1,
              updatedAt: 1,
              slug: 1
            }
          }
        ])
        .skip(skip)
        .limit(take)
        .sort({ _id: 1 })
        .toArray()
    ]);

    const data = await Promise.all(
      posts.map(async (post) => {
        return {
          ...post,
          commentCount: await this.commentsCollection.count({ postId: new ObjectId(post?._id) })
        };
      })
    );
    return { data, totalRecords, page, size };
  }
}
