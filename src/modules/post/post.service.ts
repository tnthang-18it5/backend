import { PostType, Role, TimeLine } from './../../constants/index';
import { Injectable, BadRequestException } from '@nestjs/common';
import { InjectConnection } from '@nestjs/mongoose';
import { Collection, Connection, Document, FilterQuery } from 'mongoose';
import { getPagination } from '../../utils/pagination';
import { searchKeyword } from '../../utils/searchKeyword';
import { PostRequestDto } from './dto';
import { ObjectId } from 'mongodb';
import * as slugTool from 'slug';
import { generate } from 'randomstring';
import * as date from 'date-and-time';
import { TimeLineDto } from '../../dto';

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
  private readonly notificationCollection: Collection;
  constructor(@InjectConnection() private connection: Connection) {
    this.postCollection = this.connection.collection('posts');
    this.postViewCollection = this.connection.collection('posts_view');
    this.postLikeCollection = this.connection.collection('posts_like');
    this.postBookmarkCollection = this.connection.collection('posts_bookmark');
    this.postCommentCollection = this.connection.collection('posts_comment');
    this.userCollection = this.connection.collection('users');
    this.postActionsCollection = this.connection.collection('posts_action');
    this.postGroupCollection = this.connection.collection('post_groups');
    this.notificationCollection = this.connection.collection('notifications');
  }

  async getAll(query: PostRequestDto) {
    const { page: numPage, size, keyword, option } = query;
    const { page, skip, take } = getPagination(numPage, size);
    const filter: FilterQuery<unknown> = {};
    if (keyword) filter.title = searchKeyword(keyword);
    filter.deletedBy = null;
    const sortData: FilterQuery<unknown> = {};

    switch (option) {
      case PostType.NEWEST:
        sortData.createdAt = -1;
        break;
      case PostType.POPULAR:
        sortData.viewCount = -1;
        break;
      case PostType.RATE:
        sortData.likeCount = -1;
        break;
      default:
        sortData._id = 1;
    }

    const [totalRecords, data] = await Promise.all([
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
              as: 'group'
            }
          },
          {
            $addFields: {
              groupBy: {
                $arrayElemAt: ['$group', 0]
              }
            }
          },
          {
            $lookup: {
              from: 'posts_comment',
              localField: '_id',
              foreignField: 'postId',
              as: 'comments'
            }
          },
          {
            $lookup: {
              from: 'posts_like',
              localField: '_id',
              foreignField: 'postId',
              as: 'likes'
            }
          },
          {
            $lookup: {
              from: 'posts_view',
              localField: '_id',
              foreignField: 'postId',
              as: 'views',
              pipeline: [
                {
                  $group: {
                    _id: null,
                    sum: {
                      $sum: '$viewCount'
                    }
                  }
                }
              ]
            }
          },
          {
            $addFields: {
              view: {
                $arrayElemAt: ['$views', 0]
              }
            }
          },
          {
            $project: {
              id: '$_id',
              title: 1,
              description: 1,
              createdBy: 1,
              commentCount: {
                $size: '$comments'
              },
              likeCount: {
                $size: '$likes'
              },
              groupBy: 1,
              createdAt: 1,
              updatedAt: 1,
              slug: 1,
              viewCount: '$view.sum'
            }
          }
        ])
        .sort(sortData)
        .skip(skip)
        .limit(take)
        .toArray()
    ]);

    return { data, totalRecords, page, size: take };
  }

  async getPost(slug: string, uId?: string) {
    const userId = uId && new ObjectId(uId);
    const post = await this.postCollection.findOne({ slug, deletedBy: null });
    if (!post) throw new BadRequestException({ message: 'Không tìm thấy bài viết' });

    const [viewCount, likeCount, commentCount, liked, bookmarked, groupBy, createdBy] = await Promise.all([
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
      this.postBookmarkCollection.count({ postId: post._id, userId }),
      post.groupBy && this.postGroupCollection.findOne({ _id: new ObjectId(post.groupBy) }),
      this.userCollection.findOne({ _id: new ObjectId(post.createdBy) }, { projection: { name: 1, avatar: 1 } })
    ]);

    const now = new Date();
    await this.postViewCollection.updateOne(
      { postId: post._id },
      {
        $inc: { viewCount: 1 },
        $set: { createdAt: new Date(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate()) }
      },
      { upsert: true }
    );

    return {
      ...post,
      viewCount: viewCount[0]?.sum,
      likeCount,
      commentCount,
      liked,
      bookmarked,
      groupBy,
      createdBy
    };
  }

  async getPostById(postId: string, uId: string) {
    const userId = uId && new ObjectId(uId);
    const post = await this.postCollection.findOne<Record<string, unknown>>({
      _id: new ObjectId(postId),
      deletedBy: null
    });
    if (!post) throw new BadRequestException({ message: 'Không tìm thấy bài viết' });
    if (post.groupBy) post.groupBy = await this.postGroupCollection.findOne({ _id: post.groupBy });
    return post;
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
      .sort({ _id: -1 })
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

  async createPost(body: any, createdBy: string) {
    const slugTitle = slugTool(body.title);
    const slugExist = await this.postCollection.count({ slug: slugTitle });
    if (body.groupBy) body.groupBy = new ObjectId(body.groupBy);
    await this.postCollection.insertOne({
      ...body,
      slug: !slugExist ? slugTitle : slugTitle + generate(8),
      createdBy: new ObjectId(createdBy),
      createdAt: new Date()
    });

    return { status: true };
  }

  async editPost(slug: string, input: any, uId: string) {
    // const postId = new ObjectId(pId);
    const userId = new ObjectId(uId);

    const postExisted = await this.postCollection.count({ slug: slug });
    if (!postExisted) throw new BadRequestException({ message: 'Bài viết không tồn tại' });

    await this.postCollection.updateOne(
      { slug: slug },
      { $set: { ...input, updatedAt: new Date(), updatedBy: userId } }
    );
    return { status: true };
  }

  async deletePost(postId: string, uId: string, role: string) {
    const postExisted = await this.postCollection.findOne({ _id: new ObjectId(postId) });
    if (!postExisted) throw new BadRequestException({ message: 'Bài viết không tồn tại' });

    if (role == Role.ADMIN) {
      await this.notificationCollection.insertOne({
        title: 'Bài viết của bạn đã bị xoá',
        description: 'Người quản trị đã xoá bài viết của bạn: ' + postId,
        receiver: postExisted.createdBy,
        isRead: false,
        createdAt: new Date(),
        updatedAt: new Date()
      });
    }

    await this.postCollection.findOneAndUpdate(
      { _id: new ObjectId(postId) },
      { $set: { deletedAt: new Date(), deletedBy: new ObjectId(uId) } }
    );
    return { status: true };
  }

  async viewChart(uId: string, query: TimeLineDto) {
    const now = new Date();
    const dayOnMonth = [];
    for (let i = 0; i <= TimeLine[query.timeline].day; i++) {
      dayOnMonth.unshift(date.addDays(now, -i));
    }

    const posts = await this.postCollection.distinct('_id', { createdBy: new ObjectId(uId) });
    const views = await this.postViewCollection
      .aggregate([
        {
          $match: {
            postId: { $in: posts },
            createdAt: { $gte: new Date(dayOnMonth[0]) }
          }
        },
        {
          $group: {
            _id: {
              createdAt: '$createdAt'
            },
            countView: {
              $sum: '$viewCount'
            }
          }
        }
      ])
      .toArray();

    const labels = [];
    const data = [];

    dayOnMonth.forEach((v) => {
      const dayFormat = date.format(v, 'DD/MM');
      const hasValue = views.find((value) => {
        const day = new Date(value?._id.createdAt);
        const dF = date.format(day, 'DD/MM');
        return dayFormat == dF;
      });

      if (hasValue) {
        labels.unshift(dayFormat);
        data.unshift(hasValue?.countView || 0);
      } else {
        labels.unshift(dayFormat);
        data.unshift(0);
      }
    });

    return { labels: labels.reverse(), data: data.reverse() };
  }

  async getPostDeleted(query: PostRequestDto, uId: string, role: string) {
    const { page: numPage, size, keyword, option } = query;
    const { page, skip, take } = getPagination(numPage, size);
    const filter: FilterQuery<unknown> = {};
    if (role == Role.DOCTOR) filter.createdBy = new ObjectId(uId);

    filter.deletedBy = { $ne: null };
    if (keyword) filter.title = searchKeyword(keyword);
    const sortData: FilterQuery<unknown> = {};

    switch (option) {
      case PostType.NEWEST:
        sortData.createdAt = -1;
        break;
      case PostType.POPULAR:
        sortData.viewCount = -1;
        break;
      case PostType.RATE:
        sortData.likeCount = -1;
        break;
      default:
        sortData._id = -1;
    }

    const [totalRecords, data] = await Promise.all([
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
              as: 'group'
            }
          },
          {
            $addFields: {
              groupBy: {
                $arrayElemAt: ['$group', 0]
              }
            }
          },
          {
            $lookup: {
              from: 'posts_comment',
              localField: '_id',
              foreignField: 'postId',
              as: 'comments'
            }
          },
          {
            $lookup: {
              from: 'posts_like',
              localField: '_id',
              foreignField: 'postId',
              as: 'likes'
            }
          },
          {
            $lookup: {
              from: 'posts_view',
              localField: '_id',
              foreignField: 'postId',
              as: 'views',
              pipeline: [
                {
                  $group: {
                    _id: null,
                    sum: {
                      $sum: '$viewCount'
                    }
                  }
                }
              ]
            }
          },
          {
            $addFields: {
              view: {
                $arrayElemAt: ['$views', 0]
              }
            }
          },
          {
            $project: {
              id: '$_id',
              title: 1,
              description: 1,
              createdBy: 1,
              commentCount: {
                $size: '$comments'
              },
              likeCount: {
                $size: '$likes'
              },
              groupBy: 1,
              createdAt: 1,
              updatedAt: 1,
              slug: 1,
              viewCount: '$view.sum'
            }
          }
        ])
        .sort(sortData)
        .skip(skip)
        .limit(take)
        .toArray()
    ]);

    return { data, totalRecords, page, size: take };
  }

  async restorePost(pId: string, uId: string, role: string) {
    const post = await this.postCollection.findOne({ _id: new ObjectId(pId) });
    if (!post) throw new BadRequestException({ message: 'Không tìm thấy bài viết' });

    const isDeleteByAdmin = await this.userCollection.findOne({ _id: post.deletedBy, role: Role.ADMIN });
    if (isDeleteByAdmin && role != Role.ADMIN)
      throw new BadRequestException({ message: 'Bạn không đủ quyền thực hiện hành động này' });

    await this.postCollection.findOneAndUpdate(
      { _id: new ObjectId(pId) },
      { $set: { deletedBy: null, restoredBy: new ObjectId(uId), restoredAt: new Date(), deletedAt: null } }
    );

    return { status: true };
  }
}
