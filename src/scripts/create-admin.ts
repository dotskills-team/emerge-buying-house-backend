import { parseArgs } from 'node:util';
import { z } from 'zod';
import { connectDatabase, disconnectDatabase } from '../config/db.js';
import { hashPassword } from '../core/auth/utils/password.js';
import { emailSchema, newPasswordSchema } from '../core/auth/validators/auth.validator.js';
import { SUPER_ADMIN } from '../modules/access/permissions.js';
import { MongoUserRepository } from '../modules/users/repositories/user.repository.js';
import { roleSchema } from '../validators/common.validator.js';

// Creates an account from the command line (the first Super Admin, or a recovery account):
//   npm run seed:admin -- --name "Admin" --email admin@example.com --password "a-long-passphrase"
// Optional: --role admin | content_manager | author | viewer   (default: super_admin)
const inputSchema = z.object({
  name: z.string().trim().min(2, 'name is required'),
  email: emailSchema,
  password: newPasswordSchema,
  role: roleSchema.default(SUPER_ADMIN),
});

async function main(): Promise<void> {
  const { values } = parseArgs({
    options: {
      name: { type: 'string' },
      email: { type: 'string' },
      password: { type: 'string' },
      role: { type: 'string' },
    },
  });

  const parsed = inputSchema.safeParse(values);
  if (!parsed.success) {
    console.error(z.prettifyError(parsed.error));
    process.exitCode = 1;
    return;
  }
  const { name, email, password, role } = parsed.data;

  await connectDatabase();
  try {
    const users = new MongoUserRepository();
    if (await users.findByEmail(email)) {
      console.error(`A user with email ${email} already exists.`);
      process.exitCode = 1;
      return;
    }
    await users.create({ name, email, passwordHash: await hashPassword(password), role });
    console.log(`Created ${role} user ${email}`);
  } finally {
    await disconnectDatabase();
  }
}

main().catch((err) => {
  console.error(err);
  process.exitCode = 1;
});
