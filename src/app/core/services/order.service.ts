import { Injectable, signal, computed, inject } from '@angular/core';
import { CustomerDetails, Order, OrderItemRecord } from '../models/order.model';
import { ServiceBookingRequest, ServiceFulfillmentMode } from '../models/service.model';
import { CartService } from './cart.service';
import { EmailService } from './email.service';
import { AuthService } from './auth.service';
import { CatalogPublishService } from './catalog-publish.service';
import { LoggerService } from './logger.service';

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

  private _orders = signal<Order[]>(this.loadOrders());
  private _bookings = signal<ServiceBookingRequest[]>(this.loadBookings());
  private _lastPlacedOrder = signal<Order | null>(null);
  private _lastPlacedBooking = signal<ServiceBookingRequest | null>(null);

  readonly orders = this._orders.asReadonly();
  readonly bookings = this._bookings.asReadonly();
  readonly lastPlacedOrder = this._lastPlacedOrder.asReadonly();
  readonly lastPlacedBooking = this._lastPlacedBooking.asReadonly();

  readonly totalOrdersCount = computed(() => this._orders().length);
  readonly totalBookingsCount = computed(() => this._bookings().length);

  private loadOrders(): Order[] {
    try {
      const saved = localStorage.getItem(ORDERS_STORAGE_KEY);
      return saved ? JSON.parse(saved) : [];
    } catch {
      return [];
    }
  }

  private loadBookings(): ServiceBookingRequest[] {
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

    // Save to orders list in signal and localStorage
    this._orders.update(list => {
      const updated = [newOrder, ...list];
      localStorage.setItem(ORDERS_STORAGE_KEY, JSON.stringify(updated));
      return updated;
    });

    this._lastPlacedOrder.set(newOrder);
    this.cartService.clearCart();

    this.logger.info('OrderService', `Order #${newOrder.orderNumber} placed (₹${newOrder.totalAmount})`, {
      orderId: newOrder.id,
      customer: newOrder.customer.name,
      itemsCount: newOrder.items.length
    });

    // Note: Automatic pipeline dispatch removed as per midnight 1:00 AM scheduler requirement.
    // Manual publish via admin dashboard remains available.
    return { success: true, order: newOrder };
  }

  /**
   * Submit mobile repair service booking
   */
  async bookRepairService(bookingData: {
    serviceId: string;
    serviceName: string;
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
    const booking: ServiceBookingRequest = {
      id: 'SRV-' + Math.floor(100000 + Math.random() * 900000),
      ...bookingData,
      status: 'Pending',
      createdAt: nowStr,
      updatedAt: nowStr,
      statusHistory: [
        {
          status: 'Pending',
          timestamp: nowStr,
          note: `Repair requested for ${bookingData.deviceModel} (${bookingData.serviceName})`,
          updatedBy: 'Customer'
        }
      ]
    };

    // Send email notification to owner (Standard vs Custom Issue)
    if (bookingData.serviceId === 'srv-custom' || bookingData.serviceName.startsWith('Custom Repair')) {
      await this.emailService.sendCustomIssueNotification({
        ...booking,
        customIssueTitle: bookingData.serviceName
      });
    } else {
      await this.emailService.sendServiceBookingNotification(booking);
    }

    this._bookings.update(list => {
      const updated = [booking, ...list];
      localStorage.setItem(BOOKINGS_STORAGE_KEY, JSON.stringify(updated));
      return updated;
    });

    this._lastPlacedBooking.set(booking);

    this.logger.info('OrderService', `Repair Booking #${booking.id} created: ${booking.serviceName}`, {
      bookingId: booking.id,
      customer: booking.customerName,
      device: booking.deviceModel
    });

    // Note: Automatic pipeline dispatch removed as per midnight 1:00 AM scheduler requirement.
    // Manual publish via admin dashboard remains available.
    return { success: true, booking };
  }

  updateOrderStatus(orderId: string, status: Order['status'], note?: string, updatedBy: string = 'Admin'): void {
    const timestamp = new Date().toLocaleString();
    this._orders.update(list => {
      const updated = list.map(ord => {
        if (ord.id === orderId) {
          const currentHistory = ord.statusHistory || [
            { status: ord.status, timestamp: ord.createdAt, note: 'Initial placement' }
          ];
          return {
            ...ord,
            status,
            updatedAt: timestamp,
            statusHistory: [
              ...currentHistory,
              { status, timestamp, note: note || `Status updated to ${status}`, updatedBy }
            ]
          };
        }
        return ord;
      });
      localStorage.setItem(ORDERS_STORAGE_KEY, JSON.stringify(updated));
      return updated;
    });
    this.logger.info('OrderService', `Order #${orderId} status updated to '${status}'`, { orderId, status, updatedBy });
  }

  updateBookingStatus(bookingId: string, status: ServiceBookingRequest['status'], note?: string, updatedBy: string = 'Admin'): void {
    const timestamp = new Date().toLocaleString();
    this._bookings.update(list => {
      const updated = list.map(b => {
        if (b.id === bookingId) {
          const currentHistory = b.statusHistory || [
            { status: b.status, timestamp: b.createdAt, note: 'Initial booking' }
          ];
          return {
            ...b,
            status,
            updatedAt: timestamp,
            statusHistory: [
              ...currentHistory,
              { status, timestamp, note: note || `Status updated to ${status}`, updatedBy }
            ]
          };
        }
        return b;
      });
      localStorage.setItem(BOOKINGS_STORAGE_KEY, JSON.stringify(updated));
      return updated;
    });
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
    localStorage.removeItem(ORDERS_STORAGE_KEY);
    localStorage.removeItem(BOOKINGS_STORAGE_KEY);
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
