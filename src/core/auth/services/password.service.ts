import { HttpError } from '../../../middleware/error.middleware.js';
import type { Mailer } from '../../../lib/mailer.js';
import type { AuditRecorder } from '../../../modules/audit/services/audit.service.js';
import type {
  ResetTokenRecord,
  ResetTokenRepository,
  SessionRepository,
  UserRepository,
} from '../types/index.js';
import { hashPassword, verifyPassword } from '../utils/password.js';
import { resetPasswordEmail } from '../utils/reset-email.js';
import { generateSecretToken, hashSecretToken } from '../utils/tokens.js';

export interface PasswordConfig {
  resetTtlMs: number;
  /** Frontend origin; reset links point to `${appUrl}/reset-password`. */
  appUrl: string;
  appName: string;
}

export interface PasswordDeps {
  users: UserRepository;
  sessions: SessionRepository;
  resets: ResetTokenRepository;
  mailer: Mailer;
  audit: AuditRecorder;
  config: PasswordConfig;
  now?: () => Date;
}

export type PasswordService = ReturnType<typeof createPasswordService>;

const invalidLink = () =>
  new HttpError(
    400,
    'This reset link is invalid or has expired. Request a new one.',
    'INVALID_RESET_TOKEN',
  );

export function createPasswordService({
  users,
  sessions,
  resets,
  mailer,
  audit,
  config,
  now = () => new Date(),
}: PasswordDeps) {
  async function findUsable(rawToken: string): Promise<ResetTokenRecord> {
    const record = await resets.findByTokenHash(hashSecretToken(rawToken));
    if (!record || record.usedAt || record.expiresAt <= now()) throw invalidLink();
    return record;
  }

  /**
   * Always resolves the same way for known and unknown emails, so the response does not reveal
   * which accounts exist. Delivery failures are logged, not reported to the caller, for the same reason.
   */
  async function requestReset(email: string): Promise<void> {
    if (!mailer.configured) {
      throw new HttpError(
        503,
        'Password reset by email is not available yet. Ask an administrator to reset your password.',
        'EMAIL_NOT_CONFIGURED',
      );
    }
    const user = await users.findByEmail(email);
    if (!user || !user.isActive) return;

    const t = now();
    await resets.invalidateForUser(user.id, t);
    const token = generateSecretToken();
    await resets.create({
      userId: user.id,
      tokenHash: hashSecretToken(token),
      expiresAt: new Date(t.getTime() + config.resetTtlMs),
    });

    // The token travels in the URL fragment, which browsers never send to servers or in Referer.
    const link = `${config.appUrl}/reset-password#token=${token}`;
    try {
      await mailer.send(
        resetPasswordEmail({
          to: user.email,
          name: user.name,
          link,
          ttlMinutes: Math.round(config.resetTtlMs / 60_000),
          appName: config.appName,
        }),
      );
    } catch (err) {
      console.error(`Password reset email to user ${user.id} failed:`, (err as Error).message);
    }
  }

  async function verifyResetToken(rawToken: string): Promise<void> {
    const record = await findUsable(rawToken);
    const user = await users.findById(record.userId);
    if (!user || !user.isActive) throw invalidLink();
  }

  /** Single use: the token is spent first, then every existing login of the user is ended. */
  async function resetPassword(rawToken: string, newPassword: string): Promise<void> {
    const record = await findUsable(rawToken);
    const user = await users.findById(record.userId);
    if (!user || !user.isActive) throw invalidLink();
    if (!(await resets.consume(record.id, now()))) throw invalidLink();

    await users.updatePassword(user.id, await hashPassword(newPassword));
    await sessions.revokeAllForUser(user.id);
    await audit({
      actorId: user.id,
      action: 'auth.password.reset',
      targetType: 'user',
      targetId: user.id,
    });
  }

  /** Requires the current password, then signs out every other device. */
  async function changePassword(input: {
    userId: string;
    currentPassword: string;
    newPassword: string;
    keepFamilyId: string;
  }): Promise<void> {
    const user = await users.findById(input.userId);
    if (!user || !user.isActive) {
      throw new HttpError(401, 'Session has been revoked.', 'SESSION_REVOKED');
    }
    if (!(await verifyPassword(input.currentPassword, user.passwordHash))) {
      throw new HttpError(400, 'Your current password is incorrect.', 'INVALID_CURRENT_PASSWORD');
    }
    if (input.currentPassword === input.newPassword) {
      throw new HttpError(
        400,
        'Choose a password that is different from your current one.',
        'PASSWORD_UNCHANGED',
      );
    }

    await users.updatePassword(user.id, await hashPassword(input.newPassword));
    await resets.invalidateForUser(user.id, now());
    await sessions.revokeAllForUser(user.id, input.keepFamilyId);
    await audit({
      actorId: user.id,
      action: 'auth.password.change',
      targetType: 'user',
      targetId: user.id,
    });
  }

  return { requestReset, verifyResetToken, resetPassword, changePassword };
}
