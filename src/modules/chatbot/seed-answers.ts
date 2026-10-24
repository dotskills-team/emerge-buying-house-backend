/**
 * The chatbot's starter answers, written only from what the website itself says (frontend
 * src/content/company.ts, industries.ts and config/site.ts). Those files are still marked as
 * placeholder content: when the real numbers are in, update the answers in the dashboard too.
 *
 * Loaded with `npm run seed:chatbot`. The first four are the questions suggested when the chat
 * opens. Bangla keywords let the assistant recognise questions asked in Bangla.
 */
export interface SeedAnswer {
  /** Stable name for tests; not stored. */
  key: string;
  question: string;
  answer: string;
  keywords: string[];
}

export const SEED_ANSWERS: SeedAnswer[] = [
  {
    key: 'quote',
    question: 'How do I request a quote?',
    answer:
      'Open the product you are interested in and press "Request a quote", or send us a message from the Contact page.\n\nTell us the styles, quantities, sizes and colours, your target price and delivery date. Tech packs help us cost accurately. A merchandiser replies within one working day.',
    keywords: [
      'quote',
      'quotation',
      'price',
      'pricing',
      'cost',
      'costing',
      'rate',
      'how much',
      'দাম',
      'কোটেশন',
      'মূল্য',
    ],
  },
  {
    key: 'moq',
    question: 'What is your minimum order quantity (MOQ)?',
    answer:
      'It depends on the product, fabric and trims. Each product on our Production page shows its minimum order.\n\nFor your own designs, send us the style details and quantities and a merchandiser will confirm the minimum for that style.',
    keywords: [
      'MOQ',
      'minimum',
      'minimum order',
      'small order',
      'small quantity',
      'low quantity',
      'how many pieces',
      'সর্বনিম্ন অর্ডার',
      'কম অর্ডার',
    ],
  },
  {
    key: 'lead-time',
    question: 'How long does production take?',
    answer:
      'It depends on the style, fabric and quantity. For retail programmes our average lead time is about 9 weeks. Each product on the Production page shows its own lead time.\n\nWe confirm the exact dates with your costing, once fabric and samples are planned.',
    keywords: [
      'lead time',
      'delivery time',
      'turnaround',
      'production time',
      'how many days',
      'how many weeks',
      'how long',
      'timeline',
      'ডেলিভারি',
      'কতদিন',
      'সময়',
    ],
  },
  {
    key: 'products',
    question: 'What products do you make?',
    answer:
      'Knitwear (T-shirts, polos, sweatshirts, fleece and babywear), woven garments (shirts, blouses, trousers, workwear), denim (jeans and jackets) and sweaters.\n\nWe also build private-label ranges for retailers, and make medical textiles: scrubs, uniforms, isolation gowns and cleanroom wear. Browse the catalogue on the Production page.',
    keywords: [
      'products',
      'categories',
      'garments',
      'apparel',
      'clothing',
      'knitwear',
      'woven',
      'denim',
      'jeans',
      't-shirt',
      'sweater',
      'uniform',
      'private label',
      'catalogue',
      'প্রোডাক্ট',
      'পণ্য',
    ],
  },
  {
    key: 'about',
    question: 'What does Emerge Buying House do?',
    answer:
      'We are a garment buying house in Bangladesh. We connect international brands and retailers with audited manufacturers and manage every step in between: costing, development, production, quality inspection and shipment.\n\nWe have worked in apparel sourcing since 2011, with over 40 audited partner factories.',
    keywords: [
      'about',
      'who are you',
      'buying house',
      'company',
      'what you do',
      'services',
      'sourcing agent',
      'কোম্পানি',
      'আপনারা কারা',
    ],
  },
  {
    key: 'process',
    question: 'How does the ordering process work?',
    answer:
      '1. Brief and costing: we study your tech pack, target price and dates, and propose fabrics and factories.\n2. Development: lab dips, strike-offs and samples until fit and finish are approved.\n3. Production: fabric booked, lines planned and inline quality checks at every critical step.\n4. Inspection: a final AQL inspection with a same-day digital report.\n5. Shipment: booking, documents and tracking until the goods reach your warehouse.',
    keywords: ['process', 'steps', 'how to order', 'place an order', 'workflow', 'অর্ডার'],
  },
  {
    key: 'samples',
    question: 'Can you make samples?',
    answer:
      'Yes. During development we prepare lab dips, strike-offs and samples until you approve the fit and finish, before bulk production starts. Tell us what you need through the Contact page.',
    keywords: ['sample', 'samples', 'prototype', 'lab dip', 'strike off', 'fit sample', 'স্যাম্পল'],
  },
  {
    key: 'certifications',
    question: 'Which certifications do your factories have?',
    answer:
      'We work with factories certified to standards including BSCI, WRAP, OEKO-TEX, GOTS, Sedex, GRS, ISO 9001 and the Higg Index.\n\nCertifications differ from factory to factory, so tell us which ones your order needs and we will match it with the right factory and share the certificates.',
    keywords: [
      'certification',
      'certificate',
      'certified',
      'audit',
      'BSCI',
      'WRAP',
      'OEKO-TEX',
      'GOTS',
      'Sedex',
      'GRS',
      'ISO',
      'Higg',
      'সার্টিফিকেট',
    ],
  },
  {
    key: 'quality',
    question: 'How do you control quality?',
    answer:
      'Our own quality assurance team checks every order: inline inspections at each critical production step, then a final AQL inspection before shipment.\n\nYou receive the inspection report with measurements and photos the same day.',
    keywords: ['quality', 'QC', 'QA', 'inspection', 'AQL', 'defects', 'check', 'কোয়ালিটি'],
  },
  {
    key: 'compliance',
    question: 'Are your factories audited for safety and working conditions?',
    answer:
      'Yes. Every partner factory is audited against our social and safety code, and our compliance team runs factory audits and social compliance and environmental programmes.',
    keywords: [
      'compliance',
      'audited',
      'social audit',
      'safety',
      'working conditions',
      'ethical',
      'labour',
      'fire safety',
      'safe',
      'workers',
      'factory safety',
    ],
  },
  {
    key: 'sustainability',
    question: 'What do you do for sustainability?',
    answer:
      'We run recycled and organic fibre programmes, our partner factories are adding rooftop solar, and we work with factories certified to standards such as GOTS, GRS and OEKO-TEX. See the Sustainability pages for details.',
    keywords: [
      'sustainability',
      'sustainable',
      'eco',
      'organic',
      'recycled',
      'environment',
      'green',
      'solar',
      'cotton',
    ],
  },
  {
    key: 'location',
    question: 'Where are you located?',
    answer:
      "Our head office is in Uttara, Dhaka, Bangladesh, and we have a second sourcing office in Chattogram, next to the country's main port. The full address, phone number and a map are on the Contact page.",
    keywords: [
      'location',
      'address',
      'office',
      'where',
      'Dhaka',
      'Chattogram',
      'visit',
      'ঠিকানা',
      'অফিস',
      'কোথায়',
    ],
  },
  {
    key: 'contact',
    question: 'How can I contact your team?',
    answer:
      'Send a message from the Contact page, or press "Ask our team" here in the chat. Our office hours are Sunday to Thursday, 9:00 to 18:00 Bangladesh time (GMT+6), and a merchandiser replies within one working day.',
    keywords: [
      'contact',
      'email',
      'phone',
      'call',
      'whatsapp',
      'talk',
      'speak',
      'office hours',
      'working hours',
      'যোগাযোগ',
      'ফোন',
    ],
  },
  {
    key: 'export',
    question: 'Which countries do you export to?',
    answer:
      'We ship to buyers in 22 countries. Wherever you are, we handle booking, documents and tracking until the goods reach your warehouse.',
    keywords: [
      'countries',
      'export',
      'ship to',
      'Europe',
      'USA',
      'international',
      'worldwide',
      'রপ্তানি',
    ],
  },
  {
    key: 'shipping',
    question: 'Do you handle shipping?',
    answer:
      'Yes. We arrange the booking, prepare the shipping documents and track the shipment until it reaches your warehouse. Tell us your preferred shipping terms when you ask for a quote.',
    keywords: [
      'shipping',
      'shipment',
      'freight',
      'logistics',
      'documents',
      'FOB',
      'CIF',
      'incoterms',
      'শিপমেন্ট',
    ],
  },
  {
    key: 'tracking',
    question: 'Can I follow my order while it is in production?',
    answer:
      'Yes. Our order-tracking platform lets buyers follow orders, inspections and shipments, and inspection results with measurements and photos reach you within hours of each inspection.',
    keywords: ['track', 'tracking', 'order status', 'progress', 'update', 'follow my order'],
  },
  {
    key: 'experience',
    question: 'How long have you been in business?',
    answer:
      'Since 2011. Emerge started with three people and one knitwear order for a European retailer, and now ships millions of garments a year from over 40 audited partner factories.',
    keywords: ['experience', 'since', 'founded', 'history', 'years', 'established', 'in business'],
  },
  {
    key: 'careers',
    question: 'Are you hiring?',
    answer: 'Current openings are listed on our Career page, with how to apply for each role.',
    keywords: ['job', 'jobs', 'career', 'careers', 'vacancy', 'hiring', 'work with you', 'চাকরি'],
  },
];
