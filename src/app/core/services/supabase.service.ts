import { Injectable, signal, computed } from '@angular/core';
import { createClient, SupabaseClient, User, Session } from '@supabase/supabase-js';
import { environment } from '../../../environments/environment';
import { ProductItem } from '../models/product.model';

export interface ProductRecord {
  id: string;
  name: string;
  brand: string;
  category: 'phone' | 'accessory';
  sub_category: string;
  price: number;
  owner_price?: number;
  original_price?: number;
  stock_quantity: number;
  in_stock: boolean;
  is_featured: boolean;
  rating: number;
  reviews_count: number;
  specs: any;
  thumbnail_url: string;
  description: string;
  created_at?: string;
  updated_at?: string;
  product_images?: Array<{
    id: string;
    cloudinary_url: string;
    cloudinary_public_id: string;
    display_order: number;
    alt_text?: string;
  }>;
}

export interface OfferRecord {
  id: string;
  title: string;
  description?: string;
  video_url: string;
  video_public_id: string;
  poster_url: string;
  target_url?: string;
  start_at: string;
  end_at: string;
  is_active: boolean;
  created_at?: string;
}

export interface OrderRecordPayload {
  customerName: string;
  customerPhone: string;
  customerEmail?: string;
  deliveryAddress: string;
  pincode?: string;
  subtotal: number;
  deliveryFee: number;
  discountAmount: number;
  totalAmount: number;
  items: Array<{
    productId: string;
    name: string;
    brand: string;
    price: number;
    quantity: number;
    thumbnailUrl: string;
  }>;
}

@Injectable({
  providedIn: 'root'
})
export class SupabaseService {
  private client: SupabaseClient = createClient(
    environment.supabase.url,
    environment.supabase.anonKey
  );

  // Reactive state signals
  private _currentUser = signal<User | null>(null);
  private _userRole = signal<'admin' | 'shopowner' | 'customer'>('customer');
  private _isAuthReady = signal<boolean>(false);

  readonly currentUser = this._currentUser.asReadonly();
  readonly userRole = this._userRole.asReadonly();
  readonly isAuthReady = this._isAuthReady.asReadonly();
  readonly isAdmin = computed(() => this._userRole() === 'admin');
  readonly isShopOwner = computed(() => this._userRole() === 'shopowner');

  constructor() {
    this.initAuthSession();
  }

  private async initAuthSession(): Promise<void> {
    try {
      const { data: { session } } = await this.client.auth.getSession();
      await this.applySession(session);

      this.client.auth.onAuthStateChange(async (_event, newSession) => {
        await this.applySession(newSession);
      });
    } catch (e) {
      this._isAuthReady.set(true);
    }
  }

  private async applySession(session: Session | null): Promise<void> {
    if (session?.user) {
      this._currentUser.set(session.user);
      try {
        const { data: profile } = await this.client
          .from('profiles')
          .select('role')
          .eq('id', session.user.id)
          .single();
        this._userRole.set(profile?.role || 'customer');
      } catch {
        this._userRole.set('customer');
      }
    } else {
      this._currentUser.set(null);
      this._userRole.set('customer');
    }
    this._isAuthReady.set(true);
  }

  // --- CATALOG API ---

  /**
   * Fetch all products including associated Cloudinary gallery images
   */
  async getProducts(): Promise<ProductItem[]> {
    const { data, error } = await this.client
      .from('products')
      .select('*, product_images(id, cloudinary_url, cloudinary_public_id, display_order, alt_text)')
      .order('created_at', { ascending: false });

    if (error) {
      throw error;
    }

    return (data || []).map((row: ProductRecord) => this.mapRecordToProductItem(row));
  }

  /**
   * Fetch a single product by UUID with all gallery images
   */
  async getProductById(id: string): Promise<ProductItem | null> {
    const { data, error } = await this.client
      .from('products')
      .select('*, product_images(id, cloudinary_url, cloudinary_public_id, display_order, alt_text)')
      .eq('id', id)
      .single();

    if (error || !data) return null;
    return this.mapRecordToProductItem(data as ProductRecord);
  }

  /**
   * Helper to map a PostgreSQL row to the Angular ProductItem model
   */
  mapRecordToProductItem(row: ProductRecord): ProductItem {
    const gallery = (row.product_images || [])
      .sort((a, b) => a.display_order - b.display_order)
      .map(img => img.cloudinary_url);

    const images = gallery.length > 0 ? gallery : [row.thumbnail_url];

    return {
      id: row.id,
      name: row.name,
      brand: row.brand,
      category: row.category,
      subCategory: row.sub_category,
      price: Number(row.price),
      ownerPrice: row.owner_price ? Number(row.owner_price) : undefined,
      originalPrice: row.original_price ? Number(row.original_price) : undefined,
      rating: Number(row.rating || 4.5),
      reviewsCount: Number(row.reviews_count || 0),
      image: row.thumbnail_url || images[0] || '',
      images,
      specs: row.specs || {},
      inStock: row.in_stock,
      isFeatured: row.is_featured,
      description: row.description || ''
    };
  }

  /**
   * Fetch active video promotions
   */
  async getActiveOffers(): Promise<OfferRecord[]> {
    const now = new Date().toISOString();
    const { data, error } = await this.client
      .from('offers')
      .select('*')
      .eq('is_active', true)
      .lte('start_at', now)
      .gte('end_at', now)
      .order('created_at', { ascending: false });

    if (error) throw error;
    return (data || []) as OfferRecord[];
  }

  private getAdminToken(): string {
    return sessionStorage.getItem('hitech_admin_token') || '';
  }

  private async callAdminCatalogApi(body: any): Promise<any> {
    try {
      const response = await fetch('/api/admin-catalog', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'X-Admin-Token': this.getAdminToken()
        },
        body: JSON.stringify(body)
      });
      if (response.ok) {
        return await response.json();
      }
    } catch (e) {
      console.warn('Admin API fetch error, will attempt client fallback:', e);
    }
    return null;
  }

  /**
   * Fetch live DB health and record counts
   */
  async getDbStatus(): Promise<any> {
    const res = await this.callAdminCatalogApi({ action: 'db-status' });
    if (res && res.counts) return res.counts;

    const { count: prodCount } = await this.client.from('products').select('*', { count: 'exact', head: true });
    return { products: prodCount || 0 };
  }

  /**
   * Insert or update a product and its Cloudinary gallery
   */
  async upsertProduct(
    product: Partial<ProductItem>,
    images: Array<{ url: string; publicId: string }> | string[] = []
  ): Promise<ProductItem> {
    // Normalise images array
    const normalizedImages = (images || []).map((img, idx) => {
      if (typeof img === 'string') {
        return { url: img, publicId: `img_${Date.now()}_${idx}` };
      }
      return img;
    });

    // 1. Try serverless admin API first (safe for all admin credentials & RLS)
    const apiRes = await this.callAdminCatalogApi({
      action: 'upsert-product',
      product,
      images: normalizedImages
    });

    if (apiRes && apiRes.success && apiRes.product) {
      return this.mapRecordToProductItem(apiRes.product as ProductRecord);
    }

    // 2. Direct Supabase client fallback
    const rowPayload: any = {
      name: product.name,
      brand: product.brand,
      category: product.category,
      sub_category: product.subCategory,
      price: product.price,
      owner_price: product.ownerPrice,
      original_price: product.originalPrice,
      stock_quantity: (product.inStock !== false) ? 25 : 0,
      is_featured: product.isFeatured ?? false,
      specs: product.specs ?? {},
      thumbnail_url: (normalizedImages[0]?.url) || product.image,
      description: product.description ?? ''
    };

    if (product.id && !product.id.startsWith('prod-') && !product.id.startsWith('phone-') && !product.id.startsWith('acc-')) {
      rowPayload.id = product.id;
    }

    const { data: savedProduct, error: prodErr } = await this.client
      .from('products')
      .upsert(rowPayload)
      .select()
      .single();

    if (prodErr) throw prodErr;

    // Insert new gallery images if provided
    if (normalizedImages.length > 0) {
      const imageRecords = normalizedImages.map((img, idx) => ({
        product_id: savedProduct.id,
        cloudinary_url: img.url,
        cloudinary_public_id: img.publicId,
        display_order: idx
      }));

      await this.client.from('product_images').insert(imageRecords);
    }

    return this.mapRecordToProductItem(savedProduct as ProductRecord);
  }

  /**
   * Update retail & wholesale price in Supabase PostgreSQL
   */
  async updateProductPrice(id: string, price: number, ownerPrice?: number): Promise<void> {
    const apiRes = await this.callAdminCatalogApi({
      action: 'update-price',
      id,
      price,
      ownerPrice
    });

    if (apiRes && apiRes.success) return;

    const calculatedOriginal = Math.round(price * 1.10);
    const resolvedOwnerPrice = (ownerPrice && ownerPrice > 0) ? ownerPrice : Math.round(price * 0.85);
    await this.client
      .from('products')
      .update({
        price: Number(price),
        owner_price: Number(resolvedOwnerPrice),
        original_price: calculatedOriginal
      })
      .eq('id', id);
  }

  /**
   * Toggle in-stock status in Supabase PostgreSQL
   */
  async toggleStock(id: string, inStock: boolean, stockQuantity?: number): Promise<void> {
    const apiRes = await this.callAdminCatalogApi({
      action: 'toggle-stock',
      id,
      inStock,
      stockQuantity
    });

    if (apiRes && apiRes.success) return;

    const qty = inStock ? (stockQuantity || 25) : 0;
    await this.client
      .from('products')
      .update({ stock_quantity: qty })
      .eq('id', id);
  }

  /**
   * Delete a product and its gallery images from Supabase PostgreSQL
   */
  async deleteProduct(id: string): Promise<void> {
    const apiRes = await this.callAdminCatalogApi({
      action: 'delete-product',
      id
    });

    if (apiRes && apiRes.success) return;

    await this.client.from('product_images').delete().eq('product_id', id);
    await this.client.from('products').delete().eq('id', id);
  }

  /**
   * Create or update promotional video offer
   */
  async upsertOffer(offer: Partial<OfferRecord>): Promise<any> {
    const apiRes = await this.callAdminCatalogApi({
      action: 'upsert-offer',
      offer
    });

    if (apiRes && apiRes.success) return apiRes.offer;

    const { data, error } = await this.client.from('offers').upsert(offer).select().single();
    if (error) throw error;
    return data;
  }

  /**
   * Delete promotional offer
   */
  async deleteOffer(id: string): Promise<void> {
    const apiRes = await this.callAdminCatalogApi({
      action: 'delete-offer',
      id
    });

    if (apiRes && apiRes.success) return;

    await this.client.from('offers').delete().eq('id', id);
  }

  /**
   * Update order status in Supabase
   */
  async updateOrderStatus(orderId: string, status: string): Promise<void> {
    const apiRes = await this.callAdminCatalogApi({
      action: 'update-order-status',
      orderId,
      status
    });

    if (apiRes && apiRes.success) return;

    await this.client.from('orders').update({ status }).eq('id', orderId);
  }

  // --- ORDER TRANSACTION ---

  /**
   * Submit order transaction into Supabase
   */
  async submitOrder(orderPayload: OrderRecordPayload): Promise<{ orderId: string; orderNumber: string }> {
    const orderNumber = 'ORD-' + Math.floor(100000 + Math.random() * 900000);
    const user = this._currentUser();

    const { data: order, error: orderErr } = await this.client
      .from('orders')
      .insert({
        order_number: orderNumber,
        user_id: user?.id ?? null,
        customer_name: orderPayload.customerName,
        customer_phone: orderPayload.customerPhone,
        customer_email: orderPayload.customerEmail,
        delivery_address: orderPayload.deliveryAddress,
        pincode: orderPayload.pincode,
        subtotal: orderPayload.subtotal,
        delivery_fee: orderPayload.deliveryFee,
        discount_amount: orderPayload.discountAmount,
        total_amount: orderPayload.totalAmount,
        placed_by_role: this._userRole()
      })
      .select('id, order_number')
      .single();

    if (orderErr) throw orderErr;

    // Insert items
    const items = orderPayload.items.map(item => ({
      order_id: order.id,
      product_id: item.productId && !item.productId.startsWith('phone-') && !item.productId.startsWith('acc-') ? item.productId : null,
      product_name: item.name,
      brand: item.brand,
      unit_price: item.price,
      quantity: item.quantity,
      total_price: item.price * item.quantity,
      thumbnail_url: item.thumbnailUrl
    }));

    const { error: itemsErr } = await this.client
      .from('order_items')
      .insert(items);

    if (itemsErr) {
      console.warn('Notice inserting order items:', itemsErr);
    }

    return { orderId: order.id, orderNumber: order.order_number };
  }

  /**
   * Fetch authenticated user's orders or all orders (if admin)
   */
  async getOrders(): Promise<any[]> {
    const { data, error } = await this.client
      .from('orders')
      .select('*, order_items(*)')
      .order('created_at', { ascending: false });

    if (error) throw error;
    return (data || []).map((row: any) => ({
      id: row.id,
      orderNumber: row.order_number,
      customer: {
        name: row.customer_name,
        phone: row.customer_phone,
        email: row.customer_email,
        address: row.delivery_address,
        pincode: row.pincode
      },
      items: (row.order_items || []).map((item: any) => ({
        productId: item.product_id,
        name: item.product_name,
        brand: item.brand,
        price: Number(item.unit_price),
        quantity: item.quantity,
        totalPrice: Number(item.total_price),
        image: item.thumbnail_url
      })),
      subtotal: Number(row.subtotal),
      deliveryCharge: Number(row.delivery_fee),
      discount: Number(row.discount_amount),
      totalAmount: Number(row.total_amount),
      placedByRole: row.placed_by_role,
      status: row.status,
      createdAt: row.created_at,
      ownerNotifiedViaEmail: true
    }));
  }
}

