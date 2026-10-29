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
import { ProductItem, ProductImageView } from '../../../core/models/product.model';

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

  productViews: ProductImageView[] = [];
  selectedViewIndex: number = 0;
  isImageLoading: boolean = true;
  showZoomModal: boolean = false;
  activeSpecsTab: 'specs' | 'features' | 'warranty' = 'specs';

  showNotifyModal: boolean = false;
  isSubmittingNotify: boolean = false;
  notifyForm = {
    name: '',
    phone: '',
    email: ''
  };

  get currentView(): ProductImageView | null {
    if (!this.productViews || this.productViews.length === 0) return null;
    return this.productViews[this.selectedViewIndex] || this.productViews[0];
  }

  ngOnInit(): void {
    this.route.params.subscribe(params => {
      const id = params['id'];
      const found = this.dataService.allProducts().find(p => p.id === id);
      if (found) {
        this.product = found;
        this.initProductViews(found);
        this.seoService.updateMeta({
          title: `${found.name} — Specs, Multi-View & Price`,
          description: `Explore multi-angle photos, specifications, front and back view of ${found.name}. Certified genuine with brand warranty at HiTech.`,
          canonicalUrl: `/products/${found.id}`,
          ogImage: found.image
        });
      }
    });
  }

  initProductViews(p: ProductItem): void {
    this.selectedViewIndex = 0;
    this.isImageLoading = true;

    // Use custom views if product explicitly defined them
    if (p.views && p.views.length > 0) {
      this.productViews = p.views;
      return;
    }

    const isPhone = p.category === 'phone';
    const views: ProductImageView[] = [];

    // 1. Front View (Display & Front Panel)
    views.push({
      id: 'view-front',
      label: 'Front View',
      type: 'front',
      url: p.image,
      caption: isPhone
        ? `Front Display View: ${p.specs?.display || 'Bezel-less OLED Screen'}`
        : `Front View: ${p.name}`
    });

    // 2. Back View (Camera bump, finish & housing)
    views.push({
      id: 'view-back',
      label: 'Back View',
      type: 'back',
      url: this.getBackViewUrl(p),
      caption: isPhone
        ? `Back View: ${p.specs?.camera || 'AI Camera Module'} with Precision Finish`
        : `Rear / In-Use View: ${p.name}`
    });

    // 3. Side / Angle Profile View
    views.push({
      id: 'view-angle',
      label: 'Side Profile',
      type: 'angle',
      url: this.getAngleViewUrl(p),
      caption: isPhone
        ? `Ergonomic Profile: Slim aerospace-grade frame & tactile controls`
        : `Connector & Ports Detail View`
    });

    // 4. Specification Infographic View
    views.push({
      id: 'view-specs',
      label: 'Specs Card',
      type: 'specs',
      url: this.generateSpecsInfographicSvg(p),
      caption: `Verified Factory Specifications & Benchmark Overview`
    });

    this.productViews = views;
  }

  selectView(idx: number): void {
    if (idx === this.selectedViewIndex) return;
    this.isImageLoading = true;
    this.selectedViewIndex = idx;
  }

  onImageLoaded(): void {
    this.isImageLoading = false;
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

  onImageError(event: Event): void {
    const img = event.target as HTMLImageElement;
    this.isImageLoading = false;
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

  private getBackViewUrl(p: ProductItem): string {
    if (p.images && p.images[1]) return p.images[1];
    const b = p.brand.toLowerCase();
    if (b.includes('apple')) {
      return 'https://images.unsplash.com/photo-1591337676887-a217a6970a8a?auto=format&fit=crop&w=700&q=80';
    }
    if (b.includes('samsung')) {
      return 'https://images.unsplash.com/photo-1610945415295-d9bbf067e59c?auto=format&fit=crop&w=700&q=80';
    }
    if (b.includes('oneplus') || b.includes('nothing')) {
      return 'https://images.unsplash.com/photo-1574944985070-8f3ebc6b79d2?auto=format&fit=crop&w=700&q=80';
    }
    if (p.category === 'accessory') {
      return 'https://images.unsplash.com/photo-1546868871-7041f2a55e12?auto=format&fit=crop&w=700&q=80';
    }
    return 'https://images.unsplash.com/photo-1565849904461-04a58ad377e0?auto=format&fit=crop&w=700&q=80';
  }

  private getAngleViewUrl(p: ProductItem): string {
    if (p.images && p.images[2]) return p.images[2];
    const b = p.brand.toLowerCase();
    if (b.includes('apple')) {
      return 'https://images.unsplash.com/photo-1512054502232-10a0a035d672?auto=format&fit=crop&w=700&q=80';
    }
    if (p.category === 'accessory') {
      return 'https://images.unsplash.com/photo-1505740420928-5e560c06d30e?auto=format&fit=crop&w=700&q=80';
    }
    return 'https://images.unsplash.com/photo-1580910051074-3eb694886505?auto=format&fit=crop&w=700&q=80';
  }

  private generateSpecsInfographicSvg(p: ProductItem): string {
    const name = this.escapeXml(p.name);
    const brand = this.escapeXml(p.brand);
    const display = this.escapeXml(p.specs?.display || 'Super Retina XDR / AMOLED');
    const ram = this.escapeXml(p.specs?.ram || '8 GB LPDDR5X');
    const storage = this.escapeXml(p.specs?.storage || '128 GB UFS 4.0');
    const battery = this.escapeXml(p.specs?.battery || '5000 mAh All-Day');
    const camera = this.escapeXml(p.specs?.camera || '50MP AI Dual Matrix');
    const price = `₹${p.price.toLocaleString('en-IN')}`;

    const svg = `
      <svg xmlns="http://www.w3.org/2000/svg" width="700" height="700" viewBox="0 0 700 700">
        <defs>
          <linearGradient id="bg" x1="0%" y1="0%" x2="100%" y2="100%">
            <stop offset="0%" stop-color="#0a0f1d"/>
            <stop offset="50%" stop-color="#0f172a"/>
            <stop offset="100%" stop-color="#1e293b"/>
          </linearGradient>
          <linearGradient id="accent" x1="0%" y1="0%" x2="100%" y2="0%">
            <stop offset="0%" stop-color="#0284c7"/>
            <stop offset="50%" stop-color="#38bdf8"/>
            <stop offset="100%" stop-color="#818cf8"/>
          </linearGradient>
          <linearGradient id="cardGrad" x1="0%" y1="0%" x2="0%" y2="100%">
            <stop offset="0%" stop-color="rgba(255,255,255,0.08)"/>
            <stop offset="100%" stop-color="rgba(255,255,255,0.02)"/>
          </linearGradient>
        </defs>

        <!-- Background -->
        <rect width="100%" height="100%" fill="url(#bg)"/>
        <rect x="25" y="25" width="650" height="650" rx="20" fill="none" stroke="rgba(56,189,248,0.25)" stroke-width="2"/>

        <!-- Header Ribbon -->
        <rect x="45" y="50" width="130" height="32" rx="16" fill="rgba(56,189,248,0.15)"/>
        <text x="110" y="71" font-family="-apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif" font-size="13" font-weight="700" fill="#38bdf8" text-anchor="middle" letter-spacing="1">
          ${brand.toUpperCase()} OFFICIAL
        </text>

        <text x="45" y="125" font-family="-apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif" font-size="28" font-weight="800" fill="#f8fafc">
          ${name}
        </text>
        <text x="45" y="155" font-family="-apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif" font-size="16" font-weight="600" fill="#94a3b8">
          Verified Factory Hardware Specifications Overview
        </text>

        <!-- Spec Cards Grid -->
        <!-- Card 1: Display -->
        <g transform="translate(45, 185)">
          <rect width="290" height="105" rx="14" fill="url(#cardGrad)" stroke="rgba(255,255,255,0.1)"/>
          <circle cx="36" cy="36" r="18" fill="rgba(56,189,248,0.15)"/>
          <text x="36" y="42" font-size="18" text-anchor="middle">📱</text>
          <text x="68" y="34" font-family="-apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif" font-size="12" font-weight="700" fill="#94a3b8" letter-spacing="0.5">DISPLAY &amp; GLASS</text>
          <text x="68" y="55" font-family="-apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif" font-size="15" font-weight="800" fill="#f8fafc">${display}</text>
          <text x="68" y="75" font-family="-apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif" font-size="12" fill="#64748b">High-precision touch panel</text>
        </g>

        <!-- Card 2: Camera Matrix -->
        <g transform="translate(365, 185)">
          <rect width="290" height="105" rx="14" fill="url(#cardGrad)" stroke="rgba(255,255,255,0.1)"/>
          <circle cx="36" cy="36" r="18" fill="rgba(168,85,247,0.15)"/>
          <text x="36" y="42" font-size="18" text-anchor="middle">📸</text>
          <text x="68" y="34" font-family="-apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif" font-size="12" font-weight="700" fill="#c084fc" letter-spacing="0.5">CAMERA MATRIX</text>
          <text x="68" y="55" font-family="-apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif" font-size="15" font-weight="800" fill="#f8fafc">${camera}</text>
          <text x="68" y="75" font-family="-apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif" font-size="12" fill="#64748b">Optical Image Stabilization (OIS)</text>
        </g>

        <!-- Card 3: Battery & Power -->
        <g transform="translate(45, 310)">
          <rect width="290" height="105" rx="14" fill="url(#cardGrad)" stroke="rgba(255,255,255,0.1)"/>
          <circle cx="36" cy="36" r="18" fill="rgba(16,185,129,0.15)"/>
          <text x="36" y="42" font-size="18" text-anchor="middle">⚡</text>
          <text x="68" y="34" font-family="-apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif" font-size="12" font-weight="700" fill="#34d399" letter-spacing="0.5">BATTERY &amp; POWER</text>
          <text x="68" y="55" font-family="-apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif" font-size="15" font-weight="800" fill="#f8fafc">${battery}</text>
          <text x="68" y="75" font-family="-apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif" font-size="12" fill="#64748b">Fast charging &amp; power optimization</text>
        </g>

        <!-- Card 4: Memory & Storage -->
        <g transform="translate(365, 310)">
          <rect width="290" height="105" rx="14" fill="url(#cardGrad)" stroke="rgba(255,255,255,0.1)"/>
          <circle cx="36" cy="36" r="18" fill="rgba(245,158,11,0.15)"/>
          <text x="36" y="42" font-size="18" text-anchor="middle">💾</text>
          <text x="68" y="34" font-family="-apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif" font-size="12" font-weight="700" fill="#fbbf24" letter-spacing="0.5">MEMORY &amp; STORAGE</text>
          <text x="68" y="55" font-family="-apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif" font-size="15" font-weight="800" fill="#f8fafc">${ram} • ${storage}</text>
          <text x="68" y="75" font-family="-apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif" font-size="12" fill="#64748b">High-speed read/write architecture</text>
        </g>

        <!-- Bottom Certification Seal -->
        <g transform="translate(45, 440)">
          <rect width="610" height="110" rx="14" fill="rgba(56,189,248,0.06)" stroke="rgba(56,189,248,0.2)"/>
          <circle cx="50" cy="55" r="26" fill="rgba(16,185,129,0.2)"/>
          <text x="50" y="63" font-size="24" text-anchor="middle">🛡️</text>
          <text x="95" y="45" font-family="-apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif" font-size="16" font-weight="800" fill="#38bdf8">100% GENUINE OEM CERTIFIED</text>
          <text x="95" y="70" font-family="-apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif" font-size="13" fill="#cbd5e1">Covered under 1-Year Manufacturer Warranty with HiTech Express Support</text>
          <text x="95" y="90" font-family="-apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif" font-size="12" fill="#64748b">Inclusive of official GST tax invoice and express courier packaging.</text>
        </g>

        <!-- Price Tag Strip -->
        <g transform="translate(45, 575)">
          <rect width="610" height="65" rx="12" fill="url(#accent)"/>
          <text x="35" y="40" font-family="-apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif" font-size="16" font-weight="700" fill="#0f172a">OFFICIAL STORE PRICE</text>
          <text x="575" y="43" font-family="-apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif" font-size="26" font-weight="900" fill="#0f172a" text-anchor="end">${price}</text>
        </g>
      </svg>
    `;

    return 'data:image/svg+xml;utf8,' + encodeURIComponent(svg);
  }

  private escapeXml(unsafe: string): string {
    return unsafe.replace(/[<>&'"]/g, (c) => {
      switch (c) {
        case '<': return '&lt;';
        case '>': return '&gt;';
        case '&': return '&amp;';
        case '\'': return '&apos;';
        case '"': return '&quot;';
        default: return c;
      }
    });
  }
}
