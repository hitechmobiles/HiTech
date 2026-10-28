import { Component, Input, inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { RouterModule } from '@angular/router';
import { ProductItem } from '../../../core/models/product.model';
import { CartService } from '../../../core/services/cart.service';
import { FavouritesService } from '../../../core/services/favourites.service';
import { ToastService } from '../../../core/services/toast.service';
import { EmailService } from '../../../core/services/email.service';

@Component({
  selector: 'app-product-card',
  standalone: true,
  imports: [CommonModule, FormsModule, RouterModule],
  templateUrl: './product-card.component.html',
  styleUrls: ['./product-card.component.scss']
})
export class ProductCardComponent {
  @Input({ required: true }) product!: ProductItem;

  cartService = inject(CartService);
  favService = inject(FavouritesService);
  toastService = inject(ToastService);
  emailService = inject(EmailService);

  showNotifyModal: boolean = false;
  isSubmittingNotify: boolean = false;
  notifyForm = {
    name: '',
    phone: '',
    email: ''
  };

  get discountPercent(): number {
    if (this.product.originalPrice && this.product.originalPrice > this.product.price) {
      return Math.round((1 - this.product.price / this.product.originalPrice) * 100);
    }
    return 0;
  }

  onImageError(event: Event): void {
    const img = event.target as HTMLImageElement;
    if (img && !img.dataset['fallback']) {
      img.dataset['fallback'] = 'true';
      const brand = encodeURIComponent(this.product.brand || 'HiTech');
      img.src = `data:image/svg+xml;utf8,<svg xmlns="http://www.w3.org/2000/svg" width="300" height="300" viewBox="0 0 300 300"><rect width="100%" height="100%" fill="%230f172a"/><circle cx="150" cy="130" r="45" fill="%231e293b"/><path d="M125 185 h50 a15 15 0 0 1 15 15 v20 h-80 v-20 a15 15 0 0 1 15 -15 z" fill="%231e293b"/><text x="150" y="250" font-family="sans-serif" font-size="14" fill="%2338bdf8" text-anchor="middle" font-weight="600">${brand}</text></svg>`;
    }
  }

  addToCart(e: Event): void {
    e.stopPropagation();
    if (!this.product.inStock) {
      this.toastService.show('Item is currently out of stock.', 'warning');
      return;
    }
    this.cartService.addToCart(this.product);
    this.toastService.show(`Added ${this.product.name} to your cart`, 'success', 'Cart Updated');
  }

  toggleFav(e: Event): void {
    e.stopPropagation();
    const added = this.favService.toggleFavourite(this.product);
    if (added) {
      this.toastService.show(`Saved ${this.product.name} to favourites`, 'info');
    } else {
      this.toastService.show(`Removed from favourites`, 'info');
    }
  }

  openNotifyModal(e: Event): void {
    e.stopPropagation();
    this.showNotifyModal = true;
  }

  closeNotifyModal(e?: Event): void {
    if (e) e.stopPropagation();
    this.showNotifyModal = false;
  }

  async submitNotifyRequest(e: Event): Promise<void> {
    e.stopPropagation();
    if (!this.notifyForm.name.trim() || !this.notifyForm.phone.trim()) {
      this.toastService.show('Please provide your name and 10-digit phone number.', 'warning');
      return;
    }

    if (this.notifyForm.phone.trim().length < 10) {
      this.toastService.show('Please enter a valid 10-digit mobile number.', 'warning');
      return;
    }

    this.isSubmittingNotify = true;
    try {
      await this.emailService.sendProductRequestNotification({
        requestedProduct: this.product.name,
        customerName: this.notifyForm.name.trim(),
        customerPhone: this.notifyForm.phone.trim(),
        customerEmail: this.notifyForm.email.trim() || undefined,
        preferredSpecs: this.product.specs?.storage || this.product.specs?.ram || 'Standard model',
        customerNotes: 'Restock notification request for out-of-stock item'
      });

      // Save to localStorage list of notification requests for admin visibility
      try {
        const key = 'hitech_notify_requests';
        const existing = JSON.parse(localStorage.getItem(key) || '[]');
        existing.unshift({
          productId: this.product.id,
          productName: this.product.name,
          customerName: this.notifyForm.name.trim(),
          customerPhone: this.notifyForm.phone.trim(),
          customerEmail: this.notifyForm.email.trim(),
          timestamp: new Date().toLocaleString()
        });
        localStorage.setItem(key, JSON.stringify(existing.slice(0, 100)));
      } catch {}

      this.toastService.show(`We will alert you as soon as ${this.product.name} is back in stock!`, 'success', 'Alert Registered');
      this.showNotifyModal = false;
    } catch {
      this.toastService.show('Failed to register notification request. Please try again.', 'danger');
    } finally {
      this.isSubmittingNotify = false;
    }
  }
}
