import { Controller, Get, Param, ParseUUIDPipe, Query, Res } from '@nestjs/common';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';
import type { Response } from 'express';
import { istDate, istDateTime, sendCsv } from '../../common/csv.js';
import { CurrentUser } from '../../common/decorators/current-user.decorator.js';
import { Roles } from '../../common/decorators/roles.decorator.js';
import type { AuthUser } from '../../common/types/auth-user.js';
import { Role } from '../../generated/prisma/enums.js';
import {
  AttendanceReportQueryDto,
  DateRangeQueryDto,
  StudentAttendanceQueryDto,
} from './dto/report.dto.js';
import { ReportsService } from './reports.service.js';

/** Every report has a JSON route for the page and a `/csv` twin for the download. */
@ApiTags('reports')
@ApiBearerAuth()
@Roles(Role.ADMIN, Role.FACULTY)
@Controller('reports')
export class ReportsController {
  constructor(private readonly reports: ReportsService) {}

  @Get('tests/:id')
  test(@CurrentUser() user: AuthUser, @Param('id', ParseUUIDPipe) id: string) {
    return this.reports.testResults(user, id);
  }

  @Get('tests/:id/csv')
  async testCsv(
    @CurrentUser() user: AuthUser,
    @Param('id', ParseUUIDPipe) id: string,
    @Res() res: Response,
  ) {
    const r = await this.reports.testResults(user, id);
    await this.reports.logExport(user, 'test-results', { testId: id });
    sendCsv(
      res,
      `test-results-${r.test.title}`,
      ['Rank', 'Name', 'Phone', 'Score', 'Out of', 'Percentage', 'Correct', 'Wrong', 'Unanswered', 'Time taken (min)', 'Left the app', 'Status'],
      r.rows.map((x) => [
        x.rank, x.name, x.phone, x.score, r.test.totalMarks, x.percentage, x.correct, x.incorrect,
        x.unanswered, x.timeTakenSec != null ? +(x.timeTakenSec / 60).toFixed(1) : '', x.backgroundHits, x.status,
      ]),
    );
  }

  @Get('attendance')
  attendance(@CurrentUser() user: AuthUser, @Query() q: AttendanceReportQueryDto) {
    return this.reports.attendance(user, q);
  }

  @Get('attendance/csv')
  async attendanceCsv(
    @CurrentUser() user: AuthUser,
    @Query() q: AttendanceReportQueryDto,
    @Res() res: Response,
  ) {
    const r = await this.reports.attendance(user, q);
    await this.reports.logExport(user, 'attendance', { ...q });
    sendCsv(
      res,
      'class-attendance',
      ['Date', 'Class', 'Batch', 'Teacher', 'Expected', 'Joined', 'Attendance %'],
      r.rows.map((x) => [istDateTime(x.startAt), x.title, x.batch, x.teacher, x.expected, x.attended, x.percentage]),
    );
  }

  @Get('attendance/students')
  studentAttendance(@CurrentUser() user: AuthUser, @Query() q: StudentAttendanceQueryDto) {
    return this.reports.studentAttendance(user, q);
  }

  @Get('attendance/students/csv')
  async studentAttendanceCsv(
    @CurrentUser() user: AuthUser,
    @Query() q: StudentAttendanceQueryDto,
    @Res() res: Response,
  ) {
    const r = await this.reports.studentAttendance(user, q);
    await this.reports.logExport(user, 'student-attendance', { ...q });
    sendCsv(
      res,
      `attendance-${r.batch.name}`,
      ['Admission no', 'Name', 'Phone', 'Classes held', 'Attended', 'Attendance %'],
      r.rows.map((x) => [x.admissionNo, x.name, x.phone, x.held, x.attended, x.percentage]),
    );
  }

  @Roles(Role.ADMIN)
  @Get('enquiries')
  enquiries(@CurrentUser() user: AuthUser, @Query() q: DateRangeQueryDto) {
    return this.reports.enquiries(user, q);
  }

  @Roles(Role.ADMIN)
  @Get('enquiries/csv')
  async enquiriesCsv(
    @CurrentUser() user: AuthUser,
    @Query() q: DateRangeQueryDto,
    @Res() res: Response,
  ) {
    const r = await this.reports.enquiries(user, q);
    await this.reports.logExport(user, 'enquiries', { ...q });
    sendCsv(
      res,
      'enquiries',
      ['Received on', 'Name', 'Phone', 'Source', 'Course', 'Status', 'Follow-up', 'Handled by'],
      r.rows.map((x) => [
        istDate(x.createdAt), x.name, x.phone, x.source, x.course, x.status,
        x.followUpDate ? x.followUpDate.toISOString().slice(0, 10) : '', x.assignedTo,
      ]),
    );
  }

  @Get('materials')
  materials(@CurrentUser() user: AuthUser, @Query() q: DateRangeQueryDto) {
    return this.reports.materials(user, q);
  }

  @Get('materials/csv')
  async materialsCsv(
    @CurrentUser() user: AuthUser,
    @Query() q: DateRangeQueryDto,
    @Res() res: Response,
  ) {
    const r = await this.reports.materials(user, q);
    await this.reports.logExport(user, 'materials', { ...q });
    sendCsv(
      res,
      'material-views',
      ['Title', 'Subject', 'Batches', 'Opens', 'Students', 'Last opened', 'Uploaded on'],
      r.rows.map((x) => [x.title, x.subject, x.batches, x.views, x.students, istDateTime(x.lastViewedAt), istDate(x.uploadedAt)]),
    );
  }
}
