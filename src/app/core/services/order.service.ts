import { Injectable, signal, computed, inject } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { firstValueFrom } from 'rxjs';
import { CustomerDetails, Order, OrderItemRecord } from '../models/order.model';
import { ServiceBookingRequest, ServiceFulfillmentMode } from '../models/service.model';
import { CartService } from './cart.service';
import { EmailService } from './email.service';
import { AuthService } from './auth.service';
import { CatalogPublishService } from './catalog-publish.service';
import { LoggerService } from './logger.service';
import { IndexedDbService } from './indexed-db.service';
import { SupabaseService } from './supabase.service';

const ORDERS_STORAGE_KEY = 'hitech_customer_orders';
const BOOKINGS_STORAGE_KEY = 'hitech_service_bookings';

@Injectable({
  providedIn: 'root'
})
export class OrderService {
  private cartService = inject(CartService);
  private emailService = inject(EmailService);
  private authService = inject(AuthService);
  private publishService = inject(CatalogPublishService);
  private logger = inject(LoggerService);
  private idbService = inject(IndexedDbService);
  private http = inject(HttpClient);
  private supabaseService = inject(SupabaseService);

  private _orders = signal<Order[]>(this.loadOrdersFromStorage());
  private _bookings = signal<ServiceBookingRequest[]>(this.loadBookingsFromStorage());
  private _lastPlacedOrder = signal<Order | null>(null);
  private _lastPlacedBooking = signal<ServiceBookingRequest | null>(null);

  readonly orders = this._orders.asReadonly();
  readonly bookings = this._bookings.asReadonly();
  readonly lastPlacedOrder = this._lastPlacedOrder.asReadonly();
  readonly lastPlacedBooking = this._lastPlacedBooking.asReadonly();

  readonly totalOrdersCount = computed(() => this._orders().length);
  readonly totalBookingsCount = computed(() => this._bookings().length);

  constructor() {
    this.initStorageAndSync();
  }

  /**
   * Asynchronous initialization:
   * 1. Loads from IndexedDB
   * 2. Migrates localStorage items to IndexedDB if needed
   * 3. Syncs from server ledger (public/data/orders.json and bookings.json)
   */
  private async initStorageAndSync(): Promise<void> {
    try {
      // 1. Fetch existing from IndexedDB
      const idbOrders = await this.idbService.getAllOrders();
      const idbBookings = await this.idbService.getAllBookings();

      // 2. Fetch server ledger from Supabase PostgreSQL (if online)
      let serverOrders: Order[] = [];
      const serverBookings: ServiceBookingRequest[] = [];
      try {
        const supaOrders = await this.supabaseService.getOrders?.();
        if (Array.isArray(supaOrders)) {
          serverOrders = supaOrders;
        }
      } catch {
        // Offline or unauthenticated
      }

      // 3. Merge: Local signal (which had localStorage) + IndexedDB + Server orders (keyed by id)
      const mergedOrdersMap = new Map<string, Order>();
      // Older items from server first
      for (const ord of serverOrders) {
        if (ord?.id) mergedOrdersMap.set(ord.id, ord);
      }
      // IndexedDB items override
      for (const ord of idbOrders) {
        if (ord?.id) mergedOrdersMap.set(ord.id, ord);
      }
      // LocalStorage / signal items override
      for (const ord of this._orders()) {
        if (ord?.id) mergedOrdersMap.set(ord.id, ord);
      }

      const mergedOrders = Array.from(mergedOrdersMap.values()).sort((a, b) => {
        const tA = new Date(a.createdAt || 0).getTime() || 0;
        const tB = new Date(b.createdAt || 0).getTime() || 0;
        return tB - tA; // newest first
      });

      // Same for bookings
      const mergedBookingsMap = new Map<string, ServiceBookingRequest>();
      for (const b of serverBookings) {
        if (b?.id) mergedBookingsMap.set(b.id, b);
      }
      for (const b of idbBookings) {
        if (b?.id) mergedBookingsMap.set(b.id, b);
      }
      for (const b of this._bookings()) {
        if (b?.id) mergedBookingsMap.set(b.id, b);
      }

      const mergedBookings = Array.from(mergedBookingsMap.values()).sort((a, b) => {
        const tA = new Date(a.createdAt || 0).getTime() || 0;
        const tB = new Date(b.createdAt || 0).getTime() || 0;
        return tB - tA;
      });

      // Update state and persist to both IndexedDB and localStorage
      this._orders.set(mergedOrders);
      this._bookings.set(mergedBookings);

      try {
        localStorage.setItem(ORDERS_STORAGE_KEY, JSON.stringify(mergedOrders));
        localStorage.setItem(BOOKINGS_STORAGE_KEY, JSON.stringify(mergedBookings));
      } catch {
        // Quota exceeded
      }

      await this.idbService.saveAllOrders(mergedOrders);
      await this.idbService.saveAllBookings(mergedBookings);

      this.logger.info('OrderService', `Storage initialized with IndexedDB. Loaded ${mergedOrders.length} orders and ${mergedBookings.length} bookings.`);
    } catch (err: any) {
      this.logger.warn('OrderService', `IndexedDB sync fallback to localStorage: ${err?.message}`);
    }
  }

  private loadOrdersFromStorage(): Order[] {
    try {
      const saved = localStorage.getItem(ORDERS_STORAGE_KEY);
      return saved ? JSON.parse(saved) : [];
    } catch {
      return [];
    }
  }

  private loadBookingsFromStorage(): ServiceBookingRequest[] {
    try {
      const saved = localStorage.getItem(BOOKINGS_STORAGE_KEY);
      return saved ? JSON.parse(saved) : [];
    } catch {
      return [];
    }
  }

  /**
   * Submit and finalize checkout order
   */
  async placeOrder(customer: CustomerDetails): Promise<{ success: boolean; order?: Order; message?: string }> {
    const cartItems = this.cartService.items();
    if (cartItems.length === 0) {
      return { success: false, message: 'Your cart is empty.' };
    }

    if (!customer.name?.trim() || !customer.phone?.trim() || !customer.address?.trim()) {
      return { success: false, message: 'Name, Phone number, and Delivery Address are mandatory.' };
    }

    const orderItems: OrderItemRecord[] = cartItems.map(item => ({
      productId: item.product.id,
      name: item.product.name,
      brand: item.product.brand,
      price: item.selectedPrice,
      quantity: item.quantity,
      totalPrice: item.selectedPrice * item.quantity,
      image: item.product.image
    }));

    const session = this.authService.currentSession();
    const isOwner = this.authService.isShopOwner();

    const orderId = 'HT-' + Date.now().toString().slice(-6);
    const orderNumber = 'ORD-' + Math.floor(100000 + Math.random() * 900000);
    const nowStr = new Date().toLocaleString();

    const newOrder: Order = {
      id: orderId,
      orderNumber,
      customer,
      items: orderItems,
      subtotal: this.cartService.subtotal(),
      deliveryCharge: this.cartService.deliveryFee(),
      discount: this.cartService.discountAmount(),
      totalAmount: this.cartService.finalTotal(),
      placedByRole: isOwner ? 'shopowner' : 'user',
      shopOwnerId: session?.shopOwnerId,
      shopName: session?.shopName,
      status: 'Order Placed',
      createdAt: nowStr,
      updatedAt: nowStr,
      statusHistory: [
        {
          status: 'Order Placed',
          timestamp: nowStr,
          note: `Order placed by ${isOwner ? 'shop owner (' + (session?.shopName || 'Wholesale') + ')' : customer.name}`,
          updatedBy: isOwner ? 'Shop Owner' : 'Customer'
        }
      ],
      ownerNotifiedViaEmail: false
    };

    // Dispatch email notification to owner
    const emailResult = await this.emailService.sendOrderNotification(newOrder);
    newOrder.ownerNotifiedViaEmail = emailResult.success;

    // Dispatch to Supabase PostgreSQL ledger
    try {
      const supaResult = await this.supabaseService.submitOrder({
        customerName: customer.name,
        customerPhone: customer.phone,
        customerEmail: customer.email,
        deliveryAddress: customer.address,
        pincode: customer.pincode,
        subtotal: this.cartService.subtotal(),
        deliveryFee: this.cartService.deliveryFee(),
        discountAmount: this.cartService.discountAmount(),
        totalAmount: this.cartService.finalTotal(),
        items: cartItems.map(item => ({
          productId: item.product.id,
          name: item.product.name,
          brand: item.product.brand,
          price: item.selectedPrice,
          quantity: item.quantity,
          thumbnailUrl: item.product.image
        }))
      });
      if (supaResult?.orderNumber) {
        newOrder.orderNumber = supaResult.orderNumber;
      }
    } catch (supaErr: any) {
      this.logger.warn('OrderService', 'Supabase order ledger sync notice: ' + (supaErr?.message || supaErr));
    }

    // Save to orders list in signal, localStorage, and IndexedDB
    this._orders.update(list => {
      const updated = [newOrder, ...list];
      try {
        localStorage.setItem(ORDERS_STORAGE_KEY, JSON.stringify(updated));
      } catch {
        // Quota
      }
      return updated;
    });

    // Asynchronously save to IndexedDB
    await this.idbService.saveOrder(newOrder);

    this._lastPlacedOrder.set(newOrder);
    this.cartService.clearCart();

    this.logger.info('OrderService', `Order #${newOrder.orderNumber} placed (₹${newOrder.totalAmount})`, {
      orderId: newOrder.id,
      customer: newOrder.customer.name,
      itemsCount: newOrder.items.length
    });

    return { success: true, order: newOrder };
  }

  /**
   * Submit mobile repair service booking
   */
  async bookRepairService(bookingData: {
    serviceId: string;
    serviceName: string;
    customIssueTitle?: string;
    deviceModel: string;
    issueDescription: string;
    customerName: string;
    customerPhone: string;
    customerEmail?: string;
    customerAddress: string;
    preferredDate: string;
    preferredTimeSlot: string;
    estimatedPrice: number;
    pincode?: string;
    distanceKm?: number;
    pickupEligible?: boolean;
    fulfillmentMode: ServiceFulfillmentMode;
  }): Promise<{ success: boolean; booking?: ServiceBookingRequest; message?: string }> {
    if (!bookingData.customerName?.trim() || !bookingData.customerPhone?.trim() || !bookingData.customerAddress?.trim()) {
      return { success: false, message: 'Name, Phone number, and Address are required for service booking.' };
    }

    const nowStr = new Date().toLocaleString();
    const session = this.authService.currentSession();
    const isOwner = this.authService.isShopOwner();

    const booking: ServiceBookingRequest = {
      id: 'SRV-' + Math.floor(100000 + Math.random() * 900000),
      ...bookingData,
      placedByRole: isOwner ? 'shopowner' : 'user',
      shopOwnerId: session?.shopOwnerId,
      shopName: session?.shopName,
      status: 'Pending',
      createdAt: nowStr,
      updatedAt: nowStr,
      statusHistory: [
        {
          status: 'Pending',
          timestamp: nowStr,
          note: `Repair requested for ${bookingData.deviceModel} (${bookingData.serviceName}) by ${isOwner ? 'Shop Partner (' + (session?.shopName || 'Wholesale') + ')' : bookingData.customerName}`,
          updatedBy: isOwner ? 'Shop Owner' : 'Customer'
        }
      ]
    };

    // Send email notification to owner (Standard vs Custom Issue)
    const isCustom = bookingData.serviceId === 'srv-custom' ||
      bookingData.serviceId === 'custom-service' ||
      !!bookingData.customIssueTitle ||
      bookingData.serviceName.toLowerCase().includes('custom');

    if (isCustom) {
      await this.emailService.sendCustomIssueNotification({
        ...booking,
        customIssueTitle: bookingData.customIssueTitle || bookingData.serviceName
      });
    } else {
      await this.emailService.sendServiceBookingNotification(booking);
    }

    this._bookings.update(list => {
      const updated = [booking, ...list];
      try {
        localStorage.setItem(BOOKINGS_STORAGE_KEY, JSON.stringify(updated));
      } catch {
        // Quota
      }
      return updated;
    });

    // Save to IndexedDB
    await this.idbService.saveBooking(booking);

    this._lastPlacedBooking.set(booking);

    this.logger.info('OrderService', `Repair Booking #${booking.id} created: ${booking.serviceName}`, {
      bookingId: booking.id,
      customer: booking.customerName,
      device: booking.deviceModel
    });

    return { success: true, booking };
  }

  updateOrderStatus(orderId: string, status: Order['status'], note?: string, updatedBy: string = 'Admin'): void {
    const timestamp = new Date().toLocaleString();
    let updatedOrderObj: Order | undefined;

    this._orders.update(list => {
      const updated = list.map(ord => {
        if (ord.id === orderId) {
          const currentHistory = ord.statusHistory || [
            { status: ord.status, timestamp: ord.createdAt, note: 'Initial placement' }
          ];
          updatedOrderObj = {
            ...ord,
            status,
            updatedAt: timestamp,
            statusHistory: [
              ...currentHistory,
              { status, timestamp, note: note || `Status updated to ${status}`, updatedBy }
            ]
          };
          return updatedOrderObj;
        }
        return ord;
      });
      try {
        localStorage.setItem(ORDERS_STORAGE_KEY, JSON.stringify(updated));
      } catch {
        // Quota
      }
      return updated;
    });

    if (updatedOrderObj) {
      this.idbService.saveOrder(updatedOrderObj);
      this.supabaseService.updateOrderStatus(orderId, status).catch(err => {
        this.logger.warn('OrderService', 'Supabase status sync notice: ' + (err?.message || err));
      });
    }

    this.logger.info('OrderService', `Order #${orderId} status updated to '${status}'`, { orderId, status, updatedBy });
  }

  updateBookingStatus(bookingId: string, status: ServiceBookingRequest['status'], note?: string, updatedBy: string = 'Admin'): void {
    const timestamp = new Date().toLocaleString();
    let updatedBookingObj: ServiceBookingRequest | undefined;

    this._bookings.update(list => {
      const updated = list.map(b => {
        if (b.id === bookingId) {
          const currentHistory = b.statusHistory || [
            { status: b.status, timestamp: b.createdAt, note: 'Initial booking' }
          ];
          updatedBookingObj = {
            ...b,
            status,
            updatedAt: timestamp,
            statusHistory: [
              ...currentHistory,
              { status, timestamp, note: note || `Status updated to ${status}`, updatedBy }
            ]
          };
          return updatedBookingObj;
        }
        return b;
      });
      try {
        localStorage.setItem(BOOKINGS_STORAGE_KEY, JSON.stringify(updated));
      } catch {
        // Quota
      }
      return updated;
    });

    if (updatedBookingObj) {
      this.idbService.saveBooking(updatedBookingObj);
    }

    this.logger.info('OrderService', `Repair Booking #${bookingId} status updated to '${status}'`, { bookingId, status, updatedBy });
  }

  exportOrdersJson(): void {
    this.downloadJson(`orders-${new Date().toISOString().slice(0, 10)}.json`, this._orders());
  }

  exportBookingsJson(): void {
    this.downloadJson(`bookings-${new Date().toISOString().slice(0, 10)}.json`, this._bookings());
  }

  getLastBackupYear(): number | null {
    const saved = localStorage.getItem('hitech_orders_last_backup_year');
    if (!saved) return null;
    const year = Number(saved);
    return Number.isFinite(year) ? year : null;
  }

  markBackupYear(year: number): void {
    localStorage.setItem('hitech_orders_last_backup_year', String(year));
  }

  shouldAutoArchive(currentYear = new Date().getFullYear()): boolean {
    const last = this.getLastBackupYear();
    if (last == null) {
      this.markBackupYear(currentYear);
      return false;
    }
    return last < currentYear && (this._orders().length > 0 || this._bookings().length > 0);
  }

  async archiveYearAndClear(options: { download: boolean; year?: number } = { download: true }): Promise<{
    year: number;
    orderCount: number;
    bookingCount: number;
    payload: { year: number; archivedAt: string; orders: Order[]; bookings: ServiceBookingRequest[] };
  }> {
    const year = options.year ?? (new Date().getFullYear() - 1);
    const payload = {
      year,
      archivedAt: new Date().toISOString(),
      orders: this._orders(),
      bookings: this._bookings()
    };

    if (options.download) {
      this.downloadJson(`hitech-order-archive-${year}.json`, payload);
    }

    this._orders.set([]);
    this._bookings.set([]);
    try {
      localStorage.removeItem(ORDERS_STORAGE_KEY);
      localStorage.removeItem(BOOKINGS_STORAGE_KEY);
    } catch {
      // Ignore
    }
    await this.idbService.clearStores();
    this.markBackupYear(new Date().getFullYear());

    return {
      year,
      orderCount: payload.orders.length,
      bookingCount: payload.bookings.length,
      payload
    };
  }

  private downloadJson(filename: string, data: unknown): void {
    const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' });
    const url = window.URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = filename;
    a.click();
    window.URL.revokeObjectURL(url);
  }
}
