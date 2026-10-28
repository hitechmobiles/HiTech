import { Component, inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { Router, RouterModule } from '@angular/router';
import { CartService } from '../../core/services/cart.service';
import { OrderService } from '../../core/services/order.service';
import { AuthService } from '../../core/services/auth.service';
import { ToastService } from '../../core/services/toast.service';
import { CustomerDetails } from '../../core/models/order.model';

@Component({
  selector: 'app-cart',
  standalone: true,
  imports: [CommonModule, FormsModule, RouterModule],
  templateUrl: './cart.component.html',
  styleUrls: ['./cart.component.scss']
})
export class CartComponent {
  cartService = inject(CartService);
  orderService = inject(OrderService);
  authService = inject(AuthService);
  toastService = inject(ToastService);
  private router = inject(Router);

  isSubmittingOrder: boolean = false;

  customerForm: CustomerDetails = {
    name: '',
    phone: '',
    address: '',
    pincode: '',
    email: '',
    notes: ''
  };

  constructor() {
    const session = this.authService.currentSession();
    if (session && session.role === 'shopowner') {
      const discount = session.bulkDiscountPercent || 10;
      this.cartService.setBulkMode(true, discount);
      this.useShopAddress(false);
    } else {
      this.cartService.setBulkMode(false);
    }
  }

  useShopAddress(showToast: boolean = true): void {
    const owner = this.authService.currentShopOwner();
    const session = this.authService.currentSession();
    if (!session || session.role !== 'shopowner') return;

    this.customerForm.name = owner?.ownerName || session.name || session.shopName || '';
    if (owner?.phone) this.customerForm.phone = owner.phone;
    if (owner?.email || session.email) this.customerForm.email = owner?.email || session.email;
    if (owner?.location) this.customerForm.address = owner.location;

    if (owner?.location) {
      const pinMatch = owner.location.match(/\b\d{6}\b/);
      if (pinMatch) {
        this.customerForm.pincode = pinMatch[0];
      }
    }

    if (showToast) {
      this.toastService.show('Default shop address applied to order delivery!', 'success');
    }
  }

  clearAddressForClient(): void {
    this.customerForm.name = '';
    this.customerForm.phone = '';
    this.customerForm.email = '';
    this.customerForm.address = '';
    this.customerForm.pincode = '';
    this.customerForm.notes = '';
    this.toastService.show('Cleared. Enter your client delivery details.', 'info');
  }

  updateQty(productId: string, quantity: number): void {
    this.cartService.updateQuantity(productId, quantity);
  }

  removeItem(productId: string): void {
    this.cartService.removeFromCart(productId);
    this.toastService.show('Item removed from cart', 'info');
  }

  clearCart(): void {
    this.cartService.clearCart();
    this.toastService.show('Cart cleared', 'info');
  }

  async placeOrder(): Promise<void> {
    if (!this.customerForm.name.trim() || !this.customerForm.phone.trim() || !this.customerForm.address.trim()) {
      this.toastService.show('Please fill in Name, Phone Number, and Delivery Address.', 'warning');
      return;
    }

    if (this.customerForm.phone.trim().length < 10) {
      this.toastService.show('Please enter a valid 10-digit mobile number.', 'warning');
      return;
    }

    this.isSubmittingOrder = true;
    try {
      const result = await this.orderService.placeOrder(this.customerForm);
      if (result.success && result.order) {
        this.toastService.show('Order placed successfully! Notification sent.', 'success', 'Order Confirmed');
        this.router.navigate(['/order-success']);
      } else {
        this.toastService.show(result.message || 'Failed to place order', 'danger');
      }
    } catch (e) {
      console.error(e);
      this.toastService.show('An unexpected error occurred while placing your order', 'danger');
    } finally {
      this.isSubmittingOrder = false;
    }
  }
}
