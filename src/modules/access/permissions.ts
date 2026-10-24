/**
 * The permission catalog and the default role definitions. Permissions are the unit the backend
 * checks; roles are named bundles of them. A user's effective permissions are their role's
 * permissions plus individual grants, minus individual revokes. Super Admin always has everything.
 */
export const PERMISSION_DEFS = [
  { key: 'users.read', group: 'Users', label: 'View users' },
  { key: 'users.create', group: 'Users', label: 'Create users' },
  { key: 'users.update', group: 'Users', label: 'Edit user details' },
  { key: 'users.status', group: 'Users', label: 'Activate or deactivate users' },
  { key: 'roles.read', group: 'Access control', label: 'View roles' },
  { key: 'roles.assign', group: 'Access control', label: 'Assign roles to users' },
  { key: 'roles.manage', group: 'Access control', label: 'Change role permissions' },
  { key: 'permissions.read', group: 'Access control', label: 'View permissions' },
  { key: 'permissions.assign', group: 'Access control', label: 'Grant or revoke user permissions' },
  { key: 'audit.read', group: 'Access control', label: 'View the audit log' },
  { key: 'posts.read', group: 'Blog', label: 'View all posts' },
  { key: 'posts.create', group: 'Blog', label: 'Write posts and edit own drafts' },
  { key: 'posts.update', group: 'Blog', label: 'Edit any post' },
  { key: 'posts.publish', group: 'Blog', label: 'Publish and unpublish posts' },
  { key: 'posts.delete', group: 'Blog', label: 'Move posts to trash, restore and delete' },
  { key: 'categories.manage', group: 'Blog', label: 'Manage categories' },
  { key: 'products.read', group: 'Products', label: 'View all products' },
  { key: 'products.manage', group: 'Products', label: 'Create and edit products' },
  { key: 'products.publish', group: 'Products', label: 'Publish and unpublish products' },
  {
    key: 'products.delete',
    group: 'Products',
    label: 'Move products to trash, restore and delete',
  },
  { key: 'products.categories', group: 'Products', label: 'Manage product categories' },
  { key: 'media.upload', group: 'Content', label: 'Upload images' },
  { key: 'inquiries.read', group: 'Inquiries', label: 'View contact form messages' },
  {
    key: 'inquiries.manage',
    group: 'Inquiries',
    label: 'Reply to messages and change their status',
  },
  { key: 'inquiries.delete', group: 'Inquiries', label: 'Delete contact form messages' },
  {
    key: 'chatbot.manage',
    group: 'Chatbot',
    label: 'Write chatbot answers and see unanswered questions',
  },
  { key: 'profile.read', group: 'Account', label: 'View own profile' },
  { key: 'profile.update', group: 'Account', label: 'Edit own profile' },
  { key: 'auth.password.change', group: 'Account', label: 'Change own password' },
] as const;

export type Permission = (typeof PERMISSION_DEFS)[number]['key'];

export const ALL_PERMISSIONS: Permission[] = PERMISSION_DEFS.map((p) => p.key);
const permissionSet = new Set<string>(ALL_PERMISSIONS);

export const isPermission = (value: unknown): value is Permission =>
  typeof value === 'string' && permissionSet.has(value);

export const ROLE_KEYS = ['super_admin', 'admin', 'content_manager', 'author', 'viewer'] as const;
export type RoleKey = (typeof ROLE_KEYS)[number];

export const SUPER_ADMIN: RoleKey = 'super_admin';
/** Applied when a user record has no valid role: least privilege. */
export const FALLBACK_ROLE: RoleKey = 'viewer';

const roleSet = new Set<string>(ROLE_KEYS);
export const isRoleKey = (value: unknown): value is RoleKey =>
  typeof value === 'string' && roleSet.has(value);

const ACCOUNT: Permission[] = ['profile.read', 'profile.update', 'auth.password.change'];
const BLOG_FULL: Permission[] = [
  'posts.read',
  'posts.create',
  'posts.update',
  'posts.publish',
  'posts.delete',
  'categories.manage',
  'media.upload',
];
export const PRODUCTS_FULL: Permission[] = [
  'products.read',
  'products.manage',
  'products.publish',
  'products.delete',
  'products.categories',
];

export const INQUIRIES_FULL: Permission[] = [
  'inquiries.read',
  'inquiries.manage',
  'inquiries.delete',
];

export interface RoleDefinition {
  name: string;
  description: string;
  permissions: Permission[];
}

export const DEFAULT_ROLES: Record<RoleKey, RoleDefinition> = {
  super_admin: {
    name: 'Super Admin',
    description: 'Full access, including role permissions and other Super Admins.',
    permissions: ALL_PERMISSIONS,
  },
  admin: {
    name: 'Admin',
    description:
      'Manages users, all content and contact messages. Cannot change Super Admins or role definitions.',
    permissions: [
      'users.read',
      'users.create',
      'users.update',
      'users.status',
      'roles.read',
      'roles.assign',
      'permissions.read',
      'audit.read',
      ...BLOG_FULL,
      ...PRODUCTS_FULL,
      ...INQUIRIES_FULL,
      'chatbot.manage',
      ...ACCOUNT,
    ],
  },
  content_manager: {
    name: 'Content Manager',
    description:
      'Writes, edits and publishes blog posts, products and chatbot answers, and manages categories.',
    permissions: [...BLOG_FULL, ...PRODUCTS_FULL, 'chatbot.manage', ...ACCOUNT],
  },
  author: {
    name: 'Author',
    description: 'Writes posts and edits their own drafts. Cannot publish.',
    permissions: ['posts.create', 'media.upload', ...ACCOUNT],
  },
  viewer: {
    name: 'Viewer',
    description: 'Read-only access to the dashboard, blog posts and products.',
    permissions: ['posts.read', 'products.read', ...ACCOUNT],
  },
};

export function resolvePermissions(
  role: RoleKey,
  rolePermissions: readonly Permission[],
  grants: readonly Permission[],
  revokes: readonly Permission[],
): Permission[] {
  if (role === SUPER_ADMIN) return [...ALL_PERMISSIONS];
  const revoked = new Set(revokes);
  const effective = new Set([...rolePermissions, ...grants].filter((p) => !revoked.has(p)));
  // Keep catalog order so responses are stable.
  return ALL_PERMISSIONS.filter((p) => effective.has(p));
}
