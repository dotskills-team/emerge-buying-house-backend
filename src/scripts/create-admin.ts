import { parseArgs } from 'node:util';
import { z } from 'zod';
import { connectDatabase, disconnectDatabase } from '../config/db.js';
import { hashPassword } from '../core/auth/utils/password.js';
import { MongoUserRepository } from '../modules/users/repositories/user.repository.js';

// Registration is out of scope, so the first user is created from the command line:
//   npm run seed:admin -- --name "Admin" --email admin@example.com --password "a-long-passphrase"
const inputSchema = z.object({
  name: z.string().trim().min(2, 'name is required'),
  email: z.string().trim().toLowerCase().pipe(z.email('email is invalid')),
  password: z.string().min(12, 'password must be at least 12 characters').max(128),
});

async function main(): Promise<void> {
  const { values } = parseArgs({
    options: {
      name: { type: 'string' },
      email: { type: 'string' },
      password: { type: 'string' },
    },
  });

  const parsed = inputSchema.safeParse(values);
  if (!parsed.success) {
    console.error(z.prettifyError(parsed.error));
    process.exitCode = 1;
    return;
  }
  const { name, email, password } = parsed.data;

  await connectDatabase();
  try {
    const users = new MongoUserRepository();
    if (await users.findByEmail(email)) {
      console.error(`A user with email ${email} already exists.`);
      process.exitCode = 1;
      return;
    }
    await users.create({ name, email, passwordHash: await hashPassword(password) });
    console.log(`Created user ${email}`);
  } finally {
    await disconnectDatabase();
  }
}

main().catch((err) => {
  console.error(err);
  process.exitCode = 1;
});