import assert from 'node:assert/strict';
import { after, before, describe, it } from 'node:test';
import { startIntegration, type Integration } from '../../test/integration.js';
import { cleanList } from './services/product.service.js';

let api: Integration;
before(async () => {
  api = await startIntegration();
});
after(async () => {
  await api.stop();
});

interface ProductView {
  id: string;
  name: string;
  slug: string;
  status: string;
  sizes: string[];
  tags: string[];
  images: { url: string; publicId?: string }[];
}

const IMAGE = { url: 'https://res.cloudinary.com/demo/image/upload/a.jpg', alt: 'Front view' };

describe('cleanList', () => {
  it('trims, drops empties and de-duplicates without regard to case', () => {
    assert.deepEqual(cleanList([' S ', 's', 'M', '', 'XL']), ['S', 'M', 'XL']);
    assert.deepEqual(cleanList(['Denim', 'denim '], true), ['denim']);
  });
});

describe('products', () => {
  it('lets the right roles read, write and publish', async () => {
    const viewer = await api.signIn('viewer');
    const author = await api.signIn('author');
    const editor = await api.signIn('content_manager');

    assert.equal(
      (await api.call('/api/products/admin/products', { token: viewer.token })).status,
      200,
    );
    assert.equal(
      (await api.call('/api/products/admin/products', { token: author.token })).status,
      403,
    );
    const write = await api.call('/api/products/admin/products', {
      method: 'POST',
      token: viewer.token,
      body: { name: 'Not allowed' },
    });
    assert.equal(write.status, 403);
    const ok = await api.call('/api/products/admin/products', {
      method: 'POST',
      token: editor.token,
      body: { name: 'Allowed tee' },
    });
    assert.equal(ok.status, 201);
  });

  it('cleans input, enforces publish requirements and shows only live products', async () => {
    const editor = await api.signIn('content_manager');
    const cat = await api.call<{ id: string }>('/api/products/admin/categories', {
      method: 'POST',
      token: editor.token,
      body: { name: 'Knitwear' },
    });
    assert.equal(cat.status, 201);

    const created = await api.call<ProductView>('/api/products/admin/products', {
      method: 'POST',
      token: editor.token,
      body: {
        name: 'Organic jersey tee',
        sizes: ['S', ' M', 'm', 'L'],
        tags: ['Organic', 'organic '],
        images: [IMAGE],
        description: '<p>Soft</p><script>x()</script>',
      },
    });
    assert.equal(created.status, 201);
    const p = created.json.data;
    assert.equal(p.status, 'draft');
    assert.deepEqual(p.sizes, ['S', 'M', 'L']);
    assert.deepEqual(p.tags, ['organic']);

    const early = await api.call(`/api/products/admin/products/${p.id}/publish`, {
      method: 'POST',
      token: editor.token,
    });
    assert.equal(early.status, 400);
    assert.equal(early.json.code, 'PUBLISH_REQUIREMENTS');

    assert.equal((await api.call(`/api/products/${p.slug}`)).status, 404); // drafts stay hidden

    await api.call(`/api/products/admin/products/${p.id}`, {
      method: 'PATCH',
      token: editor.token,
      body: { category: cat.json.data.id, summary: 'A 180 gsm organic cotton tee.' },
    });
    const live = await api.call<ProductView>(`/api/products/admin/products/${p.id}/publish`, {
      method: 'POST',
      token: editor.token,
    });
    assert.equal(live.json.data.status, 'published');

    const detail = await api.call<ProductView & { description: string }>(`/api/products/${p.slug}`);
    assert.equal(detail.status, 200);
    assert.equal(detail.json.data.description, '<p>Soft</p>');
    const list = await api.call<{ items: ProductView[] }>('/api/products?category=knitwear');
    assert.deepEqual(
      list.json.data.items.map((i) => i.id),
      [p.id],
    );
    const cats = await api.call<{ slug: string; productCount: number }[]>(
      '/api/products/categories',
    );
    assert.equal(cats.json.data.find((c) => c.slug === 'knitwear')?.productCount, 1);
  });

  it('duplicates without taking over images, and suggests related products', async () => {
    const editor = await api.signIn('content_manager');
    const cat = await api.call<{ id: string }>('/api/products/admin/categories', {
      method: 'POST',
      token: editor.token,
      body: { name: 'Denim' },
    });
    const make = async (name: string) => {
      const res = await api.call<ProductView>('/api/products/admin/products', {
        method: 'POST',
        token: editor.token,
        body: {
          name,
          category: cat.json.data.id,
          summary: 'Denim style.',
          images: [{ ...IMAGE, publicId: 'products/a' }],
        },
      });
      await api.call(`/api/products/admin/products/${res.json.data.id}/publish`, {
        method: 'POST',
        token: editor.token,
      });
      return res.json.data;
    };
    const a = await make('Slim jean');
    const b = await make('Trucker jacket');

    const related = await api.call<ProductView[]>(`/api/products/${a.slug}/related`);
    assert.equal(related.json.data[0]?.id, b.id);

    const copy = await api.call<ProductView>(`/api/products/admin/products/${a.id}/duplicate`, {
      method: 'POST',
      token: editor.token,
    });
    assert.equal(copy.status, 201);
    assert.equal(copy.json.data.status, 'draft');
    assert.equal(copy.json.data.name, 'Slim jean (copy)');
    assert.equal(copy.json.data.images[0]?.url, IMAGE.url);
    assert.equal(copy.json.data.images[0]?.publicId, undefined);
  });

  it('runs the trash lifecycle, guards categories and reserved slugs, validates images', async () => {
    const editor = await api.signIn('content_manager');
    const reserved = await api.call<ProductView>('/api/products/admin/products', {
      method: 'POST',
      token: editor.token,
      body: { name: 'Admin' },
    });
    assert.equal(reserved.json.data.slug, 'admin-product');

    const insecure = await api.call('/api/products/admin/products', {
      method: 'POST',
      token: editor.token,
      body: { name: 'Bad image', images: [{ url: 'http://example.com/a.jpg', alt: '' }] },
    });
    assert.equal(insecure.status, 400);

    const blur = 'data:image/webp;base64,UklGRhYAAABXRUJQVlA4';
    const blurred = await api.call<ProductView & { images: { blur?: string }[] }>(
      '/api/products/admin/products',
      {
        method: 'POST',
        token: editor.token,
        body: { name: 'Blurred', images: [{ ...IMAGE, blur }] },
      },
    );
    assert.equal(blurred.status, 201);
    assert.equal(blurred.json.data.images[0]?.blur, blur);
    const badBlur = await api.call('/api/products/admin/products', {
      method: 'POST',
      token: editor.token,
      body: { name: 'Bad blur', images: [{ ...IMAGE, blur: 'https://example.com/b.jpg' }] },
    });
    assert.equal(badBlur.status, 400);

    const cat = await api.call<{ id: string }>('/api/products/admin/categories', {
      method: 'POST',
      token: editor.token,
      body: { name: 'Woven' },
    });
    const p = await api.call<ProductView>('/api/products/admin/products', {
      method: 'POST',
      token: editor.token,
      body: { name: 'Poplin shirt', category: cat.json.data.id },
    });
    const id = p.json.data.id;

    const inUse = await api.call(`/api/products/admin/categories/${cat.json.data.id}`, {
      method: 'DELETE',
      token: editor.token,
    });
    assert.equal(inUse.json.code, 'CATEGORY_IN_USE');

    const purgeLive = await api.call(`/api/products/admin/products/${id}/permanent`, {
      method: 'DELETE',
      token: editor.token,
    });
    assert.equal(purgeLive.json.code, 'NOT_IN_TRASH');

    await api.call(`/api/products/admin/products/${id}`, { method: 'DELETE', token: editor.token });
    const stats = await api.call<{ trash: number }>('/api/products/admin/products/stats', {
      token: editor.token,
    });
    assert.equal(stats.json.data.trash, 1);
    const restored = await api.call<ProductView>(`/api/products/admin/products/${id}/restore`, {
      method: 'POST',
      token: editor.token,
    });
    assert.equal(restored.json.data.status, 'draft');

    await api.call(`/api/products/admin/products/${id}`, { method: 'DELETE', token: editor.token });
    const purged = await api.call(`/api/products/admin/products/${id}/permanent`, {
      method: 'DELETE',
      token: editor.token,
    });
    assert.equal(purged.status, 200);
    const freed = await api.call(`/api/products/admin/categories/${cat.json.data.id}`, {
      method: 'DELETE',
      token: editor.token,
    });
    assert.equal(freed.status, 200);
  });
});
