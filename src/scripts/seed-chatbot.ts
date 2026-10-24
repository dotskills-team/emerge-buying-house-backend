import { connectDatabase, disconnectDatabase } from '../config/db.js';
import { SUPER_ADMIN } from '../modules/access/permissions.js';
import { seedChatbotAnswers } from '../modules/chatbot/services/chatbot.service.js';
import { UserModel } from '../modules/users/models/user.model.js';

// Adds the chatbot's starter answers (modules/chatbot/seed-answers.ts):
//   npm run seed:chatbot
// Safe to run again: answers whose question already exists are skipped, never overwritten.
async function main(): Promise<void> {
  await connectDatabase();
  try {
    const author = await UserModel.findOne({ role: SUPER_ADMIN, isActive: true })
      .sort({ createdAt: 1 })
      .lean();
    if (!author) {
      console.error('No Super Admin found. Create one first with `npm run seed:admin`.');
      process.exitCode = 1;
      return;
    }
    const { created, skipped } = await seedChatbotAnswers(String(author._id));
    console.log(`Chatbot answers: ${created} added, ${skipped} already there.`);
  } finally {
    await disconnectDatabase();
  }
}

main().catch((err) => {
  console.error(err);
  process.exitCode = 1;
});
