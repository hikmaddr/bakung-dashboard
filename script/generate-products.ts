import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

// Define dummy categories
const categories = [
  { name: 'Souvenir', code: 'SOUV', description: 'Souvenir items for events and promotions' },
  { name: 'Clothing', code: 'CLOTH', description: 'Apparel and clothing products' },
  { name: 'Electronics', code: 'ELEC', description: 'Electronic gadgets and accessories' },
  { name: 'Stationery', code: 'STAT', description: 'Office and school supplies' },
  { name: 'Food & Beverage', code: 'FOOD', description: 'Food and drink items' },
  { name: 'Home & Garden', code: 'HOME', description: 'Home decor and garden products' },
  { name: 'Sports', code: 'SPORT', description: 'Sports equipment and apparel' },
  { name: 'Books', code: 'BOOK', description: 'Books and educational materials' },
  { name: 'Toys', code: 'TOYS', description: 'Toys and games for children' },
  { name: 'Beauty', code: 'BEAUTY', description: 'Beauty and personal care products' },
];

// Product names by category
const productNames = {
  SOUV: [
    'Custom Keychain', 'Branded Mug', 'Souvenir T-Shirt', 'Event Badge', 'Promotional Pen',
    'Souvenir Cap', 'Custom Sticker', 'Branded Water Bottle', 'Event Lanyard', 'Souvenir Bag'
  ],
  CLOTH: [
    'Cotton T-Shirt', 'Denim Jacket', 'Wool Sweater', 'Casual Pants', 'Summer Dress',
    'Winter Coat', 'Sports Shorts', 'Formal Shirt', 'Skirt', 'Hoodie'
  ],
  ELEC: [
    'Wireless Earbuds', 'Smartphone Case', 'USB Charger', 'Bluetooth Speaker', 'Power Bank',
    'Smart Watch', 'Laptop Stand', 'Mouse Pad', 'Headphone', 'Cable Organizer'
  ],
  STAT: [
    'Notebook', 'Ballpoint Pen', 'Highlighter', 'Sticky Notes', 'File Folder',
    'Pencil Case', 'Eraser', 'Ruler', 'Stapler', 'Whiteboard Marker'
  ],
  FOOD: [
    'Chocolate Bar', 'Coffee Beans', 'Tea Bag', 'Snack Mix', 'Energy Drink',
    'Bottled Water', 'Candy Pack', 'Instant Noodles', 'Fruit Juice', 'Protein Bar'
  ],
  HOME: [
    'Throw Pillow', 'Wall Clock', 'Picture Frame', 'Vase', 'Candles',
    'Plant Pot', 'Curtains', 'Rug', 'Lamp', 'Decorative Bowl'
  ],
  SPORT: [
    'Yoga Mat', 'Dumbbells', 'Basketball', 'Tennis Racket', 'Running Shoes',
    'Swim Goggles', 'Bike Helmet', 'Soccer Ball', 'Golf Balls', 'Fitness Band'
  ],
  BOOK: [
    'Fiction Novel', 'Cookbook', 'Biography', 'Textbook', 'Comic Book',
    'Poetry Collection', 'Self-Help Book', 'Travel Guide', 'Children\'s Book', 'Dictionary'
  ],
  TOYS: [
    'Action Figure', 'Puzzle Set', 'Board Game', 'Stuffed Animal', 'Building Blocks',
    'Doll', 'Remote Control Car', 'Art Supplies', 'Musical Instrument', 'Plush Toy'
  ],
  BEAUTY: [
    'Lipstick', 'Face Cream', 'Shampoo', 'Perfume', 'Nail Polish',
    'Makeup Brush', 'Hair Brush', 'Sunscreen', 'Body Lotion', 'Hair Dye'
  ],
};

const units = ['pcs', 'kg', 'liter', 'box', 'pack'];

function generateRandomSKU(): string {
  const letters = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ';
  const numbers = '0123456789';
  let sku = '';
  for (let i = 0; i < 3; i++) {
    sku += letters[Math.floor(Math.random() * letters.length)];
  }
  for (let i = 0; i < 6; i++) {
    sku += numbers[Math.floor(Math.random() * numbers.length)];
  }
  return sku;
}

function generateRandomPrice(min: number, max: number): number {
  return Math.floor(Math.random() * (max - min + 1)) + min;
}

function generateRandomDescription(name: string): string {
  const descriptions = [
    `High-quality ${name.toLowerCase()} perfect for everyday use.`,
    `Premium ${name.toLowerCase()} with excellent durability.`,
    `Affordable ${name.toLowerCase()} suitable for all occasions.`,
    `Stylish ${name.toLowerCase()} designed for comfort and style.`,
    `Reliable ${name.toLowerCase()} built to last.`,
  ];
  return descriptions[Math.floor(Math.random() * descriptions.length)];
}

function generateImageUrl(productName: string, index: number): string {
  // Use Lorem Picsum for placeholder images
  return `https://picsum.photos/seed/${encodeURIComponent(productName + index)}/400/400`;
}

async function generateDummyCategories() {
  console.log('Generating dummy categories...');
  for (const category of categories) {
    await prisma.productCategory.upsert({
      where: { code: category.code },
      update: {},
      create: category,
    });
  }
  console.log('Dummy categories generated successfully!');
}

async function generateDummyProducts(count: number = 100) {
  console.log(`Clearing existing products and categories...`);
  await prisma.product.deleteMany();
  await prisma.productCategory.deleteMany();

  console.log(`Generating ${count} dummy products...`);

  // Fetch existing categories
  let existingCategories = await prisma.productCategory.findMany();
  if (existingCategories.length === 0) {
    await generateDummyCategories();
    existingCategories = await prisma.productCategory.findMany();
  }
  const categoryIds = existingCategories.map(cat => cat.id);

  const products = [];

  for (let i = 0; i < count; i++) {
    const categoryId = categoryIds[Math.floor(Math.random() * categoryIds.length)];
    const category = existingCategories.find(cat => cat.id === categoryId);
    const categoryCode = category?.code as keyof typeof productNames;
    const names = productNames[categoryCode] || Object.values(productNames).flat();
    const name = names[Math.floor(Math.random() * names.length)];

    const product = {
      sku: generateRandomSKU(),
      name,
      description: generateRandomDescription(name),
      categoryId,
      unit: units[Math.floor(Math.random() * units.length)],
      buyPrice: generateRandomPrice(5000, 50000),
      sellPrice: generateRandomPrice(10000, 100000),
      trackStock: Math.random() > 0.5,
      qty: Math.floor(Math.random() * 100) + 1,
      imageUrl: generateImageUrl(name, i),
    };

    products.push(product);
  }

  // Insert products in batches
  const batchSize = 10;
  for (let i = 0; i < products.length; i += batchSize) {
    const batch = products.slice(i, i + batchSize);
    await prisma.product.createMany({
      data: batch,
      skipDuplicates: true,
    });
    console.log(`Inserted ${Math.min(i + batchSize, products.length)}/${products.length} products...`);
  }

  console.log(`Successfully generated ${count} dummy products!`);
}

async function main() {
  try {
    await generateDummyProducts(100);
    console.log('All dummy products have been inserted successfully!');
  } catch (error) {
    console.error('Error generating dummy products:', error);
  } finally {
    await prisma.$disconnect();
  }
}

main();
