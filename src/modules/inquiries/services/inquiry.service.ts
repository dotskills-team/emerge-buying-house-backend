import { randomInt } from 'node:crypto';
import type { QueryFilter } from 'mongoose';
import type { Mailer } from '../../../lib/mailer.js';
import { HttpError } from '../../../middleware/error.middleware.js';
import { escapeRegExp } from '../../../utils/regex.js';
import {
  INQUIRY_STATUSES,
  InquiryModel,
  type DeliveryState,
  type IInquiry,
  type InquiryStatus,
} from '../models/inquiry.model.js';
import {
  replyEmail,
  teamNotificationEmail,
  visitorAcknowledgementEmail,
} from '../utils/inquiry-emails.js';
import type {
  ListInquiriesQuery,
  SubmitInquiryInput,
  UpdateInquiryInput,
} from '../validators/inquiry.validator.js';

export interface InquiryConfig {
  /** Team addresses told about each new inquiry. Empty: no notification email. */
  notifyTo: string[];
  /** Where visitors' replies to our emails go. */
  replyTo?: string;
  appName: string;
  /** Dashboard origin, for the "Open in dashboard" link. */
  appUrl: string;
}

// No 0/O or 1/I, so a reference read out over the phone is unambiguous.
const REFERENCE_ALPHABET = '23456789ABCDEFGHJKLMNPQRSTUVWXYZ';

/** EBH-YYMMDD-XXXX: the date it arrived plus four random characters. */
export function makeReference(now = new Date()): string {
  const date = now.toISOString().slice(2, 10).replace(/-/g, '');
  let suffix = '';
  for (let i = 0; i < 4; i += 1) suffix += REFERENCE_ALPHABET[randomInt(REFERENCE_ALPHABET.length)];
  return `EBH-${date}-${suffix}`;
}

const isDuplicateReference = (err: unknown) =>
  (err as { code?: unknown; keyPattern?: Record<string, unknown> } | null)?.code === 11000 &&
  Boolean((err as { keyPattern?: Record<string, unknown> }).keyPattern?.reference);

const notFound = () => new HttpError(404, 'This inquiry no longer exists.', 'NOT_FOUND');

type InquiryDocument = NonNullable<Awaited<ReturnType<typeof InquiryModel.findOne>>>;

/** The JSON shape the dashboard reads, with reply authors as `{ id, name }`. */
function toView(doc: InquiryDocument) {
  const json = doc.toJSON() as unknown as Omit<IInquiry, 'replies'> & {
    id: string;
    replies: Array<{
      message: string;
      sentAt: Date;
      sentBy: { _id: unknown; name: string } | null;
    }>;
  };
  return {
    ...json,
    replies: json.replies.map((r) => ({
      message: r.message,
      sentAt: r.sentAt,
      sentBy:
        r.sentBy && typeof r.sentBy === 'object' && 'name' in r.sentBy
          ? { id: String(r.sentBy._id), name: r.sentBy.name }
          : null,
    })),
  };
}

export function createInquiryService({
  mailer,
  config,
}: {
  mailer: Mailer;
  config: InquiryConfig;
}) {
  const replyTo = config.replyTo ?? config.notifyTo[0];

  async function load(id: string) {
    const doc = await InquiryModel.findById(id).populate('replies.sentBy', 'name').exec();
    if (!doc) throw notFound();
    return doc;
  }

  /** Sends both automatic emails. A failure is logged and recorded, never shown to the visitor. */
  async function notify(
    doc: InquiryDocument,
  ): Promise<{ team: DeliveryState; visitor: DeliveryState }> {
    const attempt = async (enabled: boolean, send: () => Promise<void>, what: string) => {
      if (!enabled) return 'skipped' as const;
      try {
        await send();
        return 'sent' as const;
      } catch (err) {
        console.error(`Inquiry ${doc.reference}: ${what} email failed:`, (err as Error).message);
        return 'failed' as const;
      }
    };
    const [team, visitor] = await Promise.all([
      attempt(
        mailer.configured && config.notifyTo.length > 0,
        () =>
          mailer.send(
            teamNotificationEmail({
              to: config.notifyTo,
              inquiry: doc,
              dashboardUrl: `${config.appUrl}/dashboard/inquiries/${String(doc._id)}`,
              appName: config.appName,
            }),
          ),
        'team notification',
      ),
      attempt(
        mailer.configured,
        () =>
          mailer.send(
            visitorAcknowledgementEmail({ inquiry: doc, appName: config.appName, replyTo }),
          ),
        'confirmation',
      ),
    ]);
    return { team, visitor };
  }

  return {
    /** Public contact form. Bots that fill the honeypot get a normal-looking answer and nothing is stored. */
    async submit({ website, ...data }: SubmitInquiryInput) {
      if (website) return { reference: makeReference(), confirmationSent: false };

      let doc: InquiryDocument | undefined;
      for (let attempt = 0; !doc; attempt += 1) {
        try {
          doc = await InquiryModel.create({ ...data, reference: makeReference() });
        } catch (err) {
          if (!isDuplicateReference(err) || attempt >= 4) throw err;
        }
      }

      const notifications = await notify(doc);
      await InquiryModel.updateOne({ _id: doc._id }, { $set: { notifications } });
      return { reference: doc.reference, confirmationSent: notifications.visitor === 'sent' };
    },

    async list({ q, status, topic, page, limit }: ListInquiriesQuery) {
      const filter: QueryFilter<IInquiry> = {};
      if (status) filter.status = status;
      if (topic) filter.topic = topic;
      if (q) {
        const rx = new RegExp(escapeRegExp(q), 'i');
        filter.$or = [
          { name: rx },
          { email: rx },
          { company: rx },
          { reference: rx },
          { product: rx },
          { message: rx },
        ];
      }
      const [items, total] = await Promise.all([
        InquiryModel.find(filter)
          .sort({ createdAt: -1, _id: -1 })
          .skip((page - 1) * limit)
          .limit(limit)
          .select('-replies -note')
          .exec(),
        InquiryModel.countDocuments(filter),
      ]);
      return {
        items: items.map((d) => d.toJSON()),
        meta: { page, limit, total, totalPages: Math.max(1, Math.ceil(total / limit)) },
      };
    },

    /** Count per status, plus `all`. */
    async stats() {
      const rows = await InquiryModel.aggregate<{ _id: InquiryStatus; count: number }>([
        { $group: { _id: '$status', count: { $sum: 1 } } },
      ]);
      const counts = Object.fromEntries(INQUIRY_STATUSES.map((s) => [s, 0])) as Record<
        InquiryStatus,
        number
      >;
      for (const r of rows) if (r._id in counts) counts[r._id] = r.count;
      return { ...counts, all: rows.reduce((sum, r) => sum + r.count, 0) };
    },

    async get(id: string) {
      return toView(await load(id));
    },

    /** Opening a new inquiry marks it as being handled. Anything else is left as it is. */
    async open(id: string) {
      await InquiryModel.updateOne({ _id: id, status: 'new' }, { $set: { status: 'open' } });
      return toView(await load(id));
    },

    async update(id: string, input: UpdateInquiryInput) {
      const doc = await load(id);
      if (input.status !== undefined) doc.status = input.status;
      if (input.note !== undefined) doc.note = input.note;
      await doc.save();
      return toView(doc);
    },

    /** Emails the visitor and keeps a copy with the inquiry. Nothing is saved if sending fails. */
    async reply(id: string, sender: { id: string; name: string }, message: string) {
      if (!mailer.configured) {
        throw new HttpError(
          503,
          'Email is not set up on the server, so replies cannot be sent from here. Reply from your own email instead.',
          'EMAIL_UNAVAILABLE',
        );
      }
      const doc = await load(id);
      try {
        await mailer.send(
          replyEmail({
            inquiry: doc,
            message,
            senderName: sender.name,
            appName: config.appName,
            replyTo,
          }),
        );
      } catch (err) {
        console.error(`Inquiry ${doc.reference}: reply email failed:`, (err as Error).message);
        throw new HttpError(
          502,
          'The email could not be sent. Please try again in a moment.',
          'EMAIL_FAILED',
        );
      }
      const sentAt = new Date();
      await InquiryModel.updateOne(
        { _id: doc._id },
        {
          $push: { replies: { message, sentBy: sender.id, sentAt } },
          $set: { status: 'replied' },
        },
      );
      return toView(await load(id));
    },

    async remove(id: string) {
      const { deletedCount } = await InquiryModel.deleteOne({ _id: id });
      if (deletedCount === 0) throw notFound();
    },
  };
}

export type InquiryService = ReturnType<typeof createInquiryService>;
