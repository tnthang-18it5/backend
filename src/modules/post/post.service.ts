import { PostType } from './../../constants/index';
import { Injectable, BadRequestException } from '@nestjs/common';
import { InjectConnection } from '@nestjs/mongoose';
import { Collection, Connection, Document, FilterQuery } from 'mongoose';
import { getPagination } from '../../utils/pagination';
import { searchKeyword } from '../../utils/searchKeyword';
import { PostRequestDto } from './dto';
import { ObjectId } from 'mongodb';

@Injectable()
export class PostService {
  private readonly postCollection: Collection;
  private readonly postViewCollection: Collection;
  private readonly postLikeCollection: Collection;
  private readonly postCommentCollection: Collection;
  private readonly userCollection: Collection;
  private readonly postActionsCollection: Collection;
  private readonly postGroupCollection: Collection;
  private readonly commentsCollection: Collection;
  constructor(@InjectConnection() private connection: Connection) {
    this.postCollection = this.connection.collection('posts');
    this.postViewCollection = this.connection.collection('posts_view');
    this.postLikeCollection = this.connection.collection('posts_like');
    this.postCommentCollection = this.connection.collection('posts_comment');
    this.userCollection = this.connection.collection('users');
    this.postActionsCollection = this.connection.collection('posts_action');
    this.postGroupCollection = this.connection.collection('post_groups');
    this.commentsCollection = this.connection.collection('comments');
  }

  async getAll(query: PostRequestDto) {
    const { page: numPage, size, keyword, option } = query;
    const { page, skip, take } = getPagination(numPage, size);
    const filter: FilterQuery<unknown> = {};
    if (keyword) filter.title = searchKeyword(keyword);

    const sortData: FilterQuery<unknown> = {};

    switch (option) {
      case PostType.NEWEST:
        sortData.createdAt = 1;
        break;
      case PostType.POPULAR:
        sortData.viewCount = 1;
        break;
      case PostType.RATE:
        sortData.likeCount = 1;
        break;
      default:
        sortData._id = 1;
    }

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
              id: '$_id',
              title: 1,
              description: 1,
              createdBy: 1,
              comments: 1,
              groupBy: 1,
              createdAt: 1,
              updatedAt: 1,
              slug: 1,
              viewCount: 1
            }
          }
        ])
        .skip(skip)
        .limit(take)
        .sort(sortData)
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
    return { data, totalRecords, page, size: take };
  }

  async getPost(slug: string) {
    const data = await this.postCollection
      .aggregate([
        {
          $match: { slug: slug }
        },
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
        { $unwind: '$groupBy' }
      ])
      .toArray();
    const post = data[0];
    if (!post) throw new BadRequestException({ message: 'Không tìm thấy bài viết' });

    const date = new Date();
    const day = date.getUTCDate();
    const month = date.getUTCMonth() + 1;
    const year = date.getUTCFullYear();

    const [viewCount, likeCount, commentCount] = await Promise.all([
      this.postViewCollection
        .aggregate([
          {
            $match: { _id: post._id }
          },
          {
            $group: {
              _id: null,
              sum: {
                $sum: '$viewCount'
              }
            }
          }
        ])
        .toArray(),
      this.postLikeCollection.count({ postId: post._id }),
      this.postCommentCollection.count({ postId: post._id })
    ]);

    await this.postViewCollection.updateOne(
      { _id: post._id, day, month, year },
      { $inc: { viewCount: 1 } },
      { upsert: true }
    );

    return {
      ...post,
      viewCount: viewCount[0]?.sum,
      likeCount,
      commentCount
    };
  }
}
