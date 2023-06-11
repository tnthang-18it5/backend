import { DoctorModule } from './modules/doctor/doctor.module';
import { Module } from '@nestjs/common';
import { MongooseModule } from '@nestjs/mongoose';
import { ConfigService } from './config';
import { PostModule } from './modules/post/post.module';
import { AuthModule } from './modules/auth/auth.module';
import { FacebookStrategy } from './modules/auth/FacebookStrategy';
import { JwtStrategy } from './modules/auth/JwtStrategy';
import { MailerModule } from '@nestjs-modules/mailer';
import { RolesGuard } from './modules/auth/RolesGuard';
import { HomeModule } from './modules/home/home.module';
import { GroupModule } from './modules/group/group.module';
import { ScheduleModule } from './modules/schedule/schedule.module';
import { AppGateway } from './modules/gateway/event.gateway';
import { ServeStaticModule } from '@nestjs/serve-static';
import { join } from 'path';
import { UserModule } from './modules/user/user.module';

const config = ConfigService.getInstance();
@Module({
  imports: [
    MongooseModule.forRoot(config.get('DATABASE_URL'), { dbName: config.get('DATABASE_NAME') }),
    MailerModule.forRoot({
      transport: {
        host: config.get('EMAIL_SERVER'),
        auth: {
          user: config.get('EMAIL_USERNAME'),
          pass: config.get('EMAIL_PW')
        }
      }
    }),
    ServeStaticModule.forRoot({
      rootPath: join(__dirname, '..', './src/public')
    }),
    PostModule,
    DoctorModule,
    AuthModule,
    HomeModule,
    GroupModule,
    ScheduleModule,
    UserModule
  ],
  providers: [FacebookStrategy, JwtStrategy, AppGateway]
})
export class AppModule {}
