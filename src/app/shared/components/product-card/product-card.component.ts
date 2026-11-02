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

  currentImageIndex: number = 0;
  imageLoaded: { [idx: number]: boolean } = {};
  imageFailed: { [idx: number]: boolean } = {};

  showNotifyModal: boolean = false;
  isSubmittingNotify: boolean = false;
  notifyForm = {
    name: '',
    phone: '',
    email: ''
  };

  get productImages(): string[] {
    if (this.product.images && this.product.images.length > 0) {
      return this.product.images.slice(0, 3);
    }
    return [this.product.image];
  }

  get currentImage(): string {
    const list = this.productImages;
    return list[this.currentImageIndex] || this.product.image;
  }

  get discountPercent(): number {
    if (this.product.originalPrice && this.product.originalPrice > this.product.price) {
      return Math.round((1 - this.product.price / this.product.originalPrice) * 100);
    }
    return 0;
  }

      onImageLoaded(idx: number): void {
        this.imageLoaded[idx] = true;
        this.imageFailed[idx] = false;
      }

      onImageError(idx: number): void {
        this.imageFailed[idx] = true;
        this.imageLoaded[idx] = false;
      }

      nextImage(e: Event): void {
        e.stopPropagation();
        e.preventDefault();
        const total = this.productImages.length;
        if(total > 1) {
        this.currentImageIndex = (this.currentImageIndex + 1) % total;
      }
    }

    prevImage(e: Event): void {
      e.stopPropagation();
      e.preventDefault();
      const total = this.productImages.length;
      if(total > 1) {
      this.currentImageIndex = (this.currentImageIndex - 1 + total) % total;
    }
  }

  selectImage(idx: number, e: Event): void {
    e.stopPropagation();
    e.preventDefault();
    this.currentImageIndex = idx;
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
      this.toastService.show(`Notification registered! We will update you as soon as ${this.product.name} is restocked.`, 'success', 'Alert Created');
      this.closeNotifyModal();
      this.notifyForm = { name: '', phone: '', email: '' };
    } catch {
      this.toastService.show('Failed to register notification. Please try again later.', 'danger');
    } finally {
      this.isSubmittingNotify = false;
    }
  }
}
