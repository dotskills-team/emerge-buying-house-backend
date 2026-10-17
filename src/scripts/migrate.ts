import mongoose from 'mongoose';
import { parseArgs } from 'node:util';
import { connectDatabase, disconnectDatabase } from '../config/db.js';
import { migrations } from '../migrations/index.js';

// Usage:
//   npm run migrate                       apply every pending migration, in order
//   npm run migrate -- --status           list applied and pending migrations
//   npm run migrate -- --down <id>        roll back one applied migration (back up the database first)

interface AppliedDoc {
  _id: string;
  appliedAt: Date;
}

async function main(): Promise<void> {
  const { values } = parseArgs({
    options: { status: { type: 'boolean' }, down: { type: 'string' } },
  });

  await connectDatabase();
  try {
    const collection = mongoose.connection.collection<AppliedDoc>('migrations');
    const applied = new Set((await collection.find().toArray()).map((d) => d._id));

    if (values.status) {
      for (const m of migrations) {
        console.log(`${applied.has(m.id) ? 'applied' : 'pending'}  ${m.id}  ${m.description}`);
      }
      return;
    }

    if (values.down) {
      const migration = migrations.find((m) => m.id === values.down);
      if (!migration || !applied.has(migration.id)) {
        console.error(`Migration "${values.down}" is not applied.`);
        process.exitCode = 1;
        return;
      }
      console.log(`Rolling back ${migration.id}…`);
      await migration.down();
      await collection.deleteOne({ _id: migration.id });
      console.log('Done.');
      return;
    }

    const pending = migrations.filter((m) => !applied.has(m.id));
    if (pending.length === 0) {
      console.log('Database is up to date.');
      return;
    }
    for (const m of pending) {
      console.log(`Applying ${m.id}: ${m.description}`);
      await m.up();
      await collection.insertOne({ _id: m.id, appliedAt: new Date() });
    }
    console.log(`Applied ${pending.length} migration(s).`);
  } finally {
    await disconnectDatabase();
  }
}

main().catch((err) => {
  console.error(err);
  process.exitCode = 1;
});
