import assert from 'node:assert/strict';
import { after, before, describe, it } from 'node:test';
import { startIntegration, type Integration } from '../../test/integration.js';

let api: Integration;
before(async () => {
  api = await startIntegration();
});
after(async () => {
  await api.stop();
});

interface PostView {
  id: string;
  slug: string;
  status: string;
  content: string;
}

describe('blog permissions', () => {
  it('authors write and edit only their own drafts, and cannot publish', async () => {
    const author = await api.signIn('author');
    const other = await api.signIn('author');
    const editor = await api.signIn('content_manager');

    const created = await api.call<PostView>('/api/blog/admin/posts', {
      method: 'POST',
      token: author.token,
      body: { title: 'Sourcing in Dhaka', content: '<p>Hello</p><script>alert(1)</script>' },
    });
    assert.equal(created.status, 201);
    assert.equal(created.json.data.status, 'draft');
    assert.equal(created.json.data.content, '<p>Hello</p>'); // sanitized on the server
    const id = created.json.data.id;

    const edit = (token: string) =>
      api.call(`/api/blog/admin/posts/${id}`, {
        method: 'PATCH',
        token,
        body: { title: 'Edited title' },
      });
    assert.equal((await edit(author.token)).status, 200);
    assert.equal((await edit(other.token)).status, 404); // other authors cannot even see it

    const publishByAuthor = await api.call(`/api/blog/admin/posts/${id}/publish`, {
      method: 'POST',
      token: author.token,
    });
    assert.equal(publishByAuthor.status, 403);

    const listOther = await api.call<{ items: PostView[] }>('/api/blog/admin/posts', {
      token: other.token,
    });
    assert.equal(listOther.json.data.items.length, 0);

    const published = await api.call<PostView>(`/api/blog/admin/posts/${id}/publish`, {
      method: 'POST',
      token: editor.token,
    });
    assert.equal(published.json.data.status, 'published');
    // Once live, only editors may change it.
    assert.equal((await edit(author.token)).status, 403);

    const pub = await api.call<{ items: PostView[] }>('/api/blog/posts');
    assert.equal(pub.json.data.items.length, 1);
    const bySlug = await api.call<PostView>(`/api/blog/posts/${published.json.data.slug}`);
    assert.equal(bySlug.status, 200);
  });

  it('viewers can read but not write; the upload signature needs media.upload', async () => {
    const viewer = await api.signIn('viewer');
    assert.equal((await api.call('/api/blog/admin/posts', { token: viewer.token })).status, 200);
    const write = await api.call('/api/blog/admin/posts', {
      method: 'POST',
      token: viewer.token,
      body: { title: 'Nope nope' },
    });
    assert.equal(write.status, 403);

    const sig = (token: string) =>
      api.call<{ signature: string }>('/api/blog/admin/uploads/signature', {
        method: 'POST',
        token,
      });
    assert.equal((await sig(viewer.token)).status, 403);
    const author = await api.signIn('author');
    const ok = await sig(author.token);
    assert.equal(ok.status, 200);
    assert.match(ok.json.data.signature, /^[a-f0-9]{40}$/);
  });

  it('runs the trash lifecycle and protects categories that are in use', async () => {
    const editor = await api.signIn('content_manager');
    const category = await api.call<{ id: string }>('/api/blog/admin/categories', {
      method: 'POST',
      token: editor.token,
      body: { name: 'Factory news' },
    });
    assert.equal(category.status, 201);

    const post = await api.call<PostView>('/api/blog/admin/posts', {
      method: 'POST',
      token: editor.token,
      body: { title: 'Lifecycle post', category: category.json.data.id },
    });
    const id = post.json.data.id;

    const purgeLive = await api.call(`/api/blog/admin/posts/${id}/permanent`, {
      method: 'DELETE',
      token: editor.token,
    });
    assert.equal(purgeLive.json.code, 'NOT_IN_TRASH');

    assert.equal(
      (await api.call(`/api/blog/admin/posts/${id}`, { method: 'DELETE', token: editor.token }))
        .status,
      200,
    );
    const restored = await api.call<PostView>(`/api/blog/admin/posts/${id}/restore`, {
      method: 'POST',
      token: editor.token,
    });
    assert.equal(restored.json.data.status, 'draft');

    const inUse = await api.call(`/api/blog/admin/categories/${category.json.data.id}`, {
      method: 'DELETE',
      token: editor.token,
    });
    assert.equal(inUse.json.code, 'CATEGORY_IN_USE');

    await api.call(`/api/blog/admin/posts/${id}`, { method: 'DELETE', token: editor.token });
    assert.equal(
      (
        await api.call(`/api/blog/admin/posts/${id}/permanent`, {
          method: 'DELETE',
          token: editor.token,
        })
      ).status,
      200,
    );
    const freed = await api.call(`/api/blog/admin/categories/${category.json.data.id}`, {
      method: 'DELETE',
      token: editor.token,
    });
    assert.equal(freed.status, 200);
  });

  it('schedules posts, counts them per status and keeps them off the site until due', async () => {
    const editor = await api.signIn('content_manager');
    const create = (title: string) =>
      api.call<PostView>('/api/blog/admin/posts', {
        method: 'POST',
        token: editor.token,
        body: { title, content: '<p>Body text</p>' },
      });
    const future = (await create('Scheduled launch notes')).json.data;
    const tomorrow = new Date(Date.now() + 24 * 3600 * 1000).toISOString();
    const scheduled = await api.call<PostView & { publishedAt: string }>(
      `/api/blog/admin/posts/${future.id}/publish`,
      { method: 'POST', token: editor.token, body: { publishAt: tomorrow } },
    );
    assert.equal(scheduled.json.data.status, 'published');
    assert.equal(scheduled.json.data.publishedAt, tomorrow);

    assert.equal((await api.call(`/api/blog/posts/${future.slug}`)).status, 404);
    const tab = await api.call<{ items: PostView[] }>('/api/blog/admin/posts?status=scheduled', {
      token: editor.token,
    });
    assert.deepEqual(
      tab.json.data.items.map((p) => p.id),
      [future.id],
    );
    const stats = await api.call<Record<string, number>>('/api/blog/admin/posts/stats', {
      token: editor.token,
    });
    assert.equal(stats.json.data.scheduled, 1);

    // Publishing again without a date makes a scheduled post go live now.
    const now = await api.call<PostView>(`/api/blog/admin/posts/${future.id}/publish`, {
      method: 'POST',
      token: editor.token,
    });
    assert.equal(now.status, 200);
    assert.equal((await api.call(`/api/blog/posts/${future.slug}`)).status, 200);
  });

  it('duplicates as a draft and suggests related posts, category counts and tags', async () => {
    const editor = await api.signIn('content_manager');
    const cat = await api.call<{ id: string }>('/api/blog/admin/categories', {
      method: 'POST',
      token: editor.token,
      body: { name: 'Quality desk' },
    });
    const make = async (title: string, tags: string[], category?: string) => {
      const p = await api.call<PostView>('/api/blog/admin/posts', {
        method: 'POST',
        token: editor.token,
        body: { title, content: '<p>Text</p>', tags, ...(category ? { category } : {}) },
      });
      await api.call(`/api/blog/admin/posts/${p.json.data.id}/publish`, {
        method: 'POST',
        token: editor.token,
      });
      return p.json.data;
    };
    const a = await make('Inline inspection basics', ['qc', 'inspection'], cat.json.data.id);
    const b = await make('AQL sampling explained', ['qc'], cat.json.data.id);

    const related = await api.call<PostView[]>(`/api/blog/posts/${a.slug}/related`);
    assert.equal(related.json.data[0]?.id, b.id);
    assert.ok(related.json.data.every((p) => p.id !== a.id));

    const cats = await api.call<{ id: string; postCount: number }[]>('/api/blog/categories');
    assert.equal(cats.json.data.find((c) => c.id === cat.json.data.id)?.postCount, 2);
    const tags = await api.call<{ tag: string; count: number }[]>('/api/blog/tags');
    assert.deepEqual(tags.json.data[0], { tag: 'qc', count: 2 });

    const copy = await api.call<PostView & { title: string }>(
      `/api/blog/admin/posts/${a.id}/duplicate`,
      { method: 'POST', token: editor.token },
    );
    assert.equal(copy.status, 201);
    assert.equal(copy.json.data.status, 'draft');
    assert.equal(copy.json.data.title, 'Inline inspection basics (copy)');
    assert.notEqual(copy.json.data.slug, a.slug);

    const badCanonical = await api.call(`/api/blog/admin/posts/${a.id}`, {
      method: 'PATCH',
      token: editor.token,
      body: { canonicalUrl: 'javascript:alert(1)' },
    });
    assert.equal(badCanonical.status, 400);
  });

  it('validates ids and bodies consistently', async () => {
    const editor = await api.signIn('content_manager');
    const badId = await api.call('/api/blog/admin/posts/not-an-id', { token: editor.token });
    assert.equal(badId.status, 400);
    assert.equal(badId.json.code, 'VALIDATION_ERROR');
  });
});
