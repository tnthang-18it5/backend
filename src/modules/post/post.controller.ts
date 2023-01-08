import { Controller, Get, Post, Query, Req, UseGuards, UsePipes } from '@nestjs/common';
import { Role } from '../../constants';
import { Roles } from '../../decorator/roles.decorator';
import { MainValidationPipe } from '../../utils/validate';
import { JwtGuard } from '../auth/JwtGuard';
import { RolesGuard } from '../auth/RolesGuard';
import { PostRequestDto } from './dto';
import { PostService } from './post.service';

@Controller('post')
export class PostController {
  constructor(private readonly postService: PostService) {}

  @Get()
  @UsePipes(new MainValidationPipe())
  getAll(@Query() query: PostRequestDto) {
    return this.postService.getAll(query);
  }

  @Roles(Role.ADMIN, Role.DOCTOR)
  @UseGuards(JwtGuard, RolesGuard)
  @Post()
  createPost(@Req() req: any) {
    return true;
  }
}
