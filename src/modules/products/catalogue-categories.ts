/**
 * The client's product categories, in the order they appear on the website. Unlike the demo
 * catalogue these are real: `npm run seed:categories` adds any that are missing and never
 * removes or renames anything, so edits made in the dashboard are kept.
 *
 * The slugs are also used by the home page's category tiles (`/products?category=<slug>`), so
 * keep the two lists in step when one changes.
 */
export interface CatalogueCategory {
  name: string;
  slug: string;
  description: string;
}

export const CATALOGUE_CATEGORIES: CatalogueCategory[] = [
  {
    name: 'Denim',
    slug: 'denim',
    description: 'Jeans, jackets and shorts with wash development and lab-tested finishes.',
  },
  {
    name: 'Twill',
    slug: 'twill',
    description: 'Chinos, cargo and work trousers in cotton and stretch twill.',
  },
  {
    name: 'Padded jacket',
    slug: 'padded-jacket',
    description: 'Puffer, quilted and insulated jackets with down or synthetic fill.',
  },
  {
    name: 'Non-padded jacket',
    slug: 'non-padded-jacket',
    description: 'Bombers, coaches, field and shell jackets without insulation.',
  },
  {
    name: 'Shirts',
    slug: 'shirts',
    description: 'Oxford, poplin, flannel and printed shirts for every season.',
  },
  {
    name: 'Overshirts',
    slug: 'overshirts',
    description: 'Heavyweight shirt-jackets in twill, wool blends and brushed cotton.',
  },
  {
    name: 'Joggers',
    slug: 'joggers',
    description: 'Fleece, French terry and woven joggers with cuffed hems.',
  },
  {
    name: 'Swimming shorts',
    slug: 'swimming-shorts',
    description: 'Quick-dry swim and board shorts with mesh lining and prints.',
  },
  {
    name: 'Kids wear',
    slug: 'kids-wear',
    description: 'Safe, soft garments for babies and children, tested to child-safety standards.',
  },
];
