import { Component, inject, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { ActivatedRoute, RouterModule, Router } from '@angular/router';
import { DataService } from '../../../core/services/data.service';
import { CartService } from '../../../core/services/cart.service';
import { FavouritesService } from '../../../core/services/favourites.service';
import { ToastService } from '../../../core/services/toast.service';
import { SeoService } from '../../../core/services/seo.service';
import { EmailService } from '../../../core/services/email.service';
import { ProductItem } from '../../../core/models/product.model';

@Component({
  selector: 'app-product-detail',
  standalone: true,
  imports: [CommonModule, FormsModule, RouterModule],
  templateUrl: './product-detail.component.html',
  styleUrls: ['./product-detail.component.scss']
})
export class ProductDetailComponent implements OnInit {
  private route = inject(ActivatedRoute);
  private router = inject(Router);
  private seoService = inject(SeoService);
  dataService = inject(DataService);
  cartService = inject(CartService);
  favService = inject(FavouritesService);
  toastService = inject(ToastService);
  emailService = inject(EmailService);

  product: ProductItem | null = null;
  quantity: number = 1;

  showNotifyModal: boolean = false;
  isSubmittingNotify: boolean = false;
  notifyForm = {
    name: '',
    phone: '',
    email: ''
  };

  ngOnInit(): void {
    this.route.params.subscribe(params => {
      const id = params['id'];
      const found = this.dataService.allProducts().find(p => p.id === id);
      if (found) {
        this.product = found;
        this.seoService.updateMeta({
          title: `${found.name} — Specs, Price & Reviews`,
          description: `Buy ${found.name} online at ₹${found.price.toLocaleString()} in India. 100% genuine guaranteed with manufacturer warranty and express shipping at HiTech.`,
          canonicalUrl: `/products/${found.id}`,
          ogImage: found.image
        });
      }
    });
  }

  incrementQty(): void {
    this.quantity++;
  }

  decrementQty(): void {
    if (this.quantity > 1) this.quantity--;
  }

  onImageError(event: Event): void {
    const img = event.target as HTMLImageElement;
    if (img && !img.dataset['fallback']) {
      img.dataset['fallback'] = 'true';
      const brand = encodeURIComponent(this.product?.brand || 'HiTech');
      img.src = `data:image/svg+xml;utf8,<svg xmlns="http://www.w3.org/2000/svg" width="600" height="600" viewBox="0 0 600 600"><rect width="100%" height="100%" fill="%230f172a"/><circle cx="300" cy="260" r="90" fill="%231e293b"/><path d="M250 370 h100 a30 30 0 0 1 30 30 v40 h-160 v-40 a30 30 0 0 1 30 -30 z" fill="%231e293b"/><text x="300" y="500" font-family="sans-serif" font-size="28" fill="%2338bdf8" text-anchor="middle" font-weight="600">${brand}</text></svg>`;
    }
  }

  addToCart(): void {
    if (!this.product) return;
    if (!this.product.inStock) {
      this.toastService.show('Item is currently out of stock.', 'warning');
      return;
    }
    this.cartService.addToCart(this.product, this.quantity);
    this.toastService.show(`Added ${this.quantity}x ${this.product.name} to cart`, 'success', 'Cart Updated');
  }

  buyNow(): void {
    if (!this.product) return;
    this.addToCart();
    this.router.navigate(['/cart']);
  }

  toggleFav(): void {
    if (!this.product) return;
    const added = this.favService.toggleFavourite(this.product);
    this.toastService.show(
      added ? `Saved ${this.product.name} to favourites` : 'Removed from favourites',
      'info'
    );
  }

  openNotifyModal(): void {
    this.showNotifyModal = true;
  }

  closeNotifyModal(): void {
    this.showNotifyModal = false;
  }

  async submitNotifyRequest(): Promise<void> {
    if (!this.product) return;
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
      this.toastService.show('Failed to register restock alert. Please try again.', 'danger');
    } finally {
      this.isSubmittingNotify = false;
    }
  }
}
