import { TestBed } from '@angular/core/testing';
import { EmailService } from './email.service';
import { Order } from '../models/order.model';
import { ServiceBookingRequest } from '../models/service.model';

describe('EmailService', () => {
  let service: EmailService;

  beforeEach(() => {
    localStorage.clear();
    spyOn(window, 'fetch').and.rejectWith(new Error('Endpoint not available'));

    TestBed.configureTestingModule({
      providers: [EmailService]
    });
    service = TestBed.inject(EmailService);
  });

  afterEach(() => {
    localStorage.clear();
  });

  it('should be created', () => {
    expect(service).toBeTruthy();
  });

  it('should send order notification via Resend when serverless endpoint succeeds', async () => {
    (window.fetch as jasmine.Spy).and.resolveTo({
      ok: true,
      json: async () => ({ success: true, id: 'resend_123', simulated: false })
    } as any);

    const mockOrder: Order = {
      id: 'ord-resend-1',
      orderNumber: 'ORD-RESEND-1',
      items: [],
      customer: { name: 'Resend User', phone: '1234567890', address: 'Test Addr', email: 'customer@example.com' },
      subtotal: 1500,
      deliveryCharge: 0,
      discount: 0,
      totalAmount: 1500,
      placedByRole: 'user',
      createdAt: '2026-01-01',
      status: 'Confirmed',
      ownerNotifiedViaEmail: false
    };

    const result = await service.sendOrderNotification(mockOrder);
    expect(result.success).toBeTrue();
    expect(result.simulated).toBeFalse();
    expect(service.logs()[0].status).toBe('SENT_VIA_RESEND');
  });

  it('should fallback to simulation when Resend endpoint fails on order notification', async () => {
    (window.fetch as jasmine.Spy).and.rejectWith(new Error('Network error'));

    const mockOrder: Order = {
      id: 'ord-shop-1',
      orderNumber: 'ORD-SHOP-1',
      items: [],
      customer: { name: 'Owner', phone: '1234567890', address: 'Shop Address' },
      subtotal: 10000,
      deliveryCharge: 0,
      discount: 1000,
      totalAmount: 9000,
      placedByRole: 'shopowner',
      shopName: 'Owner Electronics',
      createdAt: '2026-01-01',
      status: 'Confirmed',
      ownerNotifiedViaEmail: false
    };

    const result = await service.sendOrderNotification(mockOrder);
    expect(result.success).toBeTrue();
    expect(result.simulated).toBeTrue();
    expect(service.logs()[0].status).toBe('SIMULATED_LOCAL');
  });

  it('should send service booking notification via Resend when serverless endpoint succeeds', async () => {
    (window.fetch as jasmine.Spy).and.resolveTo({
      ok: true,
      json: async () => ({ success: true, id: 'resend_456', simulated: false })
    } as any);

    const mockBooking: ServiceBookingRequest = {
      id: 'srv-book-1',
      serviceId: 'srv-1',
      serviceName: 'Display Replacement',
      deviceModel: 'Pixel 8 Pro',
      issueDescription: 'Cracked screen',
      customerName: 'Alice',
      customerPhone: '9988776655',
      customerEmail: 'alice@example.com',
      customerAddress: '45 Avenue',
      pincode: '600002',
      distanceKm: 12,
      pickupEligible: true,
      fulfillmentMode: 'home_pickup',
      preferredDate: '2026-04-01',
      preferredTimeSlot: '10:00 AM',
      estimatedPrice: 3500,
      status: 'Pending',
      createdAt: '2026-01-01'
    };

    const result = await service.sendServiceBookingNotification(mockBooking);
    expect(result.success).toBeTrue();
    expect(result.simulated).toBeFalse();
    expect(service.logs()[0].type).toBe('SERVICE_BOOKING');
    expect(service.logs()[0].status).toBe('SENT_VIA_RESEND');
  });

  it('should fallback to simulation when Resend endpoint fails on service booking', async () => {
    (window.fetch as jasmine.Spy).and.rejectWith(new Error('Quota exceeded'));

    const mockBooking: ServiceBookingRequest = {
      id: 'srv-book-2',
      serviceId: 'srv-2',
      serviceName: 'Battery Replacement',
      deviceModel: 'iPhone 13',
      issueDescription: 'Battery drain',
      customerName: 'Bob',
      customerPhone: '9876543210',
      customerAddress: '10 Main Road',
      fulfillmentMode: 'store_handover',
      preferredDate: '2026-04-02',
      preferredTimeSlot: '02:00 PM',
      estimatedPrice: 2500,
      status: 'Pending',
      createdAt: '2026-01-01'
    };

    const result = await service.sendServiceBookingNotification(mockBooking);
    expect(result.success).toBeTrue();
    expect(result.simulated).toBeTrue();
    expect(service.logs()[0].status).toBe('SIMULATED_LOCAL');
  });

  it('should load pre-existing logs from localStorage', () => {
    const preExisting = [{
      id: 'log-old',
      type: 'ORDER_NOTIFICATION' as const,
      recipient: 'old@test.com',
      subject: 'Old Order',
      payload: {},
      sentAt: '2026-01-01',
      status: 'SIMULATED_LOCAL' as const
    }];
    localStorage.setItem('hitech_email_logs', JSON.stringify(preExisting));

    TestBed.resetTestingModule();
    TestBed.configureTestingModule({
      providers: [EmailService]
    });
    const newService = TestBed.inject(EmailService);
    expect(newService.logs().length).toBe(1);
    expect(newService.logs()[0].id).toBe('log-old');
  });
});
