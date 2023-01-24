import { Controller, Get, HttpStatus, Req, UseGuards, Post, Body, Query, UsePipes } from '@nestjs/common';
import { AuthService } from './auth.service';
import { AuthGuard } from '@nestjs/passport';
import { AuthRequest } from '../../dto';
import { AccountDto, VerifyEmailDto } from './dto';
import { Request } from 'express';
import { JwtGuard } from './JwtGuard';
import { MainValidationPipe } from '../../utils/validate';
import { Param } from '@nestjs/common/decorators';
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
