import { Injectable, inject, signal } from '@angular/core';
import { environment } from '../../../environments/environment';
import { Order } from '../models/order.model';
import { ServiceBookingRequest } from '../models/service.model';
import { LoggerService } from './logger.service';

export interface EmailLogEntry {
  id: string;
  type: 'ORDER_NOTIFICATION' | 'SERVICE_BOOKING' | 'PRODUCT_SEARCH_REQUEST' | 'CUSTOM_SERVICE_ISSUE';
  recipient: string;
  subject: string;
  payload: any;
  sentAt: string;
  status: 'SENT_VIA_RESEND' | 'SIMULATED_LOCAL';
}

const EMAIL_LOGS_KEY = 'hitech_email_logs';

@Injectable({
  providedIn: 'root'
})
export class EmailService {
  private logger = inject(LoggerService);
  private _logs = signal<EmailLogEntry[]>(this.loadLogs());
  readonly logs = this._logs.asReadonly();

  private getResendConfig() {
    return (environment as any).resend || {
      apiEndpoint: '/api/send-email',
      apiKey: '',
      notificationEmail: 'hitechmobilesandservice@gmail.com'
    };
  }

  private loadLogs(): EmailLogEntry[] {
    try {
      const saved = localStorage.getItem(EMAIL_LOGS_KEY);
      return saved ? JSON.parse(saved) : [];
    } catch {
      return [];
    }
  }

  private addLog(entry: Omit<EmailLogEntry, 'id' | 'sentAt'>): void {
    const newLog: EmailLogEntry = {
      ...entry,
      id: 'log-' + Date.now(),
      sentAt: new Date().toLocaleString()
    };
    this._logs.update(list => {
      const updated = [newLog, ...list.slice(0, 49)];
      try {
        localStorage.setItem(EMAIL_LOGS_KEY, JSON.stringify(updated));
      } catch (err) {
        this.logger.warn('EmailService', 'Failed to persist email logs to localStorage', err);
      }
      return updated;
    });
  }

  private formatEmailHtml(type: string, subject: string, p: any): string {
    return `<!DOCTYPE html><html><body style="font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,sans-serif;background:#0b1120;padding:24px;color:#e2e8f0;">
      <div style="max-width:600px;margin:auto;background:#1e293b;border-radius:14px;border:1px solid #334155;overflow:hidden;box-shadow:0 10px 25px rgba(0,0,0,0.5);">
        <div style="background:linear-gradient(135deg,#1a8fe3,#38bdf8);padding:24px;text-align:center;color:#ffffff;">
          <h2 style="margin:0;font-size:20px;">${subject}</h2>
        </div>
        <div style="padding:24px;">
          <div style="background:#0f172a;border:1px solid #334155;border-radius:10px;padding:16px;margin-bottom:16px;">
            ${Object.entries(p).map(([k, v]) => `<p style="margin:6px 0;font-size:14px;"><strong style="color:#94a3b8;">${k.replace(/_/g, ' ').toUpperCase()}:</strong> <span style="color:#f8fafc;">${v}</span></p>`).join('')}
          </div>
          <p style="color:#64748b;font-size:12px;margin:0;text-align:center;">HiTech Mobiles & Repair Care Hub &bull; Notification Service</p>
        </div>
      </div></body></html>`;
  }

  /**
   * Attempt dispatch via Vercel Resend Serverless endpoint with direct Resend fallback
   */
  private async sendViaResend(
    type: 'ORDER_NOTIFICATION' | 'SERVICE_BOOKING' | 'PRODUCT_SEARCH_REQUEST' | 'CUSTOM_SERVICE_ISSUE',
    recipient: string,
    subject: string,
    templateParams: any
  ): Promise<{ success: boolean; simulated: boolean }> {
    const resendConfig = this.getResendConfig();
    const endpoint = resendConfig.apiEndpoint || '/api/send-email';

    // 1. Try Vercel Serverless Function
    try {
      const response = await fetch(endpoint, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          type,
          recipient,
          subject,
          templateParams
        })
      });

      if (response.ok) {
        const result = await response.json();
        if (result.success && !result.simulated) {
          return { success: true, simulated: false };
        }
      }
    } catch {
      // Serverless endpoint unavailable (e.g. running locally on port 4200)
    }

    // 2. Direct Resend API Fallback (runs in browser when direct client key is configured)
    const directKey = (resendConfig as any).apiKey || localStorage.getItem('hitech_resend_api_key') || '';
    const targetEmail = recipient || (resendConfig as any).notificationEmail || 'hitechmobilesandservice@gmail.com';

    try {
      const directResponse = await fetch('https://api.resend.com/emails', {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${directKey}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          from: 'HiTech <onboarding@resend.dev>',
          to: [targetEmail],
          subject,
          html: this.formatEmailHtml(type, subject, templateParams)
        })
      });

      if (directResponse.ok) {
        this.logger.info('EmailService', `Email dispatched directly via Resend to ${targetEmail}`);
        return { success: true, simulated: false };
      }
    } catch (err: any) {
      this.logger.warn('EmailService', `Direct Resend dispatch failed: ${err?.message || err}`);
    }

    return { success: false, simulated: true };
  }

  /**
   * Send Order Details to Admin & Customer via Resend
   */
  async sendOrderNotification(order: Order): Promise<{ success: boolean; simulated: boolean }> {
    const resendConfig = this.getResendConfig();
    const ownerEmail = resendConfig.notificationEmail || 'bhuvaneshwaranaj@gmail.com';

    const itemsSummary = order.items
      .map(i => `${i.name} (x${i.quantity}) - ₹${i.totalPrice.toLocaleString()}`)
      .join('\n');

    const customerEmail = order.customer.email && order.customer.email.includes('@')
      ? order.customer.email.trim()
      : '';

    const templateParams = {
      to_email: ownerEmail,
      order_number: order.orderNumber,
      customer_name: order.customer.name,
      customer_phone: order.customer.phone,
      delivery_address: order.customer.address + (order.customer.pincode ? ` - Pincode: ${order.customer.pincode}` : ''),
      customer_email: customerEmail || 'N/A',
      items_summary: itemsSummary,
      subtotal: `₹${order.subtotal.toLocaleString()}`,
      delivery_fee: `₹${order.deliveryCharge}`,
      discount: `₹${order.discount.toLocaleString()}`,
      total_amount: `₹${order.totalAmount.toLocaleString()}`,
      order_type: order.placedByRole === 'shopowner' ? `Shop Owner Bulk Order (${order.shopName || ''})` : 'Customer Retail Order',
      order_date: new Date().toLocaleString()
    };

    const subject = `New Order Placed: #${order.orderNumber} - ${order.customer.name}`;

    // 1. Dispatch via Resend Serverless API
    const resendResult = await this.sendViaResend('ORDER_NOTIFICATION', ownerEmail, subject, templateParams);
    if (resendResult.success && !resendResult.simulated) {
      this.addLog({
        type: 'ORDER_NOTIFICATION',
        recipient: ownerEmail,
        subject,
        payload: templateParams,
        status: 'SENT_VIA_RESEND'
      });
      this.logger.info('EmailService', `Order notification sent via Resend to ${ownerEmail} for order #${order.orderNumber}`);
      return { success: true, simulated: false };
    }

    // 2. Simulated Local Fallback
    this.addLog({
      type: 'ORDER_NOTIFICATION',
      recipient: ownerEmail,
      subject: `New Order: #${order.orderNumber} by ${order.customer.name}`,
      payload: templateParams,
      status: 'SIMULATED_LOCAL'
    });

    return { success: true, simulated: true };
  }

  /**
   * Send Service Booking to Admin & Customer via Resend
   */
  async sendServiceBookingNotification(booking: ServiceBookingRequest): Promise<{ success: boolean; simulated: boolean }> {
    const resendConfig = this.getResendConfig();
    const ownerEmail = resendConfig.notificationEmail || 'bhuvaneshwaranaj@gmail.com';

    const customerEmail = booking.customerEmail && booking.customerEmail.includes('@')
      ? booking.customerEmail.trim()
      : '';

    const templateParams = {
      to_email: ownerEmail,
      booking_id: booking.id,
      service_name: booking.serviceName,
      device_model: booking.deviceModel,
      issue_description: booking.issueDescription,
      customer_name: booking.customerName,
      customer_phone: booking.customerPhone,
      customer_email: customerEmail || 'N/A',
      customer_address: booking.customerAddress,
      preferred_slot: `${booking.preferredDate} (${booking.preferredTimeSlot})`,
      estimated_price: `₹${booking.estimatedPrice.toLocaleString()}`,
      fulfillment_mode: booking.fulfillmentMode,
      distance_km: booking.distanceKm != null ? `${booking.distanceKm} km` : 'Unknown',
      pincode: booking.pincode || 'N/A',
      booking_date: new Date().toLocaleDateString('en-IN')
    };

    const subject = `Service Appointment: ${booking.serviceName} - ${booking.customerName}`;

    // 1. Dispatch via Resend Serverless API
    const resendResult = await this.sendViaResend('SERVICE_BOOKING', ownerEmail, subject, templateParams);
    if (resendResult.success && !resendResult.simulated) {
      this.addLog({
        type: 'SERVICE_BOOKING',
        recipient: ownerEmail,
        subject,
        payload: templateParams,
        status: 'SENT_VIA_RESEND'
      });
      this.logger.info('EmailService', `Service booking email sent via Resend to ${ownerEmail} for booking #${booking.id}`);
      return { success: true, simulated: false };
    }

    // 2. Simulated Local Fallback
    this.addLog({
      type: 'SERVICE_BOOKING',
      recipient: ownerEmail,
      subject: `Service Appointment: ${booking.serviceName} (${booking.deviceModel})`,
      payload: templateParams,
      status: 'SIMULATED_LOCAL'
    });

    return { success: true, simulated: true };
  }

  /**
   * Send Product Search Request to Admin & Customer confirmation via Resend
   */
  async sendProductRequestNotification(requestData: {
    requestedProduct: string;
    customerName: string;
    customerPhone: string;
    customerEmail?: string;
    preferredSpecs?: string;
    customerNotes?: string;
  }): Promise<{ success: boolean; simulated: boolean }> {
    const resendConfig = this.getResendConfig();
    const ownerEmail = resendConfig.notificationEmail || 'bhuvaneshwaranaj@gmail.com';
    const requestId = 'REQ-' + Date.now().toString().slice(-6);
    const nowStr = new Date().toLocaleString();

    const customerEmail = requestData.customerEmail && requestData.customerEmail.includes('@')
      ? requestData.customerEmail.trim()
      : '';

    const templateParams = {
      to_email: ownerEmail,
      request_id: requestId,
      requested_product: requestData.requestedProduct,
      customer_name: requestData.customerName,
      customer_phone: requestData.customerPhone,
      customer_email: customerEmail || 'N/A',
      preferred_specs: requestData.preferredSpecs || 'Standard',
      customer_notes: requestData.customerNotes || 'No additional notes provided.',
      request_date: nowStr
    };

    const subject = `🔍 Customer Product Request: ${requestData.requestedProduct} - ${requestData.customerName}`;

    // 1. Dispatch via Resend Serverless API
    const resendResult = await this.sendViaResend('PRODUCT_SEARCH_REQUEST', ownerEmail, subject, templateParams);
    if (resendResult.success && !resendResult.simulated) {
      this.addLog({
        type: 'PRODUCT_SEARCH_REQUEST',
        recipient: ownerEmail,
        subject,
        payload: templateParams,
        status: 'SENT_VIA_RESEND'
      });
      this.logger.info('EmailService', `Product request email sent via Resend for ${requestData.requestedProduct}`);
      return { success: true, simulated: false };
    }

    // 2. Simulated Local Fallback
    this.addLog({
      type: 'PRODUCT_SEARCH_REQUEST',
      recipient: ownerEmail,
      subject,
      payload: templateParams,
      status: 'SIMULATED_LOCAL'
    });

    return { success: true, simulated: true };
  }

  /**
   * Send Custom Issue Service Booking to Admin & Customer confirmation via Resend
   */
  async sendCustomIssueNotification(booking: ServiceBookingRequest & { customIssueTitle?: string }): Promise<{ success: boolean; simulated: boolean }> {
    const resendConfig = this.getResendConfig();
    const ownerEmail = resendConfig.notificationEmail || 'bhuvaneshwaranaj@gmail.com';
    const nowStr = new Date().toLocaleString();

    const customerEmail = booking.customerEmail && booking.customerEmail.includes('@')
      ? booking.customerEmail.trim()
      : '';

    const templateParams = {
      to_email: ownerEmail,
      booking_id: booking.id,
      custom_issue_title: booking.customIssueTitle || booking.serviceName,
      service_name: booking.serviceName,
      device_model: booking.deviceModel,
      issue_description: booking.issueDescription,
      customer_name: booking.customerName,
      customer_phone: booking.customerPhone,
      customer_email: customerEmail || 'N/A',
      customer_address: booking.customerAddress,
      preferred_slot: `${booking.preferredDate} (${booking.preferredTimeSlot})`,
      fulfillment_mode: booking.fulfillmentMode,
      distance_km: booking.distanceKm != null ? `${booking.distanceKm} km` : 'Pending Check',
      pincode: booking.pincode || 'N/A',
      booking_date: nowStr
    };

    const subject = `🔧 Custom Repair Booking: ${booking.customIssueTitle || booking.serviceName} - ${booking.customerName}`;

    // 1. Dispatch via Resend Serverless API
    const resendResult = await this.sendViaResend('CUSTOM_SERVICE_ISSUE', ownerEmail, subject, templateParams);
    if (resendResult.success && !resendResult.simulated) {
      this.addLog({
        type: 'CUSTOM_SERVICE_ISSUE',
        recipient: ownerEmail,
        subject,
        payload: templateParams,
        status: 'SENT_VIA_RESEND'
      });
      this.logger.info('EmailService', `Custom issue email sent via Resend for booking #${booking.id}`);
      return { success: true, simulated: false };
    }

    // 2. Simulated Local Fallback
    this.addLog({
      type: 'CUSTOM_SERVICE_ISSUE',
      recipient: ownerEmail,
      subject,
      payload: templateParams,
      status: 'SIMULATED_LOCAL'
    });

    return { success: true, simulated: true };
  }
}
