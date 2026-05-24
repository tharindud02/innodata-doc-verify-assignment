import { ConfigService } from '@nestjs/config';
import type { StringValue } from 'ms';

export const DEFAULT_JWT_EXPIRES_IN = '1d' as StringValue;

export function getJwtExpiresIn(
  config: ConfigService,
): StringValue | number {
  const expiresIn = config.get<string>('JWT_EXPIRES_IN');
  return expiresIn ? (expiresIn as StringValue) : DEFAULT_JWT_EXPIRES_IN;
}
