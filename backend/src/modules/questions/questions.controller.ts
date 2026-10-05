import {
  Body,
  Controller,
  Delete,
  Get,
  Param,
  ParseUUIDPipe,
  Patch,
  Post,
  Query,
} from '@nestjs/common';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';
import { CurrentUser } from '../../common/decorators/current-user.decorator.js';
import { Roles } from '../../common/decorators/roles.decorator.js';
import type { AuthUser } from '../../common/types/auth-user.js';
import { Role } from '../../generated/prisma/enums.js';
import {
  BulkCreateQuestionsDto,
  CreateQuestionDto,
  ListQuestionsQueryDto,
  UpdateQuestionDto,
} from './dto/question.dto.js';
import { QuestionsService } from './questions.service.js';

// The bank contains answers: staff only. Students only ever see questions inside an attempt.
@ApiTags('questions')
@ApiBearerAuth()
@Roles(Role.ADMIN, Role.FACULTY)
@Controller('questions')
export class QuestionsController {
  constructor(private readonly questions: QuestionsService) {}

  @Get()
  list(@Query() q: ListQuestionsQueryDto) {
    return this.questions.list(q);
  }

  @Get(':id')
  get(@Param('id', ParseUUIDPipe) id: string) {
    return this.questions.get(id);
  }

  @Post()
  create(@CurrentUser() user: AuthUser, @Body() dto: CreateQuestionDto) {
    return this.questions.create(user, dto);
  }

  @Post('bulk')
  bulk(@CurrentUser() user: AuthUser, @Body() dto: BulkCreateQuestionsDto) {
    return this.questions.createMany(user, dto.questions);
  }

  @Patch(':id')
  update(
    @CurrentUser() user: AuthUser,
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: UpdateQuestionDto,
  ) {
    return this.questions.update(user, id, dto);
  }

  @Delete(':id')
  archive(@CurrentUser() user: AuthUser, @Param('id', ParseUUIDPipe) id: string) {
    return this.questions.archive(user, id);
  }
}
