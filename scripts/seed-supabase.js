/**
 * Seed Script: Populates Supabase PostgreSQL with local products and accessories catalog.
 * Run via: node scripts/seed-supabase.js
 */
const { createClient } = require('@supabase/supabase-js');
const fs = require('fs');
const path = require('path');

// Built-in .env parser (zero extra dependencies required)
const envPath = path.join(__dirname, '..', '.env');
if (fs.existsSync(envPath)) {
  const envContent = fs.readFileSync(envPath, 'utf8');
  for (const line of envContent.split('\n')) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith('#')) continue;
    const eqIdx = trimmed.indexOf('=');
    if (eqIdx > 0) {
      const key = trimmed.slice(0, eqIdx).trim();
      const val = trimmed.slice(eqIdx + 1).trim();
      if (!process.env[key]) {
        process.env[key] = val;
      }
    }
  }
}

const supabaseUrl = process.env.SUPABASE_URL;
const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!supabaseUrl || !serviceRoleKey) {
  console.error('Error: SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY are required in .env or environment.');
  process.exit(1);
}

const supabase = createClient(supabaseUrl, serviceRoleKey, {
  auth: { persistSession: false }
});

async function seed() {
  console.log('Connecting to Supabase:', supabaseUrl);

  const productsPath = fs.existsSync(path.join(__dirname, '..', 'seeds', 'products.json'))
    ? path.join(__dirname, '..', 'seeds', 'products.json')
    : path.join(__dirname, '..', 'public', 'data', 'products.json');
  const accessoriesPath = fs.existsSync(path.join(__dirname, '..', 'seeds', 'accessories.json'))
    ? path.join(__dirname, '..', 'seeds', 'accessories.json')
    : path.join(__dirname, '..', 'public', 'data', 'accessories.json');

  const products = fs.existsSync(productsPath) ? JSON.parse(fs.readFileSync(productsPath, 'utf8')) : [];
  const accessories = fs.existsSync(accessoriesPath) ? JSON.parse(fs.readFileSync(accessoriesPath, 'utf8')) : [];
  const allItems = [...products, ...accessories];

  console.log(`Found ${products.length} phones and ${accessories.length} accessories (${allItems.length} total).`);

  let insertedCount = 0;
  let galleryCount = 0;

  for (const item of allItems) {
    const isPhone = item.category === 'phone' || (item.id && item.id.startsWith('phone-'));
    const category = isPhone ? 'phone' : 'accessory';

    // 1. Insert product record
    const { data: prodData, error: prodErr } = await supabase
      .from('products')
      .upsert({
        name: item.name,
        brand: item.brand,
        category,
        sub_category: item.subCategory || (category === 'phone' ? 'Smartphones' : 'Accessories'),
        price: Number(item.price),
        owner_price: item.ownerPrice ? Number(item.ownerPrice) : Math.round(Number(item.price) * 0.85),
        original_price: item.originalPrice ? Number(item.originalPrice) : Math.round(Number(item.price) * 1.15),
        stock_quantity: item.inStock === false ? 0 : 25,
        is_featured: !!item.isFeatured,
        rating: Number(item.rating || 4.5),
        reviews_count: Number(item.reviewsCount || 0),
        specs: item.specs || {},
        thumbnail_url: item.image || (item.images && item.images[0]) || '',
        description: item.description || ''
      }, { onConflict: 'name,brand' })
      .select('id, name')
      .single();

    if (prodErr) {
      console.error(`Failed to upsert product '${item.name}':`, prodErr.message);
      continue;
    }

    insertedCount++;

    // 2. Insert multi-image gallery
    const imageList = Array.isArray(item.images) && item.images.length > 0 ? item.images : (item.image ? [item.image] : []);
    if (imageList.length > 0) {
      const imgRows = imageList.map((imgUrl, idx) => ({
        product_id: prodData.id,
        cloudinary_url: imgUrl,
        cloudinary_public_id: `hitech-seed-${prodData.id}-${idx}`,
        display_order: idx,
        alt_text: `${item.name} View ${idx + 1}`
      }));

      const { error: imgErr } = await supabase.from('product_images').insert(imgRows);
      if (!imgErr) {
        galleryCount += imgRows.length;
      }
    }
  }

  console.log(`\n========================================`);
  console.log(`Seed Complete!`);
  console.log(`Products Processed: ${insertedCount}`);
  console.log(`Gallery Images Mapped: ${galleryCount}`);
  console.log(`========================================`);
}

seed().catch(err => {
  console.error('Seed exception:', err);
  process.exit(1);
});
