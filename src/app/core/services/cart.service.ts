import { Injectable, signal, computed, effect } from '@angular/core';
import { ProductItem, CartItem } from '../models/product.model';

const CART_STORAGE_KEY = 'hitech_cart_items';

@Injectable({
  providedIn: 'root'
})
export class CartService {
  private _items = signal<CartItem[]>(this.loadFromStorage());
  private _isBulkMode = signal<boolean>(false);
  private _bulkDiscountPercent = signal<number>(10); // 10% default bulk discount for shop owners

  readonly items = this._items.asReadonly();
  readonly isBulkMode = this._isBulkMode.asReadonly();

  // Computed signals
  readonly totalCount = computed(() =>
    this._items().reduce((acc, item) => acc + item.quantity, 0)
  );

  readonly subtotal = computed(() =>
    this._items().reduce((acc, item) => acc + ((item.selectedPrice ?? item.product.price) * item.quantity), 0)
  );

  readonly discountAmount = computed(() => {
    if (!this._isBulkMode()) return 0;
    return Math.round(this.subtotal() * (this._bulkDiscountPercent() / 100));
  });

  readonly deliveryFee = computed(() => {
    const sub = this.subtotal();
    if (sub === 0) return 0;
    return sub > 1000 ? 0 : 99; // Free delivery over ₹1,000
  });

  readonly finalTotal = computed(() =>
    Math.max(0, this.subtotal() - this.discountAmount() + this.deliveryFee())
  );

  constructor() {
    // Auto-sync with localStorage whenever cart changes
    effect(() => {
      try {
        localStorage.setItem(CART_STORAGE_KEY, JSON.stringify(this._items()));
      } catch (e) {
        console.error('Failed to sync cart to localStorage', e);
      }
    });
  }

  private loadFromStorage(): CartItem[] {
    try {
      const saved = localStorage.getItem(CART_STORAGE_KEY);
      if (!saved) return [];
      const parsed = JSON.parse(saved);
      return parsed.map((item: CartItem) => ({
        ...item,
        selectedPrice: item.selectedPrice ?? item.product.price
      }));
    } catch {
      return [];
    }
  }

  setBulkMode(enabled: boolean, discountPercent: number = 10): void {
    this._isBulkMode.set(enabled);
    this._bulkDiscountPercent.set(discountPercent);
  }

  addToCart(product: ProductItem, quantity: number = 1, priceToUse?: number): void {
    const finalPrice = priceToUse ?? product.price;
    this._items.update(currentItems => {
      const existingIndex = currentItems.findIndex(i => i.product.id === product.id);
      if (existingIndex > -1) {
        const updated = [...currentItems];
        updated[existingIndex] = {
          ...updated[existingIndex],
          selectedPrice: finalPrice,
          quantity: updated[existingIndex].quantity + quantity
        };
        return updated;
      } else {
        return [...currentItems, {
          product,
          quantity,
          selectedPrice: finalPrice
        }];
      }
    });
  }

  updateQuantity(productId: string, quantity: number): void {
    if (quantity <= 0) {
      this.removeFromCart(productId);
      return;
    }
    this._items.update(currentItems =>
      currentItems.map(item =>
        item.product.id === productId ? { ...item, quantity } : item
      )
    );
  }

  removeFromCart(productId: string): void {
    this._items.update(currentItems =>
      currentItems.filter(item => item.product.id !== productId)
    );
  }

  clearCart(): void {
    this._items.set([]);
  }
}
