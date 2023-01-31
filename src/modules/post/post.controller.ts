import { Controller, Get, Param, Post, Query, Patch, Req, UseGuards, UsePipes, Body, Delete } from '@nestjs/common';
import { Role } from '../../constants';
import { Roles } from '../../decorator/roles.decorator';
import { MainValidationPipe } from '../../utils/validate';
import { JwtGuard } from '../auth/JwtGuard';
import { RolesGuard } from '../auth/RolesGuard';
import { PostRequestDto } from './dto';
import { PostService } from './post.service';
import { AuthRequest, TimeLineDto } from '../../dto';
import { parseToken } from '../auth/ParseToken';
import { Request } from 'express';
@Controller('post')
export class PostController {
  constructor(private readonly postService: PostService) {}

  @Get()
  @UsePipes(new MainValidationPipe())
  getAll(@Query() query: PostRequestDto) {
    return this.postService.getAll(query);
  }

  @Get('/chart/all')
  @UseGuards(JwtGuard)
  @UsePipes(new MainValidationPipe())
  viewChart(@Req() req: AuthRequest, @Query() query: TimeLineDto) {
    return this.postService.viewChart(req.user.id, query);
  }

  @Get(':slug')
  @UsePipes(new MainValidationPipe())
  async getPost(@Param('slug') slug: string, @Req() req: Request) {
    const parse = await parseToken(req);
    return this.postService.getPost(slug, parse?.userId);
  }

  @Get('by-id/:id')
  @UseGuards(JwtGuard)
  @UsePipes(new MainValidationPipe())
  async getPostById(@Param('id') id: string, @Req() req: AuthRequest) {
    return this.postService.getPostById(id, req.user.id);
  }

  @Roles(Role.ADMIN, Role.DOCTOR)
  @UseGuards(JwtGuard, RolesGuard)
  @Post()
  createPost(@Req() req: AuthRequest, @Body() body: any) {
    const createdBy = req.user.id;
    return this.postService.createPost(body, createdBy);
  }

  @Roles(Role.ADMIN, Role.DOCTOR)
  @UseGuards(JwtGuard, RolesGuard)
  @Patch(':id')
  editPost(@Req() req: AuthRequest, @Body() body: any, @Param('id') id: string) {
    const updatedBy = req.user.id;
    return this.postService.editPost(id, body, updatedBy);
  }

  @Roles(Role.ADMIN, Role.DOCTOR)
  @UseGuards(JwtGuard, RolesGuard)
  @Delete(':id')
  deletePost(@Req() req: AuthRequest, @Param('id') id: string) {
    const createdBy = req.user.id;
    return this.postService.deletePost(id);
  }

  @Get(':id/like')
  @UseGuards(JwtGuard)
  @UsePipes(new MainValidationPipe())
  likePost(@Param('id') id: string, @Req() req: AuthRequest) {
    return this.postService.likePost(id, req.user.id);
  }

  @Get(':id/bookmark')
  @UseGuards(JwtGuard)
  @UsePipes(new MainValidationPipe())
  bookmarkPost(@Param('id') id: string, @Req() req: AuthRequest) {
    return this.postService.bookmarkPost(id, req.user.id);
  }

  @Get(':id/comment')
  @UseGuards(JwtGuard)
  @UsePipes(new MainValidationPipe())
  getComments(@Param('id') id: string) {
    return this.postService.getComments(id);
  }

  @Post(':id/comment')
  @UseGuards(JwtGuard)
  @UsePipes(new MainValidationPipe())
  newComment(@Param('id') id: string, @Req() req: AuthRequest, @Body() body: { message: string }) {
    return this.postService.newComment(id, req.user.id, body.message);
  }

  @Delete('/comment/:id')
  @UseGuards(JwtGuard)
  @UsePipes(new MainValidationPipe())
  delComment(@Param('id') id: string, @Req() req: AuthRequest) {
    return this.postService.delComment(id);
  }
}
