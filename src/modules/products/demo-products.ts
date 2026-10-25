/**
 * Demo catalogue: realistic sample products so the Products pages can be seen working before the
 * real range is added. Photos are served by the website from public/demo-products/ (copies of
 * the site's own photography). Figures (MOQ, lead time, GSM) are typical industry values, not
 * commitments.
 *
 *   npm run seed:products              add any demo products that are missing
 *   npm run seed:products -- --remove  delete all demo products (and demo categories left empty)
 */

export interface DemoCategory {
  name: string;
  slug: string;
  description: string;
}

export const DEMO_CATEGORIES: DemoCategory[] = [
  {
    name: 'Knitwear',
    slug: 'knitwear',
    description: 'T-shirts, polos, sweatshirts and fleece in cotton and blends.',
  },
  {
    name: 'Denim',
    slug: 'denim',
    description: 'Jeans and jackets with wash development and lab-tested finishes.',
  },
  {
    name: 'Woven',
    slug: 'woven',
    description: 'Shirts, blouses, dresses and trousers with full trim sourcing.',
  },
  {
    name: 'Sweaters',
    slug: 'sweaters',
    description: 'Flat-knit sweaters and cardigans on computerised knitting lines.',
  },
  {
    name: 'Activewear',
    slug: 'activewear',
    description: 'Team and performance garments with prints and embroidery.',
  },
  {
    name: 'Workwear',
    slug: 'workwear',
    description: 'Durable uniforms and workwear that survive industrial laundering.',
  },
];

/** Size of each photo in public/demo-products, for correct zoom without layout shift. */
const PHOTO: Record<string, { width: number; height: number }> = {
  'clothing-rack': { width: 2400, height: 1800 },
  'cotton-boll': { width: 2400, height: 1600 },
  denim: { width: 2400, height: 1798 },
  embroidery: { width: 2016, height: 1512 },
  'fabric-rolls': { width: 2048, height: 1367 },
  'factory-floor': { width: 2400, height: 1776 },
  'garment-line': { width: 2400, height: 1600 },
  'knitting-machine': { width: 2400, height: 1600 },
  operator: { width: 2048, height: 1536 },
  'recycled-thread': { width: 2400, height: 1800 },
  'retail-store': { width: 2400, height: 1800 },
  'sewing-dress': { width: 2400, height: 1600 },
  'hero-sewing': { width: 2400, height: 1800 },
};

const photo = (name: keyof typeof PHOTO & string, alt: string) => ({
  url: `/demo-products/${name}.jpg`,
  alt,
  ...PHOTO[name],
});

export interface DemoProduct {
  slug: string;
  name: string;
  category: string;
  styleCode: string;
  summary: string;
  description: string;
  images: Array<{ url: string; alt: string; width?: number; height?: number }>;
  fabric: string;
  weight: string;
  sizes: string[];
  colors: string[];
  moq: number;
  moqUnit: string;
  leadTime: string;
  certifications: string[];
  specs: Array<{ label: string; value: string }>;
  tags: string[];
  featured: boolean;
  seoTitle: string;
  seoDescription: string;
}

export const DEMO_PRODUCTS: DemoProduct[] = [
  {
    slug: 'organic-cotton-crew-neck-t-shirt',
    name: 'Organic Cotton Crew-Neck T-Shirt',
    category: 'knitwear',
    styleCode: 'EBH-KN-1001',
    summary:
      'A wardrobe basic in GOTS-certified organic cotton single jersey, with a soft hand-feel and a clean, durable finish.',
    description:
      '<p>Our best-selling basic, made in combed organic cotton single jersey for brands that want an everyday tee with a credible sustainability story.</p><ul><li>Rib collar with self-fabric back-neck tape</li><li>Twin-needle stitching at sleeves and hem</li><li>Enzyme washed for a soft hand-feel and low shrinkage</li><li>Custom labels, hangtags and polybags available</li></ul><p>Available in a wide colour range, piece-dyed or yarn-dyed stripes, with screen print, water-based print or embroidery on request.</p>',
    images: [
      photo('clothing-rack', 'Crew-neck T-shirts on a rail in a range of colours'),
      photo('cotton-boll', 'Organic cotton boll ready for harvest'),
      photo('fabric-rolls', 'Single jersey fabric in piece-dyed colours'),
    ],
    fabric: '100% organic cotton single jersey, combed',
    weight: '160 GSM',
    sizes: ['XS', 'S', 'M', 'L', 'XL', 'XXL'],
    colors: ['White', 'Black', 'Navy', 'Heather grey', 'Sage', 'Terracotta'],
    moq: 1000,
    moqUnit: 'pcs per style',
    leadTime: '45–60 days',
    certifications: ['GOTS', 'OEKO-TEX', 'BSCI'],
    specs: [
      { label: 'Construction', value: 'Single jersey, tubular body' },
      { label: 'Neck', value: '1x1 rib, 2 cm' },
      { label: 'Finish', value: 'Enzyme wash, anti-pilling' },
      { label: 'Shrinkage', value: 'Within ±3% after 3 washes' },
      { label: 'Decoration', value: 'Screen print, water-based print, embroidery' },
    ],
    tags: ['organic', 't-shirt', 'basics', 'sustainable'],
    featured: true,
    seoTitle: 'Organic Cotton Crew-Neck T-Shirt Manufacturer',
    seoDescription:
      'GOTS-certified organic cotton T-shirts made in Bangladesh. 160 GSM single jersey, custom colours and labels, MOQ 1,000 pcs per style.',
  },
  {
    slug: 'classic-pique-polo-shirt',
    name: 'Classic Piqué Polo Shirt',
    category: 'knitwear',
    styleCode: 'EBH-KN-1015',
    summary:
      'A smart-casual polo in cotton piqué with a flat-knit collar and cuffs, ready for retail or corporate programmes.',
    description:
      '<p>A timeless polo in breathable cotton piqué, built to hold its shape wash after wash.</p><ul><li>Flat-knit collar and cuffs, tipping available</li><li>Two- or three-button placket with matching buttons</li><li>Side vents and a longer back hem</li><li>Logo embroidery on chest or sleeve</li></ul>',
    images: [
      photo('fabric-rolls', 'Cotton piqué fabric in a range of colours'),
      photo('clothing-rack', 'Polo shirts ready for dispatch'),
      photo('sewing-dress', 'Placket stitching on the production line'),
    ],
    fabric: '100% combed cotton piqué',
    weight: '220 GSM',
    sizes: ['S', 'M', 'L', 'XL', 'XXL', '3XL'],
    colors: ['White', 'Navy', 'Bottle green', 'Burgundy', 'Royal blue'],
    moq: 800,
    moqUnit: 'pcs per style',
    leadTime: '50–60 days',
    certifications: ['OEKO-TEX', 'BSCI', 'WRAP'],
    specs: [
      { label: 'Collar', value: 'Flat-knit, optional tipping' },
      { label: 'Placket', value: '2 or 3 buttons' },
      { label: 'Hem', value: 'Side vents, drop back' },
      { label: 'Decoration', value: 'Embroidery, heat transfer' },
    ],
    tags: ['polo', 'corporate', 'smart casual'],
    featured: false,
    seoTitle: 'Cotton Piqué Polo Shirt Manufacturer',
    seoDescription:
      'Custom cotton piqué polo shirts, 220 GSM, flat-knit collar, logo embroidery. Made in Bangladesh, MOQ 800 pcs per style.',
  },
  {
    slug: 'brushed-fleece-pullover-hoodie',
    name: 'Brushed Fleece Pullover Hoodie',
    category: 'knitwear',
    styleCode: 'EBH-KN-1032',
    summary:
      'A heavyweight hoodie in brushed-back cotton-rich fleece with a lined hood and kangaroo pocket.',
    description:
      '<p>A warm, structured hoodie for streetwear and merchandise ranges.</p><ul><li>Brushed inside for warmth and softness</li><li>Double-layer hood with flat drawcords</li><li>Kangaroo pocket and 2x2 rib cuffs and waistband</li><li>Garment dye and puff print available</li></ul>',
    images: [
      photo('operator', 'Hoodie being assembled on a flatlock machine'),
      photo('factory-floor', 'Fleece garments on the sewing floor'),
      photo('fabric-rolls', 'Fleece fabric colour options'),
    ],
    fabric: '80% cotton, 20% polyester brushed fleece',
    weight: '320 GSM',
    sizes: ['XS', 'S', 'M', 'L', 'XL', 'XXL'],
    colors: ['Black', 'Charcoal melange', 'Navy', 'Oatmeal', 'Forest green'],
    moq: 600,
    moqUnit: 'pcs per style',
    leadTime: '55–70 days',
    certifications: ['OEKO-TEX', 'BSCI'],
    specs: [
      { label: 'Hood', value: 'Double layer, flat drawcords' },
      { label: 'Pocket', value: 'Kangaroo pocket' },
      { label: 'Trims', value: '2x2 rib cuffs and waistband' },
      { label: 'Decoration', value: 'Puff print, embroidery, garment dye' },
    ],
    tags: ['hoodie', 'fleece', 'streetwear'],
    featured: false,
    seoTitle: 'Brushed Fleece Hoodie Manufacturer',
    seoDescription:
      'Heavyweight 320 GSM brushed fleece hoodies with lined hood. Custom colours and prints, MOQ 600 pcs per style, made in Bangladesh.',
  },
  {
    slug: 'five-pocket-stretch-denim-jeans',
    name: 'Five-Pocket Stretch Denim Jeans',
    category: 'denim',
    styleCode: 'EBH-DN-2004',
    summary:
      'A slim-straight five-pocket jean in comfort-stretch denim, with wash development to your standard.',
    description:
      '<p>A core denim fit for men’s and women’s ranges, developed with our wash partners to hit your shade and hand-feel.</p><ul><li>Slim-straight or skinny fit blocks</li><li>Rivets, branded shank button and leather or jacron patch</li><li>Stone, enzyme and laser-finish washes</li><li>Lab-tested for colour fastness and stretch recovery</li></ul>',
    images: [
      photo('denim', 'Stretch denim jeans and shirts styled together'),
      photo('recycled-thread', 'Finished jeans with denim yarn cone'),
    ],
    fabric: '98% cotton, 2% elastane, 11 oz right-hand twill',
    weight: '11 oz',
    sizes: ['28', '30', '32', '34', '36', '38', '40'],
    colors: ['Rinse', 'Mid stone', 'Light bleach', 'Black'],
    moq: 1200,
    moqUnit: 'pcs per style',
    leadTime: '60–75 days',
    certifications: ['OEKO-TEX', 'WRAP', 'Higg Index'],
    specs: [
      { label: 'Fit', value: 'Slim-straight, skinny on request' },
      { label: 'Rise', value: 'Mid rise' },
      { label: 'Wash', value: 'Stone, enzyme, laser finish' },
      { label: 'Trims', value: 'Branded rivets, shank button, patch' },
      { label: 'Testing', value: 'Colour fastness, stretch recovery' },
    ],
    tags: ['jeans', 'denim', 'stretch'],
    featured: true,
    seoTitle: 'Stretch Denim Jeans Manufacturer in Bangladesh',
    seoDescription:
      'Five-pocket stretch denim jeans, 11 oz, custom washes and branded trims. Lab-tested, MOQ 1,200 pcs per style.',
  },
  {
    slug: 'classic-denim-trucker-jacket',
    name: 'Classic Denim Trucker Jacket',
    category: 'denim',
    styleCode: 'EBH-DN-2011',
    summary:
      'An iconic trucker jacket in rigid cotton denim with pleated front panels and branded metal buttons.',
    description:
      '<p>A heritage trucker silhouette that works across seasons, in rigid or comfort-stretch denim.</p><ul><li>Pleated front panels and chest flap pockets</li><li>Adjustable waist tabs</li><li>Branded metal buttons</li><li>Sherpa or quilted lining options</li></ul>',
    images: [
      photo('denim', 'Denim trucker jackets and shirts'),
      photo('factory-floor', 'Denim garments in production'),
    ],
    fabric: '100% cotton rigid denim',
    weight: '13 oz',
    sizes: ['S', 'M', 'L', 'XL', 'XXL'],
    colors: ['Indigo rinse', 'Mid vintage', 'Black'],
    moq: 800,
    moqUnit: 'pcs per style',
    leadTime: '65–80 days',
    certifications: ['OEKO-TEX', 'WRAP'],
    specs: [
      { label: 'Fit', value: 'Regular' },
      { label: 'Pockets', value: '2 chest flap, 2 hand pockets' },
      { label: 'Lining', value: 'Unlined, sherpa or quilted' },
      { label: 'Trims', value: 'Branded metal buttons' },
    ],
    tags: ['jacket', 'denim', 'outerwear'],
    featured: false,
    seoTitle: 'Denim Trucker Jacket Manufacturer',
    seoDescription:
      'Classic 13 oz denim trucker jackets with branded buttons and lining options. MOQ 800 pcs per style, made in Bangladesh.',
  },
  {
    slug: 'recycled-cotton-denim-jeans',
    name: 'Recycled Cotton Denim Jeans',
    category: 'denim',
    styleCode: 'EBH-DN-2020',
    summary:
      'Lower-impact jeans woven with post-consumer recycled cotton and finished with water-saving washes.',
    description:
      '<p>Denim made with a share of recycled cotton fibre, so your range uses less virgin cotton, water and energy.</p><ul><li>GRS-certified recycled content</li><li>Ozone and laser finishing to cut water use</li><li>Recycled polyester sewing thread</li><li>Full traceability documents for your sustainability reporting</li></ul>',
    images: [
      photo('recycled-thread', 'Recycled denim yarn and finished jeans'),
      photo('denim', 'Recycled-content denim styled'),
    ],
    fabric: '80% cotton, 20% recycled cotton denim',
    weight: '12 oz',
    sizes: ['28', '30', '32', '34', '36', '38'],
    colors: ['Rinse', 'Mid stone', 'Light wash'],
    moq: 1000,
    moqUnit: 'pcs per style',
    leadTime: '60–75 days',
    certifications: ['GRS', 'OEKO-TEX', 'Higg Index'],
    specs: [
      { label: 'Recycled content', value: '20% post-consumer cotton' },
      { label: 'Finishing', value: 'Ozone and laser, low water' },
      { label: 'Thread', value: 'Recycled polyester' },
      { label: 'Traceability', value: 'Transaction certificates per shipment' },
    ],
    tags: ['recycled', 'sustainable', 'denim', 'jeans'],
    featured: false,
    seoTitle: 'Recycled Cotton Denim Jeans Manufacturer',
    seoDescription:
      'GRS-certified recycled cotton denim jeans with low-water finishing. Traceable, MOQ 1,000 pcs per style, made in Bangladesh.',
  },
  {
    slug: 'oxford-button-down-shirt',
    name: 'Oxford Button-Down Shirt',
    category: 'woven',
    styleCode: 'EBH-WV-3002',
    summary:
      'A crisp Oxford cotton shirt with a button-down collar, chest pocket and easy-care finish.',
    description:
      '<p>A versatile woven shirt for menswear and uniform programmes, in classic Oxford cotton.</p><ul><li>Button-down collar and box-pleat back</li><li>Single chest pocket</li><li>Easy-care finish for fewer wrinkles</li><li>Slim and regular fits</li></ul>',
    images: [
      photo('garment-line', 'Oxford shirt fabric being prepared'),
      photo('clothing-rack', 'Woven shirts on the rail'),
    ],
    fabric: '100% cotton Oxford',
    weight: '120 GSM',
    sizes: ['S', 'M', 'L', 'XL', 'XXL'],
    colors: ['White', 'Light blue', 'Pink', 'Blue stripe'],
    moq: 1000,
    moqUnit: 'pcs per style',
    leadTime: '50–65 days',
    certifications: ['OEKO-TEX', 'BSCI'],
    specs: [
      { label: 'Collar', value: 'Button-down' },
      { label: 'Back', value: 'Box pleat with locker loop' },
      { label: 'Finish', value: 'Easy care' },
      { label: 'Fit', value: 'Slim or regular' },
    ],
    tags: ['shirt', 'woven', 'menswear'],
    featured: false,
    seoTitle: 'Oxford Button-Down Shirt Manufacturer',
    seoDescription:
      'Cotton Oxford button-down shirts with easy-care finish, slim and regular fits. MOQ 1,000 pcs per style, made in Bangladesh.',
  },
  {
    slug: 'printed-viscose-midi-dress',
    name: 'Printed Viscose Midi Dress',
    category: 'woven',
    styleCode: 'EBH-WV-3018',
    summary:
      'A fluid midi dress in printed viscose with a tiered skirt, ideal for seasonal womenswear drops.',
    description:
      '<p>An easy, flowing dress in soft viscose challis, printed to your artwork.</p><ul><li>V-neck with covered buttons</li><li>Tiered skirt and elasticated cuffs</li><li>Digital or rotary print on your artwork</li><li>Fully self-lined bodice</li></ul>',
    images: [
      photo('sewing-dress', 'Printed dress being sewn'),
      photo('retail-store', 'Womenswear on display in store'),
      photo('fabric-rolls', 'Print colourways'),
    ],
    fabric: '100% viscose challis, printed',
    weight: '110 GSM',
    sizes: ['XS', 'S', 'M', 'L', 'XL'],
    colors: ['Floral navy', 'Ditsy cream', 'Paisley rust'],
    moq: 600,
    moqUnit: 'pcs per style',
    leadTime: '55–70 days',
    certifications: ['OEKO-TEX', 'Sedex'],
    specs: [
      { label: 'Neck', value: 'V-neck, covered buttons' },
      { label: 'Skirt', value: 'Two tiers' },
      { label: 'Print', value: 'Digital or rotary, your artwork' },
      { label: 'Lining', value: 'Self-lined bodice' },
    ],
    tags: ['dress', 'womenswear', 'print'],
    featured: false,
    seoTitle: 'Printed Viscose Dress Manufacturer',
    seoDescription:
      'Printed viscose midi dresses on your artwork, tiered skirt, self-lined. MOQ 600 pcs per style, made in Bangladesh.',
  },
  {
    slug: 'merino-blend-crew-sweater',
    name: 'Merino Blend Crew Sweater',
    category: 'sweaters',
    styleCode: 'EBH-SW-4003',
    summary:
      'A fine-gauge crew-neck sweater in a soft merino blend, knitted on computerised flat-knit machines.',
    description:
      '<p>A refined knit for autumn and winter ranges, fully fashioned for a clean fit.</p><ul><li>12-gauge fully fashioned construction</li><li>Ribbed neck, cuffs and hem</li><li>Anti-pilling treatment</li><li>Jacquard and intarsia patterns available</li></ul>',
    images: [
      photo('knitting-machine', 'Sweater panels on a computerised flat-knit machine'),
      photo('recycled-thread', 'Yarn ready for knitting'),
    ],
    fabric: '50% merino wool, 50% acrylic',
    weight: '12 GG',
    sizes: ['S', 'M', 'L', 'XL', 'XXL'],
    colors: ['Camel', 'Navy', 'Charcoal', 'Burgundy', 'Cream'],
    moq: 500,
    moqUnit: 'pcs per style',
    leadTime: '60–75 days',
    certifications: ['OEKO-TEX', 'BSCI'],
    specs: [
      { label: 'Gauge', value: '12 GG, fully fashioned' },
      { label: 'Trims', value: '1x1 rib neck, cuffs and hem' },
      { label: 'Finish', value: 'Anti-pilling' },
      { label: 'Patterns', value: 'Jacquard, intarsia on request' },
    ],
    tags: ['sweater', 'knitwear', 'winter'],
    featured: true,
    seoTitle: 'Merino Blend Sweater Manufacturer',
    seoDescription:
      'Fine-gauge merino blend crew sweaters, fully fashioned, anti-pilling. MOQ 500 pcs per style, made in Bangladesh.',
  },
  {
    slug: 'cable-knit-cardigan',
    name: 'Cable-Knit Cardigan',
    category: 'sweaters',
    styleCode: 'EBH-SW-4011',
    summary:
      'A chunky cable-knit cardigan with horn-look buttons and patch pockets, made on computerised knitting lines.',
    description:
      '<p>A cosy statement knit with traditional cable detail.</p><ul><li>5-gauge cable pattern front and back</li><li>Horn-look buttons and patch pockets</li><li>Linked shoulders and neck band</li></ul>',
    images: [
      photo('knitting-machine', 'Cable-knit panels being knitted'),
      photo('clothing-rack', 'Knitwear ready for shipment'),
    ],
    fabric: '70% acrylic, 30% wool',
    weight: '5 GG',
    sizes: ['S', 'M', 'L', 'XL'],
    colors: ['Ecru', 'Oatmeal', 'Bottle green', 'Black'],
    moq: 500,
    moqUnit: 'pcs per style',
    leadTime: '65–80 days',
    certifications: ['OEKO-TEX'],
    specs: [
      { label: 'Gauge', value: '5 GG' },
      { label: 'Pattern', value: 'Cable front and back' },
      { label: 'Trims', value: 'Horn-look buttons, patch pockets' },
    ],
    tags: ['cardigan', 'sweater', 'knitwear'],
    featured: false,
    seoTitle: 'Cable-Knit Cardigan Manufacturer',
    seoDescription:
      'Chunky 5-gauge cable-knit cardigans with patch pockets. MOQ 500 pcs per style, made in Bangladesh.',
  },
  {
    slug: 'embroidered-team-jersey',
    name: 'Embroidered Team Jersey',
    category: 'activewear',
    styleCode: 'EBH-AC-5007',
    summary:
      'A breathable team jersey in moisture-wicking mesh with embroidered or sublimated numbers and crests.',
    description:
      '<p>Built for clubs, schools and fan merchandise, with decoration done in-house by our embroidery partners.</p><ul><li>Moisture-wicking polyester mesh</li><li>Embroidered crests, tackle-twill numbers or full sublimation</li><li>Raglan sleeves for movement</li><li>Team packs with names and numbers</li></ul>',
    images: [
      photo('embroidery', 'Team jerseys with embroidered numbers beside embroidery machines'),
      photo('operator', 'Jersey seams being finished'),
    ],
    fabric: '100% polyester interlock mesh',
    weight: '150 GSM',
    sizes: ['XS', 'S', 'M', 'L', 'XL', 'XXL'],
    colors: ['White', 'Royal blue', 'Red', 'Black', 'Custom team colours'],
    moq: 300,
    moqUnit: 'pcs per design',
    leadTime: '40–55 days',
    certifications: ['OEKO-TEX', 'WRAP'],
    specs: [
      { label: 'Fabric', value: 'Wicking interlock mesh' },
      { label: 'Decoration', value: 'Embroidery, tackle twill, sublimation' },
      { label: 'Sleeve', value: 'Raglan' },
      { label: 'Personalisation', value: 'Names and numbers' },
    ],
    tags: ['jersey', 'sportswear', 'embroidery', 'teamwear'],
    featured: true,
    seoTitle: 'Embroidered Team Jersey Manufacturer',
    seoDescription:
      'Moisture-wicking team jerseys with embroidery or sublimation. Names and numbers, MOQ 300 pcs per design, made in Bangladesh.',
  },
  {
    slug: 'twill-cargo-work-trousers',
    name: 'Twill Cargo Work Trousers',
    category: 'workwear',
    styleCode: 'EBH-WW-6005',
    summary:
      'Hard-wearing poly-cotton twill work trousers with reinforced knees, cargo pockets and bar-tacked stress points.',
    description:
      '<p>Practical workwear built to survive industrial laundering, for corporate and industrial uniform programmes.</p><ul><li>Reinforced knee panels with pad pockets</li><li>Cargo, rule and phone pockets</li><li>Bar-tacked stress points and triple-stitched seams</li><li>Reflective tape options</li></ul>',
    images: [
      photo('factory-floor', 'Twill work trousers on the sewing floor'),
      photo('hero-sewing', 'Workwear production line'),
    ],
    fabric: '65% polyester, 35% cotton twill',
    weight: '245 GSM',
    sizes: ['28', '30', '32', '34', '36', '38', '40', '42'],
    colors: ['Navy', 'Black', 'Khaki', 'Grey'],
    moq: 1000,
    moqUnit: 'pcs per style',
    leadTime: '50–65 days',
    certifications: ['OEKO-TEX', 'BSCI', 'ISO 9001'],
    specs: [
      { label: 'Knees', value: 'Reinforced, with pad pockets' },
      { label: 'Pockets', value: 'Cargo, rule and phone pockets' },
      { label: 'Seams', value: 'Triple stitched, bar-tacked' },
      { label: 'Laundering', value: 'Industrial wash tested' },
    ],
    tags: ['workwear', 'uniform', 'trousers'],
    featured: false,
    seoTitle: 'Cargo Work Trousers Manufacturer',
    seoDescription:
      'Durable poly-cotton twill cargo work trousers with reinforced knees, industrial-wash tested. MOQ 1,000 pcs per style.',
  },
];
