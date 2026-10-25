import assert from 'node:assert/strict';
import { after, before, describe, it } from 'node:test';
import { startIntegration, type Integration } from '../../test/integration.js';
import { DEMO_CATEGORIES, DEMO_PRODUCTS } from './demo-products.js';
import { ProductModel } from './models/product.model.js';
import { removeDemoProducts, seedDemoProducts } from './services/demo-seed.service.js';

let api: Integration;
before(async () => {
  api = await startIntegration();
});
after(async () => {
  await api.stop();
});

interface PublicList {
  items: Array<{ slug: string; images: { url: string }[]; category: { slug: string } | null }>;
  meta: { total: number };
}

describe('demo products (npm run seed:products)', () => {
  it('adds every demo product once, live on the site, and removes only demo products', async () => {
    const admin = await api.signIn('super_admin');
    const editor = await api.signIn('content_manager');
    const real = await api.call<{ id: string }>('/api/products/admin/products', {
      method: 'POST',
      token: editor.token,
      body: { name: 'A real product' },
    });
    assert.equal(real.status, 201);

    assert.deepEqual(await seedDemoProducts(admin.id), {
      created: DEMO_PRODUCTS.length,
      skipped: 0,
    });
    assert.deepEqual(await seedDemoProducts(admin.id), {
      created: 0,
      skipped: DEMO_PRODUCTS.length,
    });

    const list = await api.call<PublicList>('/api/products?limit=50');
    assert.equal(list.json.data.meta.total, DEMO_PRODUCTS.length);
    for (const p of list.json.data.items) {
      assert.ok(p.images.length >= 2, `${p.slug} has a gallery`);
      assert.ok(p.images.every((i) => i.url.startsWith('/demo-products/')));
      assert.ok(p.category, `${p.slug} has a category`);
    }
    const cats = await api.call<Array<{ slug: string; productCount: number }>>(
      '/api/products/categories',
    );
    for (const c of DEMO_CATEGORIES) {
      assert.ok((cats.json.data.find((x) => x.slug === c.slug)?.productCount ?? 0) > 0, c.slug);
    }

    const detail = await api.call<{ specs: unknown[]; moq: number; description: string }>(
      `/api/products/${DEMO_PRODUCTS[0]!.slug}`,
    );
    assert.equal(detail.status, 200);
    assert.ok(detail.json.data.specs.length > 0);
    assert.ok(detail.json.data.description.includes('<ul>'));

    const removed = await removeDemoProducts();
    assert.equal(removed.products, DEMO_PRODUCTS.length);
    assert.equal(await ProductModel.countDocuments(), 1); // the real product stays
  });

  it('accepts site image paths but nothing that could leave the site', async () => {
    const editor = await api.signIn('content_manager');
    const create = (url: string) =>
      api.call('/api/products/admin/products', {
        method: 'POST',
        token: editor.token,
        body: { name: 'Image check', images: [{ url, alt: '' }] },
      });
    assert.equal((await create('/demo-products/denim.jpg')).status, 201);
    for (const bad of ['//evil.com/x.jpg', '/../x.jpg', '/x.svg', 'javascript:alert(1)']) {
      assert.equal((await create(bad)).status, 400, bad);
    }
  });
});
