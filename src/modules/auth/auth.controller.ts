import {
  Body,
  Controller,
  Get,
  HttpStatus,
  Patch,
  Post,
  Query,
  Req,
  UnsupportedMediaTypeException,
  UploadedFile,
  UseGuards,
  UseInterceptors,
  UsePipes
} from '@nestjs/common';
import { Param } from '@nestjs/common/decorators';

import { AuthGuard } from '@nestjs/passport';
import { FileInterceptor } from '@nestjs/platform-express';
import { diskStorage } from 'multer';
import { extname } from 'path';
import { AuthRequest } from '../../dto';
import { MainValidationPipe } from '../../utils/validate';
import { AuthService } from './auth.service';
import { AccountDto, ProfileUpdateDto, VerifyEmailDto } from './dto';
import { JwtGuard } from './JwtGuard';
@Controller('auth')
export class AuthController {
  constructor(private readonly authService: AuthService) {}
  @Get('/facebook')
  @UseGuards(AuthGuard('facebook'))
  async facebookLogin(): Promise<any> {
    return HttpStatus.OK;
  }

  @Get('/facebook/redirect')
  @UseGuards(AuthGuard('facebook'))
  async facebookLoginRedirect(@Req() req: any): Promise<any> {
    const user = req.user;
    return this.authService.loginFB(user.user.id, undefined);
  }

  @Get('profile')
  @UseGuards(JwtGuard)
  getProfile(@Req() req: AuthRequest) {
    return this.authService.getProfile(req.user.id);
  }

  @Patch('profile')
  @UseGuards(JwtGuard)
  @UsePipes(new MainValidationPipe())
  updateProfile(@Req() req: AuthRequest, @Body() body: ProfileUpdateDto) {
    return this.authService.updateProfile(req.user.id, body);
  }

  @Post('change-avatar')
  @UseGuards(JwtGuard)
  @UsePipes(new MainValidationPipe())
  @UseInterceptors(
    FileInterceptor('file', {
      storage: diskStorage({
        destination: './src/public/avatars',
        filename: (req: AuthRequest, file, cb) => {
          const randomName = Array(32)
            .fill(null)
            .map(() => Math.round(Math.random() * 16).toString(16))
            .join('');
          cb(null, `${randomName}${extname(file.originalname)}`);
        }
      }),
      fileFilter(req, file, callback) {
        const fileValid = ['image/gif', 'image/jpeg', 'image/png'];
        // console.log('fileValid', fileValid, file.mimetype);
        if (!fileValid.includes(file.mimetype)) callback(new UnsupportedMediaTypeException('File không hợp lệ'), false);
        else callback(null, true);
      }
    })
  )
  changeAvatar(@Req() req: AuthRequest, @UploadedFile() file: Express.Multer.File) {
    return this.authService.changeAvatar(req.user.id, file.filename);
  }

  @Post('register')
  @UsePipes(new MainValidationPipe())
  register(@Body() body: AccountDto) {
    return this.authService.register(body);
  }

  @Get('account-active/:email')
  accountActive(@Param('email') email: string) {
    return this.authService.accountActive(email);
  }

  @Get('verify-email')
  @UsePipes(new MainValidationPipe())
  verifyEmail(@Query() query: VerifyEmailDto) {
    return this.authService.verifyEmail(query.token);
  }

  @Post('login')
  @UsePipes(new MainValidationPipe())
  login(@Body() body: AccountDto) {
    return this.authService.login(body);
  }
}
