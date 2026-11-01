import { Injectable, signal, computed, inject } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { firstValueFrom } from 'rxjs';
import { ProductItem } from '../models/product.model';
import { ServiceBookingItem } from '../models/service.model';
import { ShopOwner, ShopRegistrationForm } from '../models/shop-owner.model';
import { parseDiscountPercent } from '../utils/wholesale.util';
import { LoggerService } from './logger.service';

const STORAGE_KEYS = {
  PRODUCTS: 'hitech_custom_products',
  ACCESSORIES: 'hitech_custom_accessories',
  SERVICES: 'hitech_custom_services',
  SHOP_OWNERS: 'hitech_custom_shopowners'
};

@Injectable({
  providedIn: 'root'
})
export class DataService {
  private http = inject(HttpClient);
  private logger = inject(LoggerService);

  // Reactive state signals
  private _products = signal<ProductItem[]>([]);
  private _accessories = signal<ProductItem[]>([]);
  private _services = signal<ServiceBookingItem[]>([]);
  private _shopOwners = signal<ShopOwner[]>([]);
  private _isLoaded = signal<boolean>(false);

  // Readonly public signals
  readonly products = this._products.asReadonly();
  readonly accessories = this._accessories.asReadonly();
  readonly services = this._services.asReadonly();
  readonly shopOwners = this._shopOwners.asReadonly();
  readonly isLoaded = this._isLoaded.asReadonly();

  // Computed signals
  readonly allProducts = computed(() => [...this._products(), ...this._accessories()]);
  readonly publicProducts = computed(() => this._products().filter(p => p.inStock));
  readonly publicAccessories = computed(() => this._accessories().filter(p => p.inStock));
  readonly publicAllProducts = computed(() => [...this.publicProducts(), ...this.publicAccessories()]);
  readonly featuredProducts = computed(() => this.publicAllProducts().filter(p => p.isFeatured));
  readonly activeShopOwners = computed(() => this._shopOwners().filter(o => o.status === 'active'));
  readonly pendingShopOwners = computed(() => this._shopOwners().filter(o => o.status === 'pending'));

  constructor() {
    this.initData();
  }

  /**
   * Initializes data by loading bundled JSON and merging any localStorage modifications
   */
  async initData(): Promise<void> {
    try {
      // 1. Load Products
      const localProducts = localStorage.getItem(STORAGE_KEYS.PRODUCTS);
      if (localProducts) {
        this._products.set(JSON.parse(localProducts));
      } else {
        this.http.get<ProductItem[]>('data/products.json').subscribe({
          next: (data) => this._products.set(data),
          error: (err) => this.logger.error('DataService', 'Failed to load products.json', err)
        });
      }

      // 2. Load Accessories
      const localAccessories = localStorage.getItem(STORAGE_KEYS.ACCESSORIES);
      if (localAccessories) {
        this._accessories.set(JSON.parse(localAccessories));
      } else {
        this.http.get<ProductItem[]>('data/accessories.json').subscribe({
          next: (data) => this._accessories.set(data),
          error: (err) => this.logger.error('DataService', 'Failed to load accessories.json', err)
        });
      }

      // 3. Load Services
      const localServices = localStorage.getItem(STORAGE_KEYS.SERVICES);
      if (localServices) {
        this._services.set(JSON.parse(localServices));
      } else {
        this.http.get<ServiceBookingItem[]>('data/services.json').subscribe({
          next: (data) => this._services.set(data),
          error: (err) => this.logger.error('DataService', 'Failed to load services.json', err)
        });
      }

      // 4. Load Shop Owners
      const localOwners = localStorage.getItem(STORAGE_KEYS.SHOP_OWNERS);
      if (localOwners) {
        try {
          this._shopOwners.set(JSON.parse(localOwners));
        } catch {}
      } else {
        this.http.get<ShopOwner[]>('data/shop-owners.json').subscribe({
          next: (data) => this._shopOwners.set(data),
          error: (err) => this.logger.error('DataService', 'Failed to load shop-owners.json', err)
        });
      }

      this._isLoaded.set(true);
      this.logger.info('DataService', 'Catalogs initialized successfully');
    } catch (e) {
      this.logger.error('DataService', 'Error during initData', e);
      this._isLoaded.set(true);
    }
  }

  // --- Products & Accessories Modifiers ---

  private persistProducts(list: ProductItem[]): void {
    localStorage.setItem(STORAGE_KEYS.PRODUCTS, JSON.stringify(list));
  }

  private persistAccessories(list: ProductItem[]): void {
    localStorage.setItem(STORAGE_KEYS.ACCESSORIES, JSON.stringify(list));
  }

  private persistOwners(list: ShopOwner[]): void {
    localStorage.setItem(STORAGE_KEYS.SHOP_OWNERS, JSON.stringify(list));
  }

  getDiscountPercent(tier?: string): number {
    return parseDiscountPercent(tier, 10);
  }

  addProduct(product: Omit<ProductItem, 'id'> & { id?: string }): ProductItem {
    const newProduct: ProductItem = {
      ...product,
      id: product.id || 'prod-' + Date.now(),
      rating: product.rating ?? 4.5,
      reviewsCount: product.reviewsCount ?? 0,
      inStock: product.inStock ?? true
    };

    if (newProduct.category === 'accessory') {
      this._accessories.update(list => {
        const updated = [newProduct, ...list];
        this.persistAccessories(updated);
        return updated;
      });
    } else {
      this._products.update(list => {
        const updated = [newProduct, ...list];
        this.persistProducts(updated);
        return updated;
      });
    }
    return newProduct;
  }

  updateProduct(product: ProductItem): void {
    const inPhones = this._products().some(p => p.id === product.id);
    const inAccessories = this._accessories().some(p => p.id === product.id);
    const shouldBeAccessory = product.category === 'accessory';

    if (inPhones && shouldBeAccessory) {
      this._products.update(list => {
        const updated = list.filter(p => p.id !== product.id);
        this.persistProducts(updated);
        return updated;
      });
      this._accessories.update(list => {
        const updated = [product, ...list];
        this.persistAccessories(updated);
        return updated;
      });
      return;
    }

    if (inAccessories && !shouldBeAccessory) {
      this._accessories.update(list => {
        const updated = list.filter(p => p.id !== product.id);
        this.persistAccessories(updated);
        return updated;
      });
      this._products.update(list => {
        const updated = [product, ...list];
        this.persistProducts(updated);
        return updated;
      });
      return;
    }

    if (inPhones || (!inAccessories && !shouldBeAccessory)) {
      this._products.update(list => {
        const updated = list.map(item => item.id === product.id ? product : item);
        this.persistProducts(updated);
        return updated;
      });
    } else {
      this._accessories.update(list => {
        const updated = list.map(item => item.id === product.id ? product : item);
        this.persistAccessories(updated);
        return updated;
      });
    }
  }

  deleteProduct(id: string): void {
    this._products.update(list => {
      const updated = list.filter(p => p.id !== id);
      this.persistProducts(updated);
      return updated;
    });
    this._accessories.update(list => {
      const updated = list.filter(p => p.id !== id);
      this.persistAccessories(updated);
      return updated;
    });
  }

  toggleProductAvailability(id: string): void {
    const isPhone = this._products().some(p => p.id === id);
    if (isPhone) {
      this._products.update(list => {
        const updated = list.map(item => item.id === id ? { ...item, inStock: !item.inStock } : item);
        this.persistProducts(updated);
        return updated;
      });
    } else {
      this._accessories.update(list => {
        const updated = list.map(item => item.id === id ? { ...item, inStock: !item.inStock } : item);
        this.persistAccessories(updated);
        return updated;
      });
    }
  }

  updateProductPrice(id: string, newPrice: number): void {
    const isPhone = this._products().some(p => p.id === id);
    if (isPhone) {
      this._products.update(list => {
        const updated = list.map(item => item.id === id ? { ...item, price: newPrice } : item);
        this.persistProducts(updated);
        return updated;
      });
    } else {
      this._accessories.update(list => {
        const updated = list.map(item => item.id === id ? { ...item, price: newPrice } : item);
        this.persistAccessories(updated);
        return updated;
      });
    }
  }

  // --- Services Modifiers ---

  toggleServiceAvailability(id: string): void {
    this._services.update(list => {
      const updated = list.map(srv => srv.id === id ? { ...srv, available: !srv.available } : srv);
      localStorage.setItem(STORAGE_KEYS.SERVICES, JSON.stringify(updated));
      return updated;
    });
  }

  updateServicePrice(id: string, newPrice: number): void {
    this._services.update(list => {
      const updated = list.map(srv => srv.id === id ? { ...srv, startingPrice: newPrice } : srv);
      localStorage.setItem(STORAGE_KEYS.SERVICES, JSON.stringify(updated));
      return updated;
    });
  }

  // --- Shop Owners Modifiers ---

  toggleShopOwnerStatus(id: string): void {
    this._shopOwners.update(list => {
      const updated = list.map(owner => {
        if (owner.id === id) {
          if (owner.status === 'pending') {
            return owner;
          }
          const newStatus: 'active' | 'suspended' = owner.status === 'active' ? 'suspended' : 'active';
          return { ...owner, status: newStatus };
        }
        return owner;
      });
      this.persistOwners(updated);
      return updated;
    });
  }

  updateShopOwnerCredentials(id: string, email: string, passwordPlain?: string, tier?: string): void {
    this._shopOwners.update(list => {
      const updated = list.map(owner => {
        if (owner.id === id) {
          return {
            ...owner,
            email: email || owner.email,
            defaultPasswordPlain: passwordPlain || owner.defaultPasswordPlain,
            bulkDiscountTier: tier || owner.bulkDiscountTier
          };
        }
        return owner;
      });
      this.persistOwners(updated);
      return updated;
    });
  }

  approveShopOwner(id: string, email: string, passwordPlain: string, tier: string): ShopOwner | null {
    let approved: ShopOwner | null = null;
    this._shopOwners.update(list => {
      const updated = list.map(owner => {
        if (owner.id !== id) return owner;
        approved = {
          ...owner,
          email: email || owner.email,
          defaultPasswordPlain: passwordPlain || owner.defaultPasswordPlain || 'Owner@HiTech123',
          bulkDiscountTier: tier || owner.bulkDiscountTier || 'Silver (10% OFF)',
          status: 'active'
        };
        return approved;
      });
      this.persistOwners(updated);
      return updated;
    });
    return approved;
  }

  registerNewShopOwner(form: ShopRegistrationForm): ShopOwner {
    const newOwner: ShopOwner = {
      id: 'owner-' + Date.now(),
      email: form.email,
      defaultPasswordPlain: '',
      role: 'shopowner',
      shopName: form.shopName,
      ownerName: form.ownerName,
      phone: form.phone,
      location: form.location,
      shopPhoto: form.shopPhoto || 'https://images.unsplash.com/photo-1556742049-0a67c5574f73?auto=format&fit=crop&w=800&q=80',
      gstNumber: form.gstNumber || '',
      status: 'pending',
      registeredDate: new Date().toISOString().split('T')[0],
      bulkDiscountTier: 'Silver (10% OFF)'
    };

    this._shopOwners.update(list => {
      const updated = [newOwner, ...list];
      this.persistOwners(updated);
      return updated;
    });

    return newOwner;
  }

  async refreshShopOwners(): Promise<ShopOwner[]> {
    try {
      const remote = await firstValueFrom(
        this.http.get<ShopOwner[]>('data/shop-owners.json')
      );
      if (Array.isArray(remote)) {
        const current = this._shopOwners();
        const merged = [...current];
        for (const r of remote) {
          const idx = merged.findIndex(o => o.id === r.id || o.email.toLowerCase() === r.email.toLowerCase());
          if (idx === -1) {
            merged.unshift(r);
          } else {
            merged[idx] = { ...merged[idx], ...r };
          }
        }
        this._shopOwners.set(merged);
        this.persistOwners(merged);
        this.logger.info('DataService', `Shop owners refreshed: ${merged.length} partners loaded`);
        return merged;
      }
    } catch (err) {
      this.logger.warn('DataService', 'Failed to refresh remote shop owners', err);
    }
    return this._shopOwners();
  }

  // --- Helpers for Static Data Reset and Export ---

  resetAllData(): void {
    localStorage.removeItem(STORAGE_KEYS.PRODUCTS);
    localStorage.removeItem(STORAGE_KEYS.ACCESSORIES);
    localStorage.removeItem(STORAGE_KEYS.SERVICES);
    localStorage.removeItem(STORAGE_KEYS.SHOP_OWNERS);
    this.initData();
  }

  exportDataJson(type: 'products' | 'accessories' | 'services' | 'shop-owners'): void {
    let data: any = [];
    if (type === 'products') data = this._products();
    if (type === 'accessories') data = this._accessories();
    if (type === 'services') data = this._services();
    if (type === 'shop-owners') data = this._shopOwners();
    this.downloadJsonFile(`${type}.json`, data);
  }

  getCatalogSnapshot(): { products: ProductItem[]; accessories: ProductItem[]; services: ServiceBookingItem[]; shopOwners: ShopOwner[] } {
    return {
      products: this._products(),
      accessories: this._accessories(),
      services: this._services(),
      shopOwners: this._shopOwners()
    };
  }

  downloadJsonFile(filename: string, data: unknown): void {
    const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' });
    const url = window.URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = filename;
    a.click();
    window.URL.revokeObjectURL(url);
  }
}
