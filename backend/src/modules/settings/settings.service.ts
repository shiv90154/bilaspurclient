import { Injectable } from '@nestjs/common';
import type { AuthUser } from '../../common/types/auth-user.js';
import { PrismaService } from '../../prisma/prisma.service.js';
import { ActivityService } from '../activity/activity.service.js';
import type { UpdateSettingsDto } from './dto/settings.dto.js';

/** Every switch the admin can flip, with the value used until someone changes it. */
const DEFAULTS = {
  /** Name + phone overlay in the student app. Off until the admin turns it on. */
  watermarkEnabled: false,
  /** The app refuses to run while Developer options / USB debugging are on. */
  blockDeveloperOptions: true,
  /** Shown on the public privacy policy / terms / account deletion pages. */
  instituteName: 'DHĪ',
  contactEmail: '',
  contactPhone: '',
  address: '',
};

/** The settings anyone may read (public legal pages, the app's about/consent screens). */
export const PUBLIC_KEYS = ['instituteName', 'contactEmail', 'contactPhone', 'address', 'blockDeveloperOptions'] as const;

export type AppSettings = typeof DEFAULTS;
type SettingKey = keyof AppSettings;

@Injectable()
export class SettingsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly activity: ActivityService,
  ) {}

  async all(): Promise<AppSettings> {
    const rows = await this.prisma.appSetting.findMany({
      where: { key: { in: Object.keys(DEFAULTS) } },
    });
    const settings = { ...DEFAULTS };
    for (const row of rows) {
      const key = row.key as SettingKey;
      // Ignore a stored value of the wrong type rather than handing it to clients.
      if (typeof row.value === typeof DEFAULTS[key]) {
        (settings as Record<SettingKey, unknown>)[key] = row.value;
      }
    }
    return settings;
  }

  async get<K extends SettingKey>(key: K): Promise<AppSettings[K]> {
    return (await this.all())[key];
  }

  async publicInfo() {
    const all = await this.all();
    return Object.fromEntries(PUBLIC_KEYS.map((k) => [k, all[k]])) as Pick<AppSettings, (typeof PUBLIC_KEYS)[number]>;
  }

  async update(admin: AuthUser, dto: UpdateSettingsDto): Promise<AppSettings> {
    const changes = Object.entries(dto)
      .filter(([, v]) => v !== undefined)
      .map(([k, v]) => [k, typeof v === 'string' ? v.trim() : v]) as [SettingKey, unknown][];
    await this.prisma.$transaction(
      changes.map(([key, value]) =>
        this.prisma.appSetting.upsert({
          where: { key },
          create: { key, value: value as never, updatedById: admin.id },
          update: { value: value as never, updatedById: admin.id },
        }),
      ),
    );
    if (changes.length) {
      await this.activity.log({
        actorId: admin.id,
        action: 'settings.update',
        entity: 'settings',
        meta: Object.fromEntries(changes) as Record<string, string | boolean>,
      });
    }
    return this.all();
  }
}
