import { ConflictException, Injectable, NotFoundException } from '@nestjs/common';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { IsBoolean, IsNotEmpty, IsOptional, IsString, IsUUID, MaxLength } from 'class-validator';
import type { AuthUser } from '../../common/types/auth-user.js';
import { Prisma } from '../../generated/prisma/client.js';
import { PrismaService } from '../../prisma/prisma.service.js';
import { ActivityService } from '../activity/activity.service.js';

export class CreateSeriesDto {
  @ApiProperty({ example: 'NEET Mock Series 2027' })
  @IsString()
  @IsNotEmpty()
  @MaxLength(120)
  name!: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  @MaxLength(1000)
  description?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsUUID()
  courseId?: string;
}

export class UpdateSeriesDto {
  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  @IsNotEmpty()
  @MaxLength(120)
  name?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  @MaxLength(1000)
  description?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsBoolean()
  active?: boolean;
}

/** Test series: a named bundle of tests. Archiving a series keeps its tests (they just lose the label). */
@Injectable()
export class SeriesService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly activity: ActivityService,
  ) {}

  list(includeArchived = false) {
    return this.prisma.testSeries.findMany({
      where: includeArchived ? {} : { active: true },
      orderBy: { name: 'asc' },
      include: {
        course: { select: { id: true, name: true } },
        _count: { select: { tests: true } },
      },
    });
  }

  async create(user: AuthUser, dto: CreateSeriesDto) {
    return this.run(async () => {
      const series = await this.prisma.testSeries.create({ data: dto });
      await this.activity.log({ actorId: user.id, action: 'test_series.create', entity: 'test_series', entityId: series.id });
      return series;
    });
  }

  async update(user: AuthUser, id: string, dto: UpdateSeriesDto) {
    return this.run(async () => {
      const series = await this.prisma.testSeries.update({ where: { id }, data: dto });
      await this.activity.log({ actorId: user.id, action: 'test_series.update', entity: 'test_series', entityId: id });
      return series;
    });
  }

  private async run<T>(fn: () => Promise<T>): Promise<T> {
    try {
      return await fn();
    } catch (err) {
      if (err instanceof Prisma.PrismaClientKnownRequestError) {
        if (err.code === 'P2002') throw new ConflictException('A series with this name already exists');
        if (err.code === 'P2025') throw new NotFoundException('Series not found');
        if (err.code === 'P2003') throw new NotFoundException('Course not found');
      }
      throw err;
    }
  }
}
