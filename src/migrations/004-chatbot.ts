import { RoleModel } from '../modules/access/models/role.model.js';
import { DEFAULT_ROLES, type RoleKey } from '../modules/access/permissions.js';
import { ChatAnswerModel } from '../modules/chatbot/models/chat-answer.model.js';
import { UnansweredQuestionModel } from '../modules/chatbot/models/unanswered-question.model.js';
import type { Migration } from './index.js';

const ROLES: RoleKey[] = ['admin', 'content_manager'];

/**
 * Introduces the website chatbot. Additive only: Admins and Content Managers get the chatbot
 * permission (keeping any other changes a Super Admin made to their roles), and the indexes are
 * created.
 */
export const chatbot: Migration = {
  id: '004-chatbot',
  description: 'Add the chatbot permission to Admin and Content Manager and create chatbot indexes',

  async up() {
    for (const key of ROLES) {
      await RoleModel.updateOne(
        { key },
        {
          $addToSet: { permissions: 'chatbot.manage' },
          $set: { description: DEFAULT_ROLES[key].description },
          $inc: { version: 1 },
        },
      );
    }
    await Promise.all([ChatAnswerModel.createIndexes(), UnansweredQuestionModel.createIndexes()]);
  },

  /** Removes the chatbot permission from every role. Answers and questions are kept. */
  async down() {
    await RoleModel.updateMany(
      {},
      { $pull: { permissions: 'chatbot.manage' }, $inc: { version: 1 } },
    );
  },
};
