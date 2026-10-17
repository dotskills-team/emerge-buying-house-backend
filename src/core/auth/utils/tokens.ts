import { createHash, randomBytes } from 'node:crypto';
import { SignJWT, errors, jwtVerify } from 'jose';

const ISSUER = 'emerge-buying-house';
const AUDIENCE = 'emerge-buying-house-web';

export class AccessTokenError extends Error {
  constructor(public readonly reason: 'expired' | 'invalid') {
    super(`Access token ${reason}`);
  }
}

const key = (secret: string) => new TextEncoder().encode(secret);

export interface AccessClaims {
  userId: string;
  familyId: string;
}

export function signAccessToken(
  secret: string,
  claims: AccessClaims,
  ttlSeconds: number,
  now: Date,
): Promise<string> {
  const iat = Math.floor(now.getTime() / 1000);
  return new SignJWT({ sid: claims.familyId })
    .setProtectedHeader({ alg: 'HS256' })
    .setSubject(claims.userId)
    .setIssuer(ISSUER)
    .setAudience(AUDIENCE)
    .setIssuedAt(iat)
    .setExpirationTime(iat + ttlSeconds)
    .sign(key(secret));
}

export async function verifyAccessToken(
  secret: string,
  token: string,
  now: Date,
): Promise<AccessClaims> {
  try {
    const { payload } = await jwtVerify(token, key(secret), {
      issuer: ISSUER,
      audience: AUDIENCE,
      algorithms: ['HS256'],
      currentDate: now,
    });
    if (!payload.sub || typeof payload.sid !== 'string') throw new AccessTokenError('invalid');
    return { userId: payload.sub, familyId: payload.sid };
  } catch (err) {
    if (err instanceof AccessTokenError) throw err;
    throw new AccessTokenError(err instanceof errors.JWTExpired ? 'expired' : 'invalid');
  }
}

/** Opaque, high-entropy token (refresh and password-reset). Only its SHA-256 hash is ever stored. */
export const generateSecretToken = (): string => randomBytes(48).toString('base64url');

export const hashSecretToken = (token: string): string =>
  createHash('sha256').update(token).digest('hex');
