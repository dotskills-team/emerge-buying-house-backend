# Emerge Buying House — API

Express 5 + TypeScript + MongoDB (Mongoose), deployed to Vercel as a single serverless function
(`api/index.ts`). Serves authentication, user and role management, the blog CMS and the public blog.

## Run locally

```bash
npm install
cp .env.example .env        # fill in the values (see below)
npm run migrate             # apply database migrations
npm run seed:admin -- --name "Your Name" --email you@example.com --password "a long passphrase"
npm run dev                 # http://localhost:5000
```

MongoDB must be a **replica set** (MongoDB Atlas is one): user, role and permission changes run in
transactions.

| Script | What it does |
| --- | --- |
| `npm run dev` | Start with reload |
| `npm run build` / `npm start` | Compile to `dist/` and run it |
| `npm test` | Unit tests and HTTP integration tests (in-memory MongoDB replica set; no real database) |
| `npm run typecheck` / `npm run lint` | Static checks |
| `npm run migrate` | Apply pending migrations (`-- --status` lists them, `-- --down <id>` rolls one back) |
| `npm run seed:admin` | Create an account from the command line (default role: Super Admin; `--role` to choose) |

## Environment variables

| Name | Required | Purpose |
| --- | --- | --- |
| `MONGODB_URI` | yes | MongoDB connection string (replica set) |
| `CLIENT_ORIGIN` | yes | Frontend origin. Used for CORS, the CSRF origin check and password-reset links |
| `JWT_ACCESS_SECRET` | yes | 32+ random characters for signing access tokens |
| `CLOUDINARY_CLOUD_NAME`, `CLOUDINARY_API_KEY`, `CLOUDINARY_API_SECRET` | yes | Signed image uploads for the blog |
| `RESEND_API_KEY`, `EMAIL_FROM` | for password reset | Resend API key and a sender on a domain verified in Resend. Without both, forgot-password answers "not available" instead of pretending to send |
| `ACCESS_TOKEN_TTL_MINUTES` (15), `REFRESH_TOKEN_TTL_DAYS` (7), `SESSION_MAX_DAYS` (30) | no | Session lifetimes |
| `PASSWORD_RESET_TTL_MINUTES` (30) | no | Reset link lifetime |
| `APP_NAME` ("Emerge Buying House") | no | Name used in emails |
| `NODE_ENV`, `PORT` | no | `production` on Vercel enables secure cookies |

## Structure

```
api/index.ts                 Vercel entry: one Express app per warm instance, reused DB connection
src/
  app.ts, server.ts          App factory and local server
  config/                    Validated env, MongoDB connection, Cloudinary
  core/auth/                 Login, refresh-token rotation, logout, forgot/reset/change password
  modules/
    access/                  Permission catalog, role definitions, requirePermission middleware, /roles, /permissions
    users/                   User model and admin user management (/users)
    profile/                 The signed-in user's own account (/profile)
    audit/                   Audit log of administrative changes (/audit-logs)
    blog/                    Posts and categories: admin (/blog/admin/*) and public (/blog/*)
    health/                  /health
  middleware/                Error handler (one response envelope) and rate limiting
  migrations/                Versioned, idempotent data migrations
  scripts/                   migrate and seed:admin
  test/                      Test helpers (in-memory repositories, integration harness)
```

Every response is `{ success: true, data }` or `{ success: false, message, code, errors? }`.

## Roles and permissions

One Super Admin role plus four standard roles. A user's effective permissions are their role's
permissions plus individual grants, minus individual revokes; they are resolved from the database
on every request, so changes apply immediately.

| Permission | Super Admin | Admin | Content Manager | Author | Viewer |
| --- | :-: | :-: | :-: | :-: | :-: |
| users.read / users.create / users.update / users.status | ✓ | ✓ ¹ | | | |
| roles.read, permissions.read | ✓ | ✓ | | | |
| roles.assign | ✓ | ✓ ² | | | |
| roles.manage, permissions.assign | ✓ | | | | |
| audit.read | ✓ | ✓ | | | |
| posts.read (all posts) | ✓ | ✓ | ✓ | | ✓ |
| posts.create (write, edit own drafts) | ✓ | ✓ | ✓ | ✓ | |
| posts.update (edit any post), posts.publish, posts.delete | ✓ | ✓ | ✓ | | |
| categories.manage | ✓ | ✓ | ✓ | | |
| media.upload | ✓ | ✓ | ✓ | ✓ | |
| profile.read, profile.update, auth.password.change | ✓ | ✓ | ✓ | ✓ | ✓ |

¹ never on Super Admin accounts. ² only roles whose permissions they hold themselves; never Super Admin.

Rules enforced on the server: nobody changes their own role, status or permissions; only a Super Admin
can create, assign or change a Super Admin; nobody grants a permission they do not hold; the last
active Super Admin cannot be demoted or deactivated (checked in a transaction that also serialises
concurrent demotions); Super Admin's permissions are fixed. Role permission lists are editable by a
Super Admin from the dashboard.

## Deploying (Vercel)

The Vercel setup is unchanged: `vercel.json` rewrites every path to `api/index.ts`.

1. **Back up the database** (Atlas snapshot).
2. Add the new environment variables in Vercel if you want password reset: `RESEND_API_KEY`,
   `EMAIL_FROM` (optionally `APP_NAME`, `PASSWORD_RESET_TTL_MINUTES`).
3. **Run the migration against production before deploying this code:**
   `MONGODB_URI="<production uri>" npm run migrate`.
   Migration `001-access-control` is additive: it seeds role definitions, gives every existing user
   the **Super Admin** role (before this release every signed-in user could do everything), and
   creates indexes. Users without a role are treated as Viewers, so running it first avoids locking
   anyone out. Rollback: `npm run migrate -- --down 001-access-control` (the previous code ignores the
   new fields, so rolling back the code alone is also safe).
4. Deploy. Check `GET /api/health` reports `database: connected`, then sign in.
5. Afterwards, review the users list and assign each person their real role.

Known limits: rate limits are kept in memory per serverless instance, so they slow abuse rather
than enforce an exact global cap (a shared store such as Upstash Redis would make them exact).
Account lockout (5 failed sign-ins → 15 minutes) can be triggered by anyone who knows an email.
