const { checkSecurity } = require('./_security');
const { createClient } = require('@supabase/supabase-js');
const fs = require('fs');
const path = require('path');

function getEnvConfig(key) {
  if (process.env[key]) {
    return process.env[key];
  }
  for (const envFile of ['.env', '.env.local']) {
    try {
      const fullPath = path.join(process.cwd(), envFile);
      if (fs.existsSync(fullPath)) {
        const content = fs.readFileSync(fullPath, 'utf8');
        const match = content.match(new RegExp(`${key}\\s*=\\s*([^\\r\\n]+)`));
        if (match) return match[1].trim().replace(/^['"]|['"]$/g, '');
      }
    } catch {}
  }
  return '';
}

function getValidAdminHashes() {
  const configuredHash = getEnvConfig('ADMIN_PASSWORD_HASH');
  return configuredHash ? [configuredHash] : [];
}

function getSupabaseClient() {
  const url = getEnvConfig('SUPABASE_URL');
  const secretKey = getEnvConfig('SUPABASE_SERVICE_ROLE_KEY');
  if (!url || !secretKey) {
    throw new Error('SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY must be configured in environment or .env');
  }
  return createClient(url, secretKey, {
    auth: { persistSession: false }
  });
}

module.exports = async function handler(req, res) {
  // CORS Headers
  const reqOrigin = req.headers.origin || '';
  const isAllowedOrigin = (orig) => {
    if (!orig) return true;
    if (orig.includes('localhost') || orig.includes('127.0.0.1')) return true;
    if (orig.endsWith('.vercel.app')) return true;
    if (orig.includes('hitechmobiles') || orig.includes('hitech')) return true;
    return false;
  };

  const allowedOrigin = isAllowedOrigin(reqOrigin) && reqOrigin ? reqOrigin : '*';

  res.setHeader('Access-Control-Allow-Origin', allowedOrigin);
  if (allowedOrigin !== '*') {
    res.setHeader('Access-Control-Allow-Credentials', 'true');
  }
  res.setHeader('Access-Control-Allow-Methods', 'GET,POST,PUT,DELETE,OPTIONS');
  res.setHeader(
    'Access-Control-Allow-Headers',
    'Content-Type, Authorization, X-Requested-With, Accept, X-HiTech-Client, X-Admin-Token'
  );
  res.setHeader('Access-Control-Max-Age', '86400');
  res.setHeader('Vary', 'Origin');

  if (req.method === 'OPTIONS') {
    return res.status(204).end();
  }

  // Security check with 2MB payload allowance and higher burst allowance for admin
  const sec = checkSecurity(req, res, {
    maxPayloadSize: 2 * 1024 * 1024,
    skipAttackInspection: true,
    maxRequestsPerWindow: 60
  });
  if (!sec.allowed) {
    return res.status(sec.status).json({ error: sec.error });
  }

  // Validate Super Admin Token
  const adminToken = req.headers['x-admin-token'] || req.headers.authorization?.replace(/^Bearer\s+/i, '');
  const validHashes = getValidAdminHashes();
  const isValidAdmin = validHashes.length > 0 && validHashes.includes(adminToken);

  if (!isValidAdmin) {
    return res.status(403).json({ error: 'Unauthorized: Valid Super Admin credentials required.' });
  }

  const supabase = getSupabaseClient();
  const action = req.query.action || req.body?.action;

  try {
    switch (action) {
      case 'db-status': {
        const { count: prodCount } = await supabase.from('products').select('*', { count: 'exact', head: true });
        const { count: imgCount } = await supabase.from('product_images').select('*', { count: 'exact', head: true });
        const { count: offerCount } = await supabase.from('offers').select('*', { count: 'exact', head: true });
        const { count: orderCount } = await supabase.from('orders').select('*', { count: 'exact', head: true });
        return res.status(200).json({
          success: true,
          status: 'healthy',
          counts: {
            products: prodCount || 0,
            productImages: imgCount || 0,
            offers: offerCount || 0,
            orders: orderCount || 0
          }
        });
      }

      case 'upsert-product': {
        const { product, images } = req.body;
        if (!product || !product.name || !product.price) {
          return res.status(400).json({ error: 'Invalid product payload: name and price required' });
        }

        const calculatedOriginal = product.originalPrice || Math.round(product.price * 1.10);
        const resolvedOwnerPrice = product.ownerPrice && product.ownerPrice > 0
          ? product.ownerPrice
          : Math.round(product.price * 0.85);

        const stockQuantity = (product.inStock !== false)
          ? (product.stockQuantity || 25)
          : 0;

        const rowPayload = {
          name: product.name,
          brand: product.brand,
          category: product.category,
          sub_category: product.subCategory || (product.category === 'phone' ? 'Smartphones' : 'Accessories'),
          price: Number(product.price),
          owner_price: Number(resolvedOwnerPrice),
          original_price: Number(calculatedOriginal),
          stock_quantity: stockQuantity,
          is_featured: !!product.isFeatured,
          rating: Number(product.rating || 4.5),
          reviews_count: Number(product.reviewsCount || 0),
          specs: product.specs || {},
          thumbnail_url: product.image || (images && images[0]?.url) || '',
          description: product.description || ''
        };

        // If valid UUID exists, include it for update
        const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
        if (product.id && uuidRegex.test(product.id)) {
          rowPayload.id = product.id;
        }

        const { data: savedProduct, error: prodErr } = await supabase
          .from('products')
          .upsert(rowPayload)
          .select()
          .single();

        if (prodErr) throw prodErr;

        // If gallery images provided, manage product_images
        if (Array.isArray(images) && images.length > 0) {
          // Remove old images for this product
          await supabase.from('product_images').delete().eq('product_id', savedProduct.id);

          const imageRecords = images.map((img, idx) => ({
            product_id: savedProduct.id,
            cloudinary_url: typeof img === 'string' ? img : img.url,
            cloudinary_public_id: (typeof img === 'object' && img.publicId) ? img.publicId : `img_${Date.now()}_${idx}`,
            display_order: idx
          }));

          const { error: imgErr } = await supabase.from('product_images').insert(imageRecords);
          if (imgErr) console.warn('Gallery insert notice:', imgErr.message);
        }

        return res.status(200).json({ success: true, product: savedProduct });
      }

      case 'update-price': {
        const { id, price, ownerPrice } = req.body;
        if (!id || !price) {
          return res.status(400).json({ error: 'Product id and price required' });
        }

        const calculatedOriginal = Math.round(price * 1.10);
        const resolvedOwnerPrice = (ownerPrice && ownerPrice > 0) ? ownerPrice : Math.round(price * 0.85);

        const { data, error } = await supabase
          .from('products')
          .update({
            price: Number(price),
            owner_price: Number(resolvedOwnerPrice),
            original_price: calculatedOriginal
          })
          .eq('id', id)
          .select()
          .single();

        if (error) throw error;
        return res.status(200).json({ success: true, product: data });
      }

      case 'toggle-stock': {
        const { id, inStock, stockQuantity } = req.body;
        if (!id) return res.status(400).json({ error: 'Product id required' });

        const qty = inStock ? (stockQuantity || 25) : 0;
        const { data, error } = await supabase
          .from('products')
          .update({ stock_quantity: qty })
          .eq('id', id)
          .select()
          .single();

        if (error) throw error;
        return res.status(200).json({ success: true, product: data });
      }

      case 'delete-product': {
        const { id } = req.body;
        if (!id) return res.status(400).json({ error: 'Product id required' });

        // Delete images first
        await supabase.from('product_images').delete().eq('product_id', id);
        const { error } = await supabase.from('products').delete().eq('id', id);

        if (error) throw error;
        return res.status(200).json({ success: true, message: 'Product deleted from Supabase PostgreSQL' });
      }

      case 'upsert-offer': {
        const { offer } = req.body;
        if (!offer || !offer.title || !offer.video_url) {
          return res.status(400).json({ error: 'Offer title and video_url required' });
        }

        const rowPayload = {
          title: offer.title,
          description: offer.description || '',
          video_url: offer.video_url,
          video_public_id: offer.video_public_id || 'offer_' + Date.now(),
          poster_url: offer.poster_url || '',
          target_url: offer.target_url || '/products',
          start_at: offer.start_at || new Date().toISOString(),
          end_at: offer.end_at || new Date(Date.now() + 30 * 24 * 3600 * 1000).toISOString(),
          is_active: offer.is_active !== false
        };

        const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
        if (offer.id && uuidRegex.test(offer.id)) {
          rowPayload.id = offer.id;
        }

        const { data, error } = await supabase.from('offers').upsert(rowPayload).select().single();
        if (error) throw error;
        return res.status(200).json({ success: true, offer: data });
      }

      case 'delete-offer': {
        const { id } = req.body;
        if (!id) return res.status(400).json({ error: 'Offer id required' });
        const { error } = await supabase.from('offers').delete().eq('id', id);
        if (error) throw error;
        return res.status(200).json({ success: true, message: 'Offer removed' });
      }

      case 'update-order-status': {
        const { orderId, status } = req.body;
        if (!orderId || !status) return res.status(400).json({ error: 'orderId and status required' });

        const { data, error } = await supabase
          .from('orders')
          .update({ status })
          .eq('id', orderId)
          .select()
          .single();

        if (error) throw error;
        return res.status(200).json({ success: true, order: data });
      }

      default:
        return res.status(400).json({ error: `Unknown action: ${action}` });
    }
  } catch (err) {
    console.error('[AdminCatalogAPI Error]', err);
    return res.status(500).json({ error: err.message || 'Internal Database Server Error' });
  }
};
