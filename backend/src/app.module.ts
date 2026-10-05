import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { APP_GUARD } from '@nestjs/core';
import { ScheduleModule } from '@nestjs/schedule';
import { ThrottlerGuard, ThrottlerModule } from '@nestjs/throttler';
import { validateEnv } from './config/env.js';
import { JwtAuthGuard } from './common/guards/jwt-auth.guard.js';
import { RolesGuard } from './common/guards/roles.guard.js';
import { PrismaModule } from './prisma/prisma.module.js';
import { ActivityModule } from './modules/activity/activity.module.js';
import { AuthModule } from './modules/auth/auth.module.js';
import { HealthModule } from './modules/health/health.module.js';
import { UsersModule } from './modules/users/users.module.js';

// Feature modules (stubs — see docs/ for the plan and checklist of each)
import { StudentsModule } from './modules/students/students.module.js';
import { CoursesModule } from './modules/courses/courses.module.js';
import { BatchesModule } from './modules/batches/batches.module.js';
import { EnquiriesModule } from './modules/enquiries/enquiries.module.js';
import { FacultyModule } from './modules/faculty/faculty.module.js';
import { QuestionsModule } from './modules/questions/questions.module.js';
import { TestsModule } from './modules/tests/tests.module.js';
import { MaterialsModule } from './modules/materials/materials.module.js';
import { VideosModule } from './modules/videos/videos.module.js';
import { DoubtsModule } from './modules/doubts/doubts.module.js';
import { ClassesModule } from './modules/classes/classes.module.js';
import { FeesModule } from './modules/fees/fees.module.js';
import { DashboardModule } from './modules/dashboard/dashboard.module.js';
import { StorageModule } from './modules/storage/storage.module.js';
import { NotificationsModule } from './modules/notifications/notifications.module.js';
import { ReleasesModule } from './modules/releases/releases.module.js';

@Module({
  imports: [
    ConfigModule.forRoot({ isGlobal: true, validate: validateEnv }),
    ThrottlerModule.forRoot([{ ttl: 60_000, limit: 120 }]),
    ScheduleModule.forRoot(),
    PrismaModule,
    ActivityModule,
    AuthModule,
    UsersModule,
    HealthModule,
    StudentsModule,
    CoursesModule,
    BatchesModule,
    EnquiriesModule,
    FacultyModule,
    QuestionsModule,
    TestsModule,
    MaterialsModule,
    VideosModule,
    DoubtsModule,
    ClassesModule,
    FeesModule,
    DashboardModule,
    StorageModule,
    NotificationsModule,
    ReleasesModule,
  ],
  providers: [
    // Order matters: rate limit → authenticate → authorize by role.
    { provide: APP_GUARD, useClass: ThrottlerGuard },
    { provide: APP_GUARD, useClass: JwtAuthGuard },
    { provide: APP_GUARD, useClass: RolesGuard },
  ],
})
export class AppModule {}
