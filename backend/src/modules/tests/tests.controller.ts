import {
  Body,
  Controller,
  Delete,
  Get,
  Param,
  ParseUUIDPipe,
  Patch,
  Post,
  Put,
  Query,
  UploadedFile,
  UseInterceptors,
} from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import { ApiBearerAuth, ApiConsumes, ApiTags } from '@nestjs/swagger';
import { CurrentUser } from '../../common/decorators/current-user.decorator.js';
import { Roles } from '../../common/decorators/roles.decorator.js';
import type { AuthUser } from '../../common/types/auth-user.js';
import { Role } from '../../generated/prisma/enums.js';
import { AttemptsService } from './attempts.service.js';
import {
  CreateTestDto,
  ListTestsQueryDto,
  SaveAnswersDto,
  SaveMarksDto,
  SetTestBatchesDto,
  SetTestDemoDto,
  SetTestQuestionsDto,
  UpdateTestDto,
} from './dto/test.dto.js';
import { MAX_IMAGE_BYTES, type UploadedImage } from '../questions/questions.service.js';
import { TestsService } from './tests.service.js';

/** Test builder + results: admin and faculty. */
@ApiTags('tests')
@ApiBearerAuth()
@Controller('tests')
export class TestsController {
  constructor(private readonly tests: TestsService) {}

  @Roles(Role.ADMIN, Role.FACULTY)
  @Get()
  list(@CurrentUser() user: AuthUser, @Query() q: ListTestsQueryDto) {
    return this.tests.list(user, q);
  }

  @Roles(Role.ADMIN, Role.FACULTY)
  @Post()
  create(@CurrentUser() user: AuthUser, @Body() dto: CreateTestDto) {
    return this.tests.create(user, dto);
  }

  @Roles(Role.ADMIN, Role.FACULTY)
  @Get(':id')
  get(@CurrentUser() user: AuthUser, @Param('id', ParseUUIDPipe) id: string) {
    return this.tests.get(user, id);
  }

  @Roles(Role.ADMIN, Role.FACULTY)
  @Patch(':id')
  update(
    @CurrentUser() user: AuthUser,
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: UpdateTestDto,
  ) {
    return this.tests.update(user, id, dto);
  }

  @Roles(Role.ADMIN, Role.FACULTY)
  @Put(':id/questions')
  setQuestions(
    @CurrentUser() user: AuthUser,
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: SetTestQuestionsDto,
  ) {
    return this.tests.setQuestions(user, id, dto);
  }

  @Roles(Role.ADMIN, Role.FACULTY)
  @Put(':id/batches')
  setBatches(
    @CurrentUser() user: AuthUser,
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: SetTestBatchesDto,
  ) {
    return this.tests.setBatches(user, id, dto);
  }

  @Roles(Role.ADMIN, Role.FACULTY)
  @Post(':id/publish')
  publish(@CurrentUser() user: AuthUser, @Param('id', ParseUUIDPipe) id: string) {
    return this.tests.publish(user, id);
  }

  @Roles(Role.ADMIN, Role.FACULTY)
  @Post(':id/demo')
  setDemo(
    @CurrentUser() user: AuthUser,
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: SetTestDemoDto,
  ) {
    return this.tests.setDemo(user, id, dto.isDemo);
  }

  @Roles(Role.ADMIN, Role.FACULTY)
  @Post(':id/close')
  close(@CurrentUser() user: AuthUser, @Param('id', ParseUUIDPipe) id: string) {
    return this.tests.close(user, id);
  }

  @Roles(Role.ADMIN, Role.FACULTY)
  @Get(':id/results')
  results(@CurrentUser() user: AuthUser, @Param('id', ParseUUIDPipe) id: string) {
    return this.tests.results(user, id);
  }

  /** One student's written answers, for checking. */
  @Roles(Role.ADMIN, Role.FACULTY)
  @Get(':id/attempts/:attemptId')
  answerSheet(
    @CurrentUser() user: AuthUser,
    @Param('id', ParseUUIDPipe) id: string,
    @Param('attemptId', ParseUUIDPipe) attemptId: string,
  ) {
    return this.tests.answerSheet(user, id, attemptId);
  }

  @Roles(Role.ADMIN, Role.FACULTY)
  @Put(':id/attempts/:attemptId/marks')
  saveMarks(
    @CurrentUser() user: AuthUser,
    @Param('id', ParseUUIDPipe) id: string,
    @Param('attemptId', ParseUUIDPipe) attemptId: string,
    @Body() dto: SaveMarksDto,
  ) {
    return this.tests.saveMarks(user, id, attemptId, dto);
  }

  @Roles(Role.ADMIN, Role.FACULTY)
  @Delete(':id')
  remove(@CurrentUser() user: AuthUser, @Param('id', ParseUUIDPipe) id: string) {
    return this.tests.remove(user, id);
  }
}

/** Student side: find a test, take it, see the result. */
@ApiTags('attempts')
@ApiBearerAuth()
@Roles(Role.STUDENT)
@Controller()
export class AttemptsController {
  constructor(private readonly attempts: AttemptsService) {}

  @Get('my/tests')
  available(@CurrentUser() user: AuthUser) {
    return this.attempts.available(user);
  }

  @Get('my/attempts')
  mine(@CurrentUser() user: AuthUser) {
    return this.attempts.mine(user);
  }

  @Post('my/tests/:id/start')
  start(@CurrentUser() user: AuthUser, @Param('id', ParseUUIDPipe) id: string) {
    return this.attempts.start(user, id);
  }

  @Get('attempts/:id')
  paper(@CurrentUser() user: AuthUser, @Param('id', ParseUUIDPipe) id: string) {
    return this.attempts.getPaper(user, id);
  }

  @Put('attempts/:id/answers')
  save(
    @CurrentUser() user: AuthUser,
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: SaveAnswersDto,
  ) {
    return this.attempts.saveAnswers(user, id, dto);
  }

  /** The student came back after leaving the app mid-test. (Path kept for older app builds.) */
  @Post('attempts/:id/background')
  background(@CurrentUser() user: AuthUser, @Param('id', ParseUUIDPipe) id: string) {
    return this.attempts.reportLeave(user, id);
  }

  @Post('attempts/:id/answers/:questionId/images')
  @ApiConsumes('multipart/form-data')
  @UseInterceptors(FileInterceptor('file', { limits: { fileSize: MAX_IMAGE_BYTES, files: 1 } }))
  addImage(
    @CurrentUser() user: AuthUser,
    @Param('id', ParseUUIDPipe) id: string,
    @Param('questionId', ParseUUIDPipe) questionId: string,
    @UploadedFile() file: UploadedImage | undefined,
  ) {
    return this.attempts.addAnswerImage(user, id, questionId, file);
  }

  @Delete('attempts/:id/answers/:questionId/images/:imageId')
  removeImage(
    @CurrentUser() user: AuthUser,
    @Param('id', ParseUUIDPipe) id: string,
    @Param('questionId', ParseUUIDPipe) questionId: string,
    @Param('imageId') imageId: string,
  ) {
    return this.attempts.removeAnswerImage(user, id, questionId, imageId);
  }

  @Post('attempts/:id/submit')
  submit(@CurrentUser() user: AuthUser, @Param('id', ParseUUIDPipe) id: string) {
    return this.attempts.submit(user, id);
  }

  @Get('attempts/:id/result')
  result(@CurrentUser() user: AuthUser, @Param('id', ParseUUIDPipe) id: string) {
    return this.attempts.result(user, id);
  }
}
