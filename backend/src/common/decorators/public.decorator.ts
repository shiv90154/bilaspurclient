import { SetMetadata } from '@nestjs/common';

export const IS_PUBLIC_KEY = 'isPublic';

/** Skip authentication for this route (login, refresh, health). */
export const Public = () => SetMetadata(IS_PUBLIC_KEY, true);
