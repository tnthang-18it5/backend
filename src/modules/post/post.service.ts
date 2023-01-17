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
  private readonly postBookmarkCollection: Collection;

  private readonly postCommentCollection: Collection;
  private readonly userCollection: Collection;
  private readonly postActionsCollection: Collection;
  private readonly postGroupCollection: Collection;
  constructor(@InjectConnection() private connection: Connection) {
    this.postCollection = this.connection.collection('posts');
    this.postViewCollection = this.connection.collection('posts_view');
    this.postLikeCollection = this.connection.collection('posts_like');
    this.postBookmarkCollection = this.connection.collection('posts_bookmark');
    this.postCommentCollection = this.connection.collection('posts_comment');
    this.userCollection = this.connection.collection('users');
    this.postActionsCollection = this.connection.collection('posts_action');
    this.postGroupCollection = this.connection.collection('post_groups');
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
          commentCount: await this.postCommentCollection.count({ postId: post?._id }),
          likeCount: await this.postLikeCollection.count({ postId: post?._id }),
          viewCount: await (
            await this.postViewCollection.find({ postId: post?._id }).toArray()
          ).reduce((total, item) => {
            total += item?.viewCount;
            return total;
          }, 0)
        };
      })
    );
    return { data, totalRecords, page, size: take };
  }

  async getPost(slug: string, uId?: string) {
    const userId = uId && new ObjectId(uId);
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

    const [viewCount, likeCount, commentCount, liked, bookmarked] = await Promise.all([
      this.postViewCollection
        .aggregate([
          {
            $match: { postId: post._id }
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
      this.postCommentCollection.count({ postId: post._id }),
      this.postLikeCollection.count({ postId: post._id, userId }),
      this.postBookmarkCollection.count({ postId: post._id, userId })
    ]);

    await this.postViewCollection.updateOne(
      { postId: post._id, day, month, year },
      { $inc: { viewCount: 1 } },
      { upsert: true }
    );

    return {
      ...post,
      viewCount: viewCount[0]?.sum,
      likeCount,
      commentCount,
      liked,
      bookmarked
    };
  }

  async likePost(pId: string, uId: string) {
    const postId = new ObjectId(pId);
    const userId = new ObjectId(uId);
    const record = await this.postLikeCollection.findOne({ postId, userId });
    if (record) {
      await this.postLikeCollection.deleteOne({ postId, userId });
      return { liked: false };
    }
    await this.postLikeCollection.insertOne({ postId, userId });
    return { liked: true };
  }

  async bookmarkPost(pId: string, uId: string) {
    const postId = new ObjectId(pId);
    const userId = new ObjectId(uId);
    const record = await this.postBookmarkCollection.findOne({ postId, userId });
    if (record) {
      await this.postBookmarkCollection.deleteOne({ postId, userId });
      return { bookmarked: false };
    }
    await this.postBookmarkCollection.insertOne({ postId, userId });
    return { bookmarked: true };
  }

  getComments = async (postId: string) => {
    const data = await this.postCommentCollection
      .aggregate([
        {
          $match: {
            postId: new ObjectId(postId)
          }
        },
        {
          $lookup: {
            from: 'users',
            localField: 'userId',
            foreignField: '_id',
            as: 'createdBy',
            pipeline: [{ $project: { avatar: 1, name: 1 } }]
          }
        },
        { $unwind: '$createdBy' }
      ])
      .toArray();
    return {
      data
    };
  };

  async newComment(pId: string, uId: string, message: string) {
    await this.postCommentCollection.insertOne({
      postId: new ObjectId(pId),
      userId: new ObjectId(uId),
      message,
      createdAt: new Date()
    });

    return { status: true };
  }

  async delComment(id: string) {
    await this.postCommentCollection.deleteOne({
      _id: new ObjectId(id)
    });

    return { status: true };
  }
}
