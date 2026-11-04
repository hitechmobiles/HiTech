import { Injectable } from '@angular/core';
import { Order } from '../models/order.model';
import { ServiceBookingRequest } from '../models/service.model';

const DB_NAME = 'HiTechDB';
const DB_VERSION = 1;
const STORE_ORDERS = 'orders';
const STORE_BOOKINGS = 'bookings';

@Injectable({
  providedIn: 'root'
})
export class IndexedDbService {
  private dbPromise: Promise<IDBDatabase> | null = null;

  private isAvailable(): boolean {
    return typeof window !== 'undefined' && !!window.indexedDB;
  }

  private getDb(): Promise<IDBDatabase> {
    if (!this.isAvailable()) {
      return Promise.reject(new Error('IndexedDB not supported in current environment'));
    }

    if (this.dbPromise) {
      return this.dbPromise;
    }

    this.dbPromise = new Promise((resolve, reject) => {
      const request = window.indexedDB.open(DB_NAME, DB_VERSION);

      request.onupgradeneeded = (event: IDBVersionChangeEvent) => {
        const db = (event.target as IDBOpenDBRequest).result;
        if (!db.objectStoreNames.contains(STORE_ORDERS)) {
          db.createObjectStore(STORE_ORDERS, { keyPath: 'id' });
        }
        if (!db.objectStoreNames.contains(STORE_BOOKINGS)) {
          db.createObjectStore(STORE_BOOKINGS, { keyPath: 'id' });
        }
      };

      request.onsuccess = () => resolve(request.result);
      request.onerror = () => {
        this.dbPromise = null;
        reject(request.error);
      };
    });

    return this.dbPromise;
  }

  // --- Orders Store Operations ---

  async getAllOrders(): Promise<Order[]> {
    if (!this.isAvailable()) return [];
    try {
      const db = await this.getDb();
      return new Promise<Order[]>((resolve, reject) => {
        const transaction = db.transaction(STORE_ORDERS, 'readonly');
        const store = transaction.objectStore(STORE_ORDERS);
        const req = store.getAll();
        req.onsuccess = () => resolve(req.result || []);
        req.onerror = () => reject(req.error);
      });
    } catch {
      return [];
    }
  }

  async saveOrder(order: Order): Promise<void> {
    if (!this.isAvailable() || !order.id) return;
    try {
      const db = await this.getDb();
      return new Promise<void>((resolve, reject) => {
        const transaction = db.transaction(STORE_ORDERS, 'readwrite');
        const store = transaction.objectStore(STORE_ORDERS);
        const req = store.put(order);
        req.onsuccess = () => resolve();
        req.onerror = () => reject(req.error);
      });
    } catch {
      // Fallback handled by parent OrderService
    }
  }

  async saveAllOrders(orders: Order[]): Promise<void> {
    if (!this.isAvailable() || !orders.length) return;
    try {
      const db = await this.getDb();
      return new Promise<void>((resolve, reject) => {
        const transaction = db.transaction(STORE_ORDERS, 'readwrite');
        const store = transaction.objectStore(STORE_ORDERS);
        for (const order of orders) {
          if (order.id) store.put(order);
        }
        transaction.oncomplete = () => resolve();
        transaction.onerror = () => reject(transaction.error);
      });
    } catch {
      // Graceful degradation
    }
  }

  async deleteOrder(id: string): Promise<void> {
    if (!this.isAvailable()) return;
    try {
      const db = await this.getDb();
      return new Promise<void>((resolve, reject) => {
        const transaction = db.transaction(STORE_ORDERS, 'readwrite');
        const store = transaction.objectStore(STORE_ORDERS);
        const req = store.delete(id);
        req.onsuccess = () => resolve();
        req.onerror = () => reject(req.error);
      });
    } catch {
      // Ignore
    }
  }

  // --- Service Bookings Store Operations ---

  async getAllBookings(): Promise<ServiceBookingRequest[]> {
    if (!this.isAvailable()) return [];
    try {
      const db = await this.getDb();
      return new Promise<ServiceBookingRequest[]>((resolve, reject) => {
        const transaction = db.transaction(STORE_BOOKINGS, 'readonly');
        const store = transaction.objectStore(STORE_BOOKINGS);
        const req = store.getAll();
        req.onsuccess = () => resolve(req.result || []);
        req.onerror = () => reject(req.error);
      });
    } catch {
      return [];
    }
  }

  async saveBooking(booking: ServiceBookingRequest): Promise<void> {
    if (!this.isAvailable() || !booking.id) return;
    try {
      const db = await this.getDb();
      return new Promise<void>((resolve, reject) => {
        const transaction = db.transaction(STORE_BOOKINGS, 'readwrite');
        const store = transaction.objectStore(STORE_BOOKINGS);
        const req = store.put(booking);
        req.onsuccess = () => resolve();
        req.onerror = () => reject(req.error);
      });
    } catch {
      // Fallback handled by parent OrderService
    }
  }

  async saveAllBookings(bookings: ServiceBookingRequest[]): Promise<void> {
    if (!this.isAvailable() || !bookings.length) return;
    try {
      const db = await this.getDb();
      return new Promise<void>((resolve, reject) => {
        const transaction = db.transaction(STORE_BOOKINGS, 'readwrite');
        const store = transaction.objectStore(STORE_BOOKINGS);
        for (const booking of bookings) {
          if (booking.id) store.put(booking);
        }
        transaction.oncomplete = () => resolve();
        transaction.onerror = () => reject(transaction.error);
      });
    } catch {
      // Graceful degradation
    }
  }

  async deleteBooking(id: string): Promise<void> {
    if (!this.isAvailable()) return;
    try {
      const db = await this.getDb();
      return new Promise<void>((resolve, reject) => {
        const transaction = db.transaction(STORE_BOOKINGS, 'readwrite');
        const store = transaction.objectStore(STORE_BOOKINGS);
        const req = store.delete(id);
        req.onsuccess = () => resolve();
        req.onerror = () => reject(req.error);
      });
    } catch {
      // Ignore
    }
  }

  async clearStores(): Promise<void> {
    if (!this.isAvailable()) return;
    try {
      const db = await this.getDb();
      return new Promise<void>((resolve, reject) => {
        const transaction = db.transaction([STORE_ORDERS, STORE_BOOKINGS], 'readwrite');
        transaction.objectStore(STORE_ORDERS).clear();
        transaction.objectStore(STORE_BOOKINGS).clear();
        transaction.oncomplete = () => resolve();
        transaction.onerror = () => reject(transaction.error);
      });
    } catch {
      // Ignore
    }
  }
}
