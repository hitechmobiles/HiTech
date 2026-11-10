import { Component, inject, OnInit, ElementRef, ViewChild } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { ActivatedRoute, RouterModule, Router } from '@angular/router';
import { DataService } from '../../../core/services/data.service';
import { CartService } from '../../../core/services/cart.service';
import { FavouritesService } from '../../../core/services/favourites.service';
import { ToastService } from '../../../core/services/toast.service';
import { SeoService } from '../../../core/services/seo.service';
import { EmailService } from '../../../core/services/email.service';
import { AuthService } from '../../../core/services/auth.service';
import { ProductItem } from '../../../core/models/product.model';
import { LoadingSpinnerComponent } from '../../../shared/components/loading-spinner/loading-spinner.component';

@Component({
  selector: 'app-product-detail',
  standalone: true,
  imports: [CommonModule, FormsModule, RouterModule, LoadingSpinnerComponent],
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
  authService = inject(AuthService);

  product: ProductItem | null = null;
  quantity: number = 1;

  selectedImageIndex: number = 0;
  imageLoaded: { [idx: number]: boolean } = {};
  imageFailed: { [idx: number]: boolean } = {};
  showZoomModal: boolean = false;
  activeSpecsTab: 'specs' | 'features' | 'warranty' = 'specs';

  showNotifyModal: boolean = false;
  isSubmittingNotify: boolean = false;
  notifySubmitted: boolean = false;
  notifyForm = {
    name: '',
    phone: '',
    email: ''
  };

  @ViewChild('thumbStrip') thumbStrip?: ElementRef<HTMLDivElement>;

  // Touch swipe support for mobile
  touchStartX: number = 0;
  touchEndX: number = 0;

  get isOwner(): boolean {
    return this.authService.isShopOwner();
  }

  get activePrice(): number {
    if (!this.product) return 0;
    if (this.isOwner) {
      return this.product.ownerPrice || Math.round(this.product.price * 0.85);
    }
    return this.product.price;
  }

  get activeOriginalPrice(): number {
    if (!this.product) return 0;
    if (this.isOwner) {
      return Math.round(this.activePrice * 1.20);
    }
    return Math.round(this.activePrice * 1.10);
  }

  get activeDiscountPercent(): number {
    return this.isOwner ? 20 : 10;
  }

  get defaultFallbackImage(): string {
    const isAccessory = this.product?.category === 'accessory' ||
      (this.product?.id ? this.product.id.startsWith('acc-') : false);
    return isAccessory ? 'images/default-accessory.svg' : 'images/default-phone.svg';
  }

  get productImages(): string[] {
    if (this.product?.images && this.product.images.length > 0) {
      return this.product.images;
    }
    return this.product?.image ? [this.product.image] : [];
  }

  get currentImage(): string {
    const list = this.productImages;
    return list[this.selectedImageIndex] || this.product?.image || '';
  }

  ngOnInit(): void {
    this.route.params.subscribe(params => {
      if (typeof window !== 'undefined') {
        window.scrollTo({ top: 0, left: 0, behavior: 'instant' });
      }

      const id = params['id'];
      const found = this.dataService.allProducts().find(p => p.id === id);
      if (found) {
        this.product = found;
        this.selectedImageIndex = 0;
        this.imageLoaded = {};
        this.imageFailed = {};

        this.seoService.updateMeta({
          title: `${found.name} — Specs, Images & Official Price | HiTech`,
          description: `Buy ${found.name} (${found.brand}) online at HiTech. 100% genuine factory sealed with 1-year brand warranty and pan-India express delivery.`,
          canonicalUrl: `/products/${found.id}`,
          ogImage: found.image
        });
      }
    });
  }

  selectImage(idx: number): void {
    this.selectedImageIndex = idx;
    this.scrollThumbIntoView(idx);
  }

  nextImage(): void {
    const total = this.productImages.length;
    if (total > 1) {
      this.selectedImageIndex = (this.selectedImageIndex + 1) % total;
      this.scrollThumbIntoView(this.selectedImageIndex);
    }
  }

  prevImage(): void {
    const total = this.productImages.length;
    if (total > 1) {
      this.selectedImageIndex = (this.selectedImageIndex - 1 + total) % total;
      this.scrollThumbIntoView(this.selectedImageIndex);
    }
  }

  scrollThumbStrip(direction: 'left' | 'right'): void {
    if (!this.thumbStrip?.nativeElement) return;
    const scrollAmount = 180;
    this.thumbStrip.nativeElement.scrollBy({
      left: direction === 'left' ? -scrollAmount : scrollAmount,
      behavior: 'smooth'
    });
  }

  private scrollThumbIntoView(idx: number): void {
    if (!this.thumbStrip?.nativeElement) return;
    const container = this.thumbStrip.nativeElement;
    const thumbButtons = container.querySelectorAll<HTMLElement>('.thumb-img-btn');
    const targetThumb = thumbButtons[idx];
    if (targetThumb) {
      targetThumb.scrollIntoView({ behavior: 'smooth', block: 'nearest', inline: 'center' });
    }
  }

  onTouchStart(e: TouchEvent): void {
    if (e.changedTouches && e.changedTouches.length > 0) {
      this.touchStartX = e.changedTouches[0].screenX;
    }
  }

  onTouchEnd(e: TouchEvent): void {
    if (e.changedTouches && e.changedTouches.length > 0) {
      this.touchEndX = e.changedTouches[0].screenX;
      this.handleSwipe();
    }
  }

  private handleSwipe(): void {
    const threshold = 40;
    const diff = this.touchStartX - this.touchEndX;
    if (Math.abs(diff) > threshold) {
      if (diff > 0) {
        this.nextImage();
      } else {
        this.prevImage();
      }
    }
  }

  onImageLoaded(idx: number): void {
    this.imageLoaded[idx] = true;
    this.imageFailed[idx] = false;
  }

  onImageError(idx: number, event?: Event): void {
    if (event?.target) {
      (event.target as HTMLImageElement).src = this.defaultFallbackImage;
    }
    this.imageFailed[idx] = true;
    this.imageLoaded[idx] = false;
  }

  openZoomModal(): void {
    this.showZoomModal = true;
  }

  closeZoomModal(): void {
    this.showZoomModal = false;
  }

  incrementQty(): void {
    this.quantity++;
  }

  decrementQty(): void {
    if (this.quantity > 1) this.quantity--;
  }

  addToCart(): void {
    if (!this.product) return;
    if (!this.product.inStock) {
      this.toastService.show('Item is currently out of stock.', 'warning');
      return;
    }
    this.cartService.addToCart(this.product, this.quantity, this.activePrice);
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
    this.notifySubmitted = false;
    this.showNotifyModal = true;
  }

  closeNotifyModal(): void {
    this.showNotifyModal = false;
  }

  async submitNotifyRequest(): Promise<void> {
    if (!this.product) return;
    this.notifySubmitted = true;

    if (!this.notifyForm.name.trim() || !this.notifyForm.phone.trim()) {
      this.toastService.show('Please provide your name and 10-digit phone number.', 'warning');
      return;
    }

    const phoneClean = this.notifyForm.phone.trim().replace(/\D/g, '');
    if (phoneClean.length < 10) {
      this.toastService.show('Please enter a valid 10-digit mobile number.', 'warning');
      return;
    }

    if (this.notifyForm.email && this.notifyForm.email.trim()) {
      const emailRegex = /^[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}$/;
      if (!emailRegex.test(this.notifyForm.email.trim())) {
        this.toastService.show('Please enter a valid email address.', 'warning');
        return;
      }
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
      } catch { }

      this.toastService.show(`We will alert you as soon as ${this.product.name} is back in stock!`, 'success', 'Alert Registered');
      this.showNotifyModal = false;
    } catch {
      this.toastService.show('Failed to register restock alert. Please try again.', 'danger');
    } finally {
      this.isSubmittingNotify = false;
    }
  }
}
