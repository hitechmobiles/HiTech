import { Injectable, inject, signal } from '@angular/core';
import emailjs from '@emailjs/browser';
import { environment } from '../../../environments/environment';
import { Order } from '../models/order.model';
import { ServiceBookingRequest } from '../models/service.model';
import { LoggerService } from './logger.service';

export interface EmailLogEntry {
  id: string;
  type: 'ORDER_NOTIFICATION' | 'SERVICE_BOOKING';
  recipient: string;
  subject: string;
  payload: any;
  sentAt: string;
  status: 'SENT_VIA_RESEND' | 'SENT_VIA_EMAILJS' | 'SIMULATED_LOCAL';
}

const EMAIL_LOGS_KEY = 'hitech_email_logs';

@Injectable({
  providedIn: 'root'
})
export class EmailService {
  private logger = inject(LoggerService);
  private _logs = signal<EmailLogEntry[]>(this.loadLogs());
  readonly logs = this._logs.asReadonly();

  /**
   * Reads configuration directly from environment
   */
  private getEmailJsConfig() {
    return environment.emailJs;
  }

  private getResendConfig() {
    return (environment as any).resend || {
      apiEndpoint: '/api/send-email',
      notificationEmail: 'bhuvaneshwaranaj@gmail.com'
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
      localStorage.setItem(EMAIL_LOGS_KEY, JSON.stringify(updated));
      return updated;
    });
  }

  /**
   * Attempt dispatch via Vercel Resend Serverless endpoint
   */
  private async sendViaResend(
    type: 'ORDER_NOTIFICATION' | 'SERVICE_BOOKING',
    recipient: string,
    subject: string,
    templateParams: any
  ): Promise<{ success: boolean; simulated: boolean }> {
    const resendConfig = this.getResendConfig();
    const endpoint = resendConfig.apiEndpoint || '/api/send-email';

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

      if (!response.ok) {
        throw new Error(`Resend endpoint returned status ${response.status}`);
      }

      const result = await response.json();
      if (result.success && !result.simulated) {
        return { success: true, simulated: false };
      }
      if (result.simulated) {
        this.logger.info('EmailService', 'Resend simulated email response (API key not set in environment).');
      }
      return { success: false, simulated: true };
    } catch (err: any) {
      this.logger.warn('EmailService', `Resend dispatch failed or unavailable at ${endpoint}: ${err?.message || err}.`);
      return { success: false, simulated: true };
    }
  }

  /**
   * Send Order Details to the Shop Owner's email
   */
  async sendOrderNotification(order: Order): Promise<{ success: boolean; simulated: boolean }> {
    const emailJsConfig = this.getEmailJsConfig();
    const resendConfig = this.getResendConfig();
    const ownerEmail = resendConfig.notificationEmail || emailJsConfig.notificationEmail || 'bhuvaneshwaranaj@gmail.com';

    const itemsSummary = order.items
      .map(i => `${i.name} (x${i.quantity}) - ₹${i.totalPrice.toLocaleString()}`)
      .join('\n');

    const templateParams = {
      to_email: ownerEmail,
      order_number: order.orderNumber,
      customer_name: order.customer.name,
      customer_phone: order.customer.phone,
      delivery_address: order.customer.address + (order.customer.pincode ? ` - Pincode: ${order.customer.pincode}` : ''),
      customer_email: order.customer.email || 'N/A',
      items_summary: itemsSummary,
      subtotal: `₹${order.subtotal.toLocaleString()}`,
      delivery_fee: `₹${order.deliveryCharge}`,
      discount: `₹${order.discount.toLocaleString()}`,
      total_amount: `₹${order.totalAmount.toLocaleString()}`,
      order_type: order.placedByRole === 'shopowner' ? `Shop Owner Bulk Order (${order.shopName || ''})` : 'Customer Retail Order',
      order_date: new Date().toLocaleString()
    };

    const subject = `New Order Placed: #${order.orderNumber} - ${order.customer.name}`;

    // 1. Try sending via Resend Serverless API
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

    // 2. Fallback to EmailJS if configured
    const isEmailJsConfigured = !!emailJsConfig.publicKey && emailJsConfig.publicKey !== 'YOUR_EMAILJS_PUBLIC_KEY';
    if (isEmailJsConfigured) {
      try {
        await emailjs.send(
          emailJsConfig.serviceId,
          emailJsConfig.orderTemplateId,
          templateParams,
          emailJsConfig.publicKey
        );
        this.addLog({
          type: 'ORDER_NOTIFICATION',
          recipient: ownerEmail,
          subject,
          payload: templateParams,
          status: 'SENT_VIA_EMAILJS'
        });
        this.logger.info('EmailService', `Order notification sent via EmailJS to ${ownerEmail} for order #${order.orderNumber}`);
        return { success: true, simulated: false };
      } catch (err: any) {
        this.logger.warn('EmailService', `EmailJS dispatch failed for order #${order.orderNumber}: ${err?.text || err?.message || err}. Falling back to simulation.`, err);
      }
    }

    // 3. Simulated Local Fallback
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
   * Send Service Booking to Shop Owner
   */
  async sendServiceBookingNotification(booking: ServiceBookingRequest): Promise<{ success: boolean; simulated: boolean }> {
    const emailJsConfig = this.getEmailJsConfig();
    const resendConfig = this.getResendConfig();
    const ownerEmail = resendConfig.notificationEmail || emailJsConfig.notificationEmail || 'bhuvaneshwaranaj@gmail.com';

    const templateParams = {
      to_email: ownerEmail,
      booking_id: booking.id,
      service_name: booking.serviceName,
      device_model: booking.deviceModel,
      issue_description: booking.issueDescription,
      customer_name: booking.customerName,
      customer_phone: booking.customerPhone,
      customer_address: booking.customerAddress,
      preferred_slot: `${booking.preferredDate} (${booking.preferredTimeSlot})`,
      estimated_price: `₹${booking.estimatedPrice.toLocaleString()}`,
      fulfillment_mode: booking.fulfillmentMode,
      distance_km: booking.distanceKm != null ? `${booking.distanceKm} km` : 'Unknown',
      pincode: booking.pincode || 'N/A',
      booking_date: new Date().toLocaleDateString('en-IN')
    };

    const subject = `Service Appointment: ${booking.serviceName} - ${booking.customerName}`;

    // 1. Try sending via Resend Serverless API
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

    // 2. Fallback to EmailJS if configured
    const isEmailJsConfigured = !!emailJsConfig.publicKey && emailJsConfig.publicKey !== 'YOUR_EMAILJS_PUBLIC_KEY';
    if (isEmailJsConfigured) {
      try {
        const templateId = (emailJsConfig as any).serviceBookingTemplateId || emailJsConfig.orderTemplateId;
        await emailjs.send(
          emailJsConfig.serviceId,
          templateId,
          templateParams,
          emailJsConfig.publicKey
        );
        this.addLog({
          type: 'SERVICE_BOOKING',
          recipient: ownerEmail,
          subject,
          payload: templateParams,
          status: 'SENT_VIA_EMAILJS'
        });
        this.logger.info('EmailService', `Service booking email sent via EmailJS to ${ownerEmail} for booking #${booking.id}`);
        return { success: true, simulated: false };
      } catch (err: any) {
        this.logger.warn('EmailService', `EmailJS dispatch failed for booking #${booking.id}: ${err?.text || err?.message || err}. Falling back to simulation.`, err);
      }
    }

    // 3. Simulated Local Fallback
    this.addLog({
      type: 'SERVICE_BOOKING',
      recipient: ownerEmail,
      subject: `Service Appointment: ${booking.serviceName} (${booking.deviceModel})`,
      payload: templateParams,
      status: 'SIMULATED_LOCAL'
    });

    return { success: true, simulated: true };
  }
}
