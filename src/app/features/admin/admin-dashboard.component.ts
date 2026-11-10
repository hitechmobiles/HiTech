import { Component, inject, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { RouterModule } from '@angular/router';
import { DataService } from '../../core/services/data.service';
import { OrderService } from '../../core/services/order.service';
import { AuthService } from '../../core/services/auth.service';
import { ToastService } from '../../core/services/toast.service';
import { EmailService } from '../../core/services/email.service';
import { CatalogPublishService, GithubPublishConfig } from '../../core/services/catalog-publish.service';
import { DistanceService, HubConfig } from '../../core/services/distance.service';
import { LoggerService } from '../../core/services/logger.service';
import { SupabaseService, OfferRecord } from '../../core/services/supabase.service';
import { CloudinaryService } from '../../core/services/cloudinary.service';
import { ProductItem, ProductSpecs } from '../../core/models/product.model';
import { ServiceBookingItem, ServiceBookingRequest } from '../../core/models/service.model';
import { ShopOwner } from '../../core/models/shop-owner.model';
import { Order } from '../../core/models/order.model';
import { ORDER_NOTIFICATION_TEMPLATE_HTML, SERVICE_BOOKING_TEMPLATE_HTML } from '../../core/constants/email-templates';

@Component({
  selector: 'app-admin-dashboard',
  standalone: true,
  imports: [CommonModule, FormsModule, RouterModule],
  templateUrl: './admin-dashboard.component.html',
  styleUrls: ['./admin-dashboard.component.scss']
})
export class AdminDashboardComponent implements OnInit {
  dataService = inject(DataService);
  orderService = inject(OrderService);
  authService = inject(AuthService);
  toastService = inject(ToastService);
  emailService = inject(EmailService);
  publishService = inject(CatalogPublishService);
  distanceService = inject(DistanceService);
  loggerService = inject(LoggerService);
  supabaseService = inject(SupabaseService);
  cloudinaryService = inject(CloudinaryService);

  activeTab: 'products' | 'pricing' | 'owners' | 'orders' | 'offers' | 'settings' = 'products';
  pricingCategoryTab: 'phones' | 'accessories' | 'services' = 'phones';
  searchQuery: string = '';
  ownerFilter: 'all' | 'pending' | 'active' | 'suspended' = 'all';
  ordersSubTab: 'orders' | 'services' | 'restock' = 'orders';
  notifyRequests: Array<{ productId?: string; productName: string; customerName: string; customerPhone: string; customerEmail?: string; timestamp: string }> = [];

  // --- Product Add / Edit Modal State ---
  showProductModal: boolean = false;
  isEditingProduct: boolean = false;
  isUploadingCloudinaryImage: boolean = false;
  productForm = {
    id: '',
    name: '',
    brand: '',
    category: 'phone' as 'phone' | 'accessory',
    subCategory: 'Smartphones',
    price: 0,
    ownerPrice: 0,
    originalPrice: 0,
    stockQuantity: 25,
    image: '',
    images: [] as string[],
    newGalleryUrl: '',
    description: '',
    isFeatured: false,
    inStock: true,
    rating: 4.8,
    reviewsCount: 1,
    ram: '',
    storage: '',
    display: '',
    battery: '',
    camera: '',
    processor: '',
    os: '',
    warranty: '1 Year Brand Warranty',
    compatibleWith: ''
  };

  // --- Offers & Promotional Video Ads State ---
  offersList: OfferRecord[] = [];
  isLoadingOffers: boolean = false;
  showOfferModal: boolean = false;
  isEditingOffer: boolean = false;
  isUploadingOfferVideo: boolean = false;
  offerForm = {
    id: '',
    title: '',
    description: '',
    video_url: '',
    poster_url: '',
    target_url: '/products',
    start_at: '',
    end_at: '',
    is_active: true
  };

  // Live Supabase DB Health Stats
  supabaseStats: any = null;

  // Quick Price Edit Modal
  editingProduct: ProductItem | null = null;
  editingPriceValue: number = 0;
  editingOwnerPriceValue: number = 0;

  editingService: ServiceBookingItem | null = null;
  editingServicePriceValue: number = 0;

  // Editing state for Shop Owner credentials
  editingOwner: ShopOwner | null = null;
  editOwnerEmail: string = '';
  editOwnerPasswordPlain: string = '';
  editOwnerTier: string = '';

  // Approving state for Pending Shop Owner
  approvingOwner: ShopOwner | null = null;
  approveEmail: string = '';
  approvePassword: string = '';
  approveTier: string = 'Silver (10% OFF)';

  // GitHub Settings & Publish state
  githubConfig: GithubPublishConfig = {
    owner: '',
    repo: '',
    branch: '',
    token: ''
  };
  showPatToken: boolean = false;
  isPublishingGithub: boolean = false;
  isSyncingOrders: boolean = false;
  isTriggeringPipeline: boolean = false;
  lastSyncTime: string = localStorage.getItem('hitech_last_sync_time') || '';

  // Hub Settings
  hubSettings: HubConfig = {
    name: '',
    address: '',
    lat: 0,
    lng: 0,
    pickupRadiusKm: 30
  };

  // Yearly archive state
  lastBackupYear: number | null = null;
  isArchivingOrders: boolean = false;

  // CI/CD Publish Confirmation Modal State
  showPublishModal: boolean = false;
  publishModalMode: 'publish_catalog' | 'trigger_pipeline' = 'publish_catalog';
  publishFilesSummary: { name: string; path: string; count: number }[] = [];

  // GitHub PAT Token Setup Modal State
  showPatModal: boolean = false;
  isVerifyingPat: boolean = false;
  patVerificationMessage: string = '';
  patVerificationSuccess: boolean = false;

  // Order & Booking Status History Modal State
  selectedOrderForHistory: Order | null = null;
  selectedBookingForHistory: ServiceBookingRequest | null = null;

  readonly phoneSubCategories = ['Smartphones', 'Flagship Phones', 'Budget Phones', 'Gaming Phones'];
  readonly accessorySubCategories = [
    'Cases & Covers',
    'Chargers & Cables',
    'Audio & Earphones',
    'Screen Protectors',
    'Power Banks'
  ];
  readonly discountTiers = [
    'Silver (10% OFF)',
    'Gold (15% OFF)',
    'Platinum (20% OFF)',
    'Diamond VIP (25% OFF)'
  ];

  ngOnInit(): void {
    this.githubConfig = this.publishService.getConfig();
    this.hubSettings = this.distanceService.getHubConfig();
    this.lastBackupYear = this.orderService.getLastBackupYear();

    // Check for yearly auto-archive on admin load
    if (this.orderService.shouldAutoArchive()) {
      this.toastService.show('New calendar year detected. Auto-archiving previous year orders...', 'info');
      this.orderService.archiveYearAndClear({ download: true }).then(res => {
        this.lastBackupYear = res.year;
        this.toastService.show(
          `Auto-archived ${res.orderCount} orders and ${res.bookingCount} bookings for ${res.year}. Archive downloaded.`,
          'success',
          'Yearly Archive Complete'
        );
      }).catch(err => {
        console.error('Auto-archive failed', err);
      });
    }

    this.loadNotifyRequests();
    this.loadSupabaseStats();
    this.loadOffers();
  }

  async loadSupabaseStats(): Promise<void> {
    try {
      this.supabaseStats = await this.supabaseService.getDbStatus();
    } catch {
      this.supabaseStats = null;
    }
  }

  async loadOffers(): Promise<void> {
    this.isLoadingOffers = true;
    try {
      this.offersList = await this.supabaseService.getActiveOffers();
    } catch (err: any) {
      this.loggerService.warn('AdminDashboard', 'Offers load error: ' + (err?.message || err));
    } finally {
      this.isLoadingOffers = false;
    }
  }

  loadNotifyRequests(): void {
    try {
      this.notifyRequests = JSON.parse(localStorage.getItem('hitech_notify_requests') || '[]');
    } catch {
      this.notifyRequests = [];
    }
  }

  clearNotifyRequests(): void {
    if (confirm('Clear all recorded restock notification requests?')) {
      localStorage.removeItem('hitech_notify_requests');
      this.notifyRequests = [];
      this.toastService.show('Restock alert requests cleared', 'info');
    }
  }

  setTab(tab: 'products' | 'pricing' | 'owners' | 'orders' | 'offers' | 'settings'): void {
    this.activeTab = tab;
    if (tab === 'orders') {
      this.loadNotifyRequests();
    }
    if (tab === 'owners') {
      this.refreshShopOwnersList();
    }
    if (tab === 'offers') {
      this.loadOffers();
    }
    if (tab === 'settings') {
      this.loadSupabaseStats();
    }
  }

  isRefreshingOwners: boolean = false;

  async refreshShopOwnersList(): Promise<void> {
    this.isRefreshingOwners = true;
    try {
      await this.dataService.refreshShopOwners();
      const pendingCount = this.dataService.pendingShopOwners().length;
      if (pendingCount > 0) {
        this.toastService.show(`${pendingCount} partner application(s) pending review!`, 'info', 'Partner Sync');
      }
    } catch (err) {
      this.toastService.show('Failed to refresh partners from server.', 'warning');
    } finally {
      this.isRefreshingOwners = false;
    }
  }

  // --- Product Management ---

  get filteredProductsList(): ProductItem[] {
    const list = this.dataService.allProducts();
    if (!this.searchQuery.trim()) return list;
    const q = this.searchQuery.toLowerCase();
    return list.filter(p =>
      p.name.toLowerCase().includes(q) ||
      p.brand.toLowerCase().includes(q) ||
      p.category.toLowerCase().includes(q) ||
      p.subCategory.toLowerCase().includes(q)
    );
  }

  openAddProduct(): void {
    this.isEditingProduct = false;
    this.productForm = {
      id: '',
      name: '',
      brand: '',
      category: 'phone',
      subCategory: 'Smartphones',
      price: 0,
      ownerPrice: 0,
      originalPrice: 0,
      stockQuantity: 25,
      image: 'https://images.unsplash.com/photo-1592750475338-74b7b21085ab?auto=format&fit=crop&w=800&q=80',
      images: ['https://images.unsplash.com/photo-1592750475338-74b7b21085ab?auto=format&fit=crop&w=800&q=80'],
      newGalleryUrl: '',
      description: '',
      isFeatured: false,
      inStock: true,
      rating: 4.8,
      reviewsCount: 1,
      ram: '8 GB',
      storage: '128 GB',
      display: '6.1-inch OLED 120Hz',
      battery: '4500 mAh',
      camera: '50MP + 12MP',
      processor: 'Snapdragon 8 Gen / A-Series',
      os: 'Android 15 / iOS 18',
      warranty: '1 Year Brand Warranty',
      compatibleWith: ''
    };
    this.showProductModal = true;
  }

  openEditProductFull(product: ProductItem): void {
    this.isEditingProduct = true;
    const gallery = product.images && product.images.length > 0
      ? [...product.images]
      : (product.image ? [product.image] : []);

    this.productForm = {
      id: product.id,
      name: product.name,
      brand: product.brand,
      category: product.category,
      subCategory: product.subCategory,
      price: product.price,
      ownerPrice: product.ownerPrice || Math.round(product.price * 0.85),
      originalPrice: product.originalPrice || Math.round(product.price * 1.10),
      stockQuantity: product.inStock ? 25 : 0,
      image: product.image,
      images: gallery,
      newGalleryUrl: '',
      description: product.description || '',
      isFeatured: !!product.isFeatured,
      inStock: product.inStock,
      rating: product.rating || 4.8,
      reviewsCount: product.reviewsCount || 0,
      ram: product.specs?.ram || '',
      storage: product.specs?.storage || '',
      display: product.specs?.display || '',
      battery: product.specs?.battery || '',
      camera: product.specs?.camera || '',
      processor: product.specs?.processor || '',
      os: product.specs?.os || '',
      warranty: product.specs?.warranty || '1 Year Brand Warranty',
      compatibleWith: product.compatibleWith || ''
    };
    this.showProductModal = true;
  }

  closeProductModal(): void {
    this.showProductModal = false;
  }

  onCategoryChange(): void {
    if (this.productForm.category === 'phone') {
      this.productForm.subCategory = 'Smartphones';
    } else {
      this.productForm.subCategory = 'Cases & Covers';
    }
  }

  async onCloudinaryFileSelected(event: Event): Promise<void> {
    const input = event.target as HTMLInputElement;
    if (!input.files || input.files.length === 0) return;

    this.isUploadingCloudinaryImage = true;
    try {
      for (let i = 0; i < input.files.length; i++) {
        const file = input.files[i];
        const res = await this.cloudinaryService.uploadImage(file);
        if (res && res.secure_url) {
          if (!this.productForm.image) {
            this.productForm.image = res.secure_url;
          }
          if (!this.productForm.images.includes(res.secure_url)) {
            this.productForm.images.push(res.secure_url);
          }
          this.toastService.show(`Uploaded ${file.name} to Cloudinary!`, 'success');
        }
      }
    } catch (e: any) {
      this.toastService.show('Cloudinary upload failed: ' + (e?.message || e), 'danger');
    } finally {
      this.isUploadingCloudinaryImage = false;
      input.value = '';
    }
  }

  addGalleryUrl(): void {
    if (this.productForm.newGalleryUrl && this.productForm.newGalleryUrl.trim()) {
      const url = this.productForm.newGalleryUrl.trim();
      if (!this.productForm.images.includes(url)) {
        this.productForm.images.push(url);
        if (!this.productForm.image) {
          this.productForm.image = url;
        }
      }
      this.productForm.newGalleryUrl = '';
    }
  }

  removeGalleryImage(index: number): void {
    const removed = this.productForm.images.splice(index, 1);
    if (this.productForm.images.length > 0 && !this.productForm.images.includes(this.productForm.image)) {
      this.productForm.image = this.productForm.images[0];
    }
    this.toastService.show('Gallery image removed', 'info');
  }

  setPrimaryImage(url: string): void {
    this.productForm.image = url;
    this.toastService.show('Set as primary thumbnail', 'info');
  }

  saveProductForm(): void {
    if (!this.productForm.name.trim() || !this.productForm.brand.trim() || this.productForm.price <= 0) {
      this.toastService.show('Please provide a valid Product Name, Brand, and Price.', 'warning');
      return;
    }

    if (!this.productForm.image.trim()) {
      this.toastService.show('Please provide a primary image URL or upload via Cloudinary.', 'warning');
      return;
    }

    let specs: ProductSpecs | undefined;
    if (this.productForm.category === 'phone') {
      specs = {
        ram: this.productForm.ram,
        storage: this.productForm.storage,
        display: this.productForm.display,
        battery: this.productForm.battery,
        camera: this.productForm.camera,
        processor: this.productForm.processor,
        os: this.productForm.os,
        warranty: this.productForm.warranty
      };
    } else {
      specs = {
        warranty: this.productForm.warranty
      };
    }

    const calculatedOriginalPrice = this.productForm.originalPrice > 0
      ? this.productForm.originalPrice
      : Math.round(this.productForm.price * 1.10);
    const resolvedOwnerPrice = this.productForm.ownerPrice > 0
      ? this.productForm.ownerPrice
      : Math.round(this.productForm.price * 0.85);

    const gallery = this.productForm.images.length > 0
      ? this.productForm.images
      : [this.productForm.image];

    if (this.isEditingProduct) {
      const updatedItem: ProductItem = {
        id: this.productForm.id,
        name: this.productForm.name,
        brand: this.productForm.brand,
        category: this.productForm.category,
        subCategory: this.productForm.subCategory,
        price: Number(this.productForm.price),
        ownerPrice: resolvedOwnerPrice,
        originalPrice: calculatedOriginalPrice,
        rating: Number(this.productForm.rating || 4.8),
        reviewsCount: Number(this.productForm.reviewsCount || 0),
        image: this.productForm.image,
        images: gallery,
        description: this.productForm.description,
        isFeatured: this.productForm.isFeatured,
        inStock: this.productForm.inStock,
        specs,
        compatibleWith: this.productForm.compatibleWith
      };
      this.dataService.updateProduct(updatedItem);
      this.supabaseService.upsertProduct(updatedItem, gallery).then(() => {
        this.toastService.show('Synchronized live to Supabase PostgreSQL!', 'info');
      }).catch(e => {
        this.loggerService.warn('AdminDashboard', 'Supabase async sync notice: ' + (e?.message || e));
      });
      this.toastService.show(`${updatedItem.name} updated successfully!`, 'success', 'Product Updated');
    } else {
      const created = this.dataService.addProduct({
        name: this.productForm.name,
        brand: this.productForm.brand,
        category: this.productForm.category,
        subCategory: this.productForm.subCategory,
        price: Number(this.productForm.price),
        ownerPrice: resolvedOwnerPrice,
        originalPrice: calculatedOriginalPrice,
        rating: Number(this.productForm.rating || 4.8),
        reviewsCount: Number(this.productForm.reviewsCount || 1),
        image: this.productForm.image,
        images: gallery,
        description: this.productForm.description,
        isFeatured: this.productForm.isFeatured,
        inStock: this.productForm.inStock,
        specs,
        compatibleWith: this.productForm.compatibleWith
      });
      this.supabaseService.upsertProduct(created, gallery).then(() => {
        this.toastService.show('Added live to Supabase PostgreSQL!', 'info');
      }).catch(e => {
        this.loggerService.warn('AdminDashboard', 'Supabase async sync notice: ' + (e?.message || e));
      });
      this.toastService.show(`${created.name} added to catalog!`, 'success', 'Product Created');
    }

    this.showProductModal = false;
  }

  // --- Offers & Video Promotions Management ---

  openAddOffer(): void {
    this.isEditingOffer = false;
    this.offerForm = {
      id: '',
      title: '',
      description: '',
      video_url: '',
      poster_url: '',
      target_url: '/products',
      start_at: new Date().toISOString().split('T')[0],
      end_at: new Date(Date.now() + 30 * 24 * 3600 * 1000).toISOString().split('T')[0],
      is_active: true
    };
    this.showOfferModal = true;
  }

  openEditOffer(offer: OfferRecord): void {
    this.isEditingOffer = true;
    this.offerForm = {
      id: offer.id,
      title: offer.title,
      description: offer.description || '',
      video_url: offer.video_url,
      poster_url: offer.poster_url || '',
      target_url: offer.target_url || '/products',
      start_at: offer.start_at ? offer.start_at.split('T')[0] : '',
      end_at: offer.end_at ? offer.end_at.split('T')[0] : '',
      is_active: offer.is_active
    };
    this.showOfferModal = true;
  }

  closeOfferModal(): void {
    this.showOfferModal = false;
  }

  async onOfferVideoSelected(event: Event): Promise<void> {
    const input = event.target as HTMLInputElement;
    if (!input.files || input.files.length === 0) return;

    const file = input.files[0];
    this.isUploadingOfferVideo = true;
    try {
      const res = await this.cloudinaryService.uploadVideo(file);
      if (res && res.secure_url) {
        this.offerForm.video_url = res.secure_url;
        this.offerForm.poster_url = this.cloudinaryService.getVideoPosterUrl(res.secure_url);
        this.toastService.show('Promotional video uploaded to Cloudinary!', 'success');
      }
    } catch (e: any) {
      this.toastService.show('Cloudinary video upload failed: ' + (e?.message || e), 'danger');
    } finally {
      this.isUploadingOfferVideo = false;
      input.value = '';
    }
  }

  async saveOfferForm(): Promise<void> {
    if (!this.offerForm.title.trim() || !this.offerForm.video_url.trim()) {
      this.toastService.show('Please provide offer title and video URL.', 'warning');
      return;
    }

    try {
      await this.supabaseService.upsertOffer({
        id: this.offerForm.id || undefined,
        title: this.offerForm.title.trim(),
        description: this.offerForm.description.trim(),
        video_url: this.offerForm.video_url.trim(),
        poster_url: this.offerForm.poster_url.trim(),
        target_url: this.offerForm.target_url.trim() || '/products',
        start_at: new Date(this.offerForm.start_at || Date.now()).toISOString(),
        end_at: new Date(this.offerForm.end_at || Date.now() + 30 * 24 * 3600 * 1000).toISOString(),
        is_active: this.offerForm.is_active
      });
      this.toastService.show('Promotional offer saved to Supabase!', 'success');
      this.showOfferModal = false;
      await this.loadOffers();
    } catch (e: any) {
      this.toastService.show('Failed to save offer: ' + (e?.message || e), 'danger');
    }
  }

  async toggleOfferActive(offer: OfferRecord): Promise<void> {
    try {
      const updated = !offer.is_active;
      await this.supabaseService.upsertOffer({ id: offer.id, is_active: updated });
      offer.is_active = updated;
      this.toastService.show(`Offer status set to ${updated ? 'Active' : 'Inactive'}`, 'info');
    } catch (e: any) {
      this.toastService.show('Status update failed: ' + (e?.message || e), 'danger');
    }
  }

  async deleteOfferItem(offer: OfferRecord): Promise<void> {
    if (!confirm(`Permanently remove offer "${offer.title}"?`)) return;
    try {
      await this.supabaseService.deleteOffer(offer.id);
      this.offersList = this.offersList.filter(o => o.id !== offer.id);
      this.toastService.show('Promotional video removed', 'info');
    } catch (e: any) {
      this.toastService.show('Delete failed: ' + (e?.message || e), 'danger');
    }
  }

  deleteProductItem(product: ProductItem): void {
    if (confirm(`Are you sure you want to permanently delete "${product.name}" from the catalog?`)) {
      this.dataService.deleteProduct(product.id);
      this.toastService.show(`${product.name} removed from catalog`, 'info', 'Product Deleted');
    }
  }

  toggleAvailability(product: ProductItem): void {
    this.dataService.toggleProductAvailability(product.id);
    const updated = !product.inStock;
    this.toastService.show(
      `${product.name} is now ${updated ? 'In Stock (Visible)' : 'Out of Stock (Hidden)'}`,
      updated ? 'success' : 'warning',
      'Stock Updated'
    );
  }

  openEditPrice(product: ProductItem): void {
    this.editingProduct = product;
    this.editingPriceValue = product.price;
    this.editingOwnerPriceValue = product.ownerPrice || Math.round(product.price * 0.85);
  }

  saveProductPrice(): void {
    if (this.editingProduct && this.editingPriceValue > 0) {
      this.dataService.updateProductPrice(this.editingProduct.id, this.editingPriceValue, this.editingOwnerPriceValue);
      this.toastService.show(`Prices updated: Retail ₹${this.editingPriceValue.toLocaleString()}, Partner ₹${this.editingOwnerPriceValue.toLocaleString()}`, 'success');
      this.editingProduct = null;
    }
  }

  // --- Services Management ---

  toggleServiceAvailability(service: ServiceBookingItem): void {
    this.dataService.toggleServiceAvailability(service.id);
    this.toastService.show(`${service.name} status updated`, 'info');
  }

  openEditServicePrice(service: ServiceBookingItem): void {
    this.editingService = service;
    this.editingServicePriceValue = service.startingPrice;
  }

  saveServicePrice(): void {
    if (this.editingService && this.editingServicePriceValue > 0) {
      this.dataService.updateServicePrice(this.editingService.id, this.editingServicePriceValue);
      this.toastService.show(`Service rate updated to ₹${this.editingServicePriceValue.toLocaleString()}`, 'success');
      this.editingService = null;
    }
  }

  // --- Shop Owners Management ---

  get filteredShopOwners(): ShopOwner[] {
    const list = this.dataService.shopOwners();
    if (this.ownerFilter === 'all') return list;
    return list.filter(o => o.status === this.ownerFilter);
  }

  openApproveOwner(owner: ShopOwner): void {
    this.approvingOwner = owner;
    this.approveEmail = owner.email;
    this.approvePassword = 'Owner@' + Math.floor(1000 + Math.random() * 9000);
    this.approveTier = owner.bulkDiscountTier || 'Silver (10% OFF)';
  }

  confirmApproveOwner(): void {
    if (!this.approvingOwner) return;
    if (!this.approveEmail.trim() || !this.approvePassword.trim()) {
      this.toastService.show('Please provide login email and temporary password for approval.', 'warning');
      return;
    }

    const approved = this.dataService.approveShopOwner(
      this.approvingOwner.id,
      this.approveEmail.trim(),
      this.approvePassword.trim(),
      this.approveTier
    );

    if (approved) {
      this.toastService.show(
        `${approved.shopName} approved as active wholesale partner! Credentials configured.`,
        'success',
        'Partner Approved'
      );

      // Auto-sync via CI/CD if GitHub is configured
      if (this.publishService.isConfigured()) {
        const files = [{
          path: 'public/data/shop-owners.json',
          content: JSON.stringify(this.dataService.shopOwners(), null, 2)
        }];
        this.publishService.publishAllAndTriggerPipeline(
          files,
          `feat(shop): approved wholesale partner ${approved.shopName}`,
          `Wholesale partner approved: ${approved.shopName}`
        ).then(res => {
          if (res.success) {
            this.toastService.show('Credentials pushed directly to GitHub and deployed via CI/CD!', 'info');
          }
        }).catch(err => console.warn('Auto publish failed:', err));
      }
    }
    this.approvingOwner = null;
  }

  closeApproveOwnerModal(): void {
    this.approvingOwner = null;
  }

  toggleOwnerStatus(owner: ShopOwner): void {
    this.dataService.toggleShopOwnerStatus(owner.id);
    const newStatus = owner.status === 'active' ? 'Suspended' : 'Active';
    this.toastService.show(`${owner.shopName} is now ${newStatus}`, 'info');
  }

  openEditOwner(owner: ShopOwner): void {
    this.editingOwner = owner;
    this.editOwnerEmail = owner.email;
    this.editOwnerPasswordPlain = owner.defaultPasswordPlain || 'Owner@HiTech123';
    this.editOwnerTier = owner.bulkDiscountTier || 'Gold (15% OFF)';
  }

  saveOwnerCredentials(): void {
    if (this.editingOwner) {
      this.dataService.updateShopOwnerCredentials(
        this.editingOwner.id,
        this.editOwnerEmail,
        this.editOwnerPasswordPlain,
        this.editOwnerTier
      );
      this.toastService.show(`Credentials updated for ${this.editingOwner.shopName}`, 'success');

      // Auto-sync via CI/CD if configured
      if (this.publishService.isConfigured()) {
        const files = [{
          path: 'public/data/shop-owners.json',
          content: JSON.stringify(this.dataService.shopOwners(), null, 2)
        }];
        this.publishService.publishAllAndTriggerPipeline(
          files,
          `feat(shop): updated credentials for ${this.editingOwner.shopName}`,
          `Shop credentials updated: ${this.editingOwner.shopName}`
        ).then(res => {
          if (res.success) {
            this.toastService.show('Updated credentials pushed to GitHub repo!', 'info');
          }
        }).catch(err => console.warn('Auto publish failed:', err));
      }

      this.editingOwner = null;
    }
  }

  copyCredentials(owner: ShopOwner): void {
    const text = `HiTech Shop Partner Access:\nOutlet: ${owner.shopName}\nLogin: ${owner.email}\nPassword: ${owner.defaultPasswordPlain || 'Owner@HiTech123'}\nWholesale Tier: ${owner.bulkDiscountTier}\nPortal: https://hitech.com/auth/login`;
    navigator.clipboard.writeText(text).then(() => {
      this.toastService.show('Credentials copied to clipboard! You can share them with the owner.', 'success');
    });
  }

  // --- Orders & Bookings Management ---

  updateOrderStatus(order: Order, event: Event): void {
    const select = event.target as HTMLSelectElement;
    const newStatus = select.value as Order['status'];
    this.orderService.updateOrderStatus(order.id, newStatus);
    this.toastService.show(`Order #${order.orderNumber} status changed to ${newStatus}`, 'info');
  }

  updateBookingStatus(booking: ServiceBookingRequest, event: Event): void {
    const select = event.target as HTMLSelectElement;
    const newStatus = select.value as ServiceBookingRequest['status'];
    this.orderService.updateBookingStatus(booking.id, newStatus);
    this.toastService.show(`Service #${booking.id} status changed to ${newStatus}`, 'info');
  }

  // --- GitHub Direct Publish & Backups ---

  openPatSetupModal(): void {
    this.githubConfig = this.publishService.getConfig();
    this.patVerificationMessage = '';
    this.showPatModal = true;
  }

  closePatSetupModal(): void {
    this.showPatModal = false;
  }

  async verifyAndSaveGithubConfig(): Promise<void> {
    if (!this.githubConfig.token?.trim()) {
      this.toastService.show('Please enter your GitHub Personal Access Token (PAT).', 'warning');
      return;
    }
    this.isVerifyingPat = true;
    this.patVerificationMessage = '';
    try {
      const res = await this.publishService.verifyConnection(this.githubConfig);
      this.patVerificationSuccess = res.success;
      this.patVerificationMessage = res.message;
      if (res.success) {
        this.publishService.saveConfig(this.githubConfig);
        this.toastService.show(res.message, 'success', 'GitHub Connected');
        setTimeout(() => {
          this.showPatModal = false;
        }, 1500);
      } else {
        this.toastService.show(res.message, 'danger', 'Verification Failed');
      }
    } catch (err: any) {
      this.patVerificationSuccess = false;
      this.patVerificationMessage = err?.message || 'Connection test failed';
      this.toastService.show(this.patVerificationMessage, 'danger');
    } finally {
      this.isVerifyingPat = false;
    }
  }

  saveGithubConfig(): void {
    this.publishService.saveConfig(this.githubConfig);
    this.toastService.show('GitHub configuration saved to this browser!', 'success');
  }

  openPublishConfirmation(mode: 'publish_catalog' | 'trigger_pipeline'): void {
    if (!this.publishService.isConfigured()) {
      this.toastService.show('Please configure your GitHub Personal Access Token (PAT) before publishing.', 'warning');
      this.openPatSetupModal();
      return;
    }
    this.publishModalMode = mode;
    this.publishFilesSummary = [
      { name: 'Products Catalog', path: 'public/data/products.json', count: this.dataService.products().length },
      { name: 'Accessories Catalog', path: 'public/data/accessories.json', count: this.dataService.accessories().length },
      { name: 'Repair Services', path: 'public/data/services.json', count: this.dataService.services().length },
      { name: 'Shop Owners Registry', path: 'public/data/shop-owners.json', count: this.dataService.shopOwners().length },
      { name: 'Customer Orders Ledger', path: 'public/data/orders.json', count: this.orderService.orders().length },
      { name: 'Service Bookings Ledger', path: 'public/data/bookings.json', count: this.orderService.bookings().length }
    ];
    this.showPublishModal = true;
  }

  closePublishConfirmation(): void {
    this.showPublishModal = false;
  }

  async confirmAndExecutePublish(): Promise<void> {
    this.showPublishModal = false;
    if (this.publishModalMode === 'publish_catalog') {
      await this.publishCatalogToGithub();
    } else {
      await this.triggerPipelineOnly();
    }
  }

  viewOrderStatusHistory(order: Order): void {
    this.selectedOrderForHistory = order;
  }

  closeOrderStatusHistory(): void {
    this.selectedOrderForHistory = null;
  }

  viewBookingStatusHistory(booking: ServiceBookingRequest): void {
    this.selectedBookingForHistory = booking;
  }

  closeBookingStatusHistory(): void {
    this.selectedBookingForHistory = null;
  }

  async publishCatalogToGithub(): Promise<void> {
    if (!this.publishService.isConfigured()) {
      this.toastService.show('Please provide a GitHub Personal Access Token (PAT) before publishing.', 'warning');
      return;
    }

    this.isPublishingGithub = true;
    try {
      const files = [
        {
          path: 'public/data/products.json',
          content: JSON.stringify(this.dataService.products(), null, 2)
        },
        {
          path: 'public/data/accessories.json',
          content: JSON.stringify(this.dataService.accessories(), null, 2)
        },
        {
          path: 'public/data/services.json',
          content: JSON.stringify(this.dataService.services(), null, 2)
        },
        {
          path: 'public/data/shop-owners.json',
          content: JSON.stringify(this.dataService.shopOwners(), null, 2)
        },
        {
          path: 'public/data/orders.json',
          content: JSON.stringify(this.orderService.orders(), null, 2)
        },
        {
          path: 'public/data/bookings.json',
          content: JSON.stringify(this.orderService.bookings(), null, 2)
        }
      ];

      const commitMsg = `feat(catalog): sync live catalog and orders from admin console [${new Date().toISOString()}]`;
      const res = await this.publishService.publishAllAndTriggerPipeline(
        files,
        commitMsg,
        'Admin Console Immediate Publish'
      );

      if (res.success) {
        this.toastService.show(res.message, 'success', 'Catalog & Orders Published & Pipeline Triggered');
        this.lastSyncTime = new Date().toLocaleTimeString();
        localStorage.setItem('hitech_last_sync_time', this.lastSyncTime);
      } else {
        this.toastService.show(res.message, 'danger', 'Publish Failed');
      }
    } catch (e: any) {
      this.toastService.show(e?.message || 'Publishing to GitHub failed', 'danger');
    } finally {
      this.isPublishingGithub = false;
    }
  }

  async syncOrdersToGithub(): Promise<void> {
    if (!this.publishService.isConfigured()) {
      this.toastService.show('Please configure your GitHub Personal Access Token (PAT) before syncing orders.', 'warning');
      return;
    }

    this.isSyncingOrders = true;
    try {
      const files = [
        {
          path: 'public/data/orders.json',
          content: JSON.stringify(this.orderService.orders(), null, 2)
        },
        {
          path: 'public/data/bookings.json',
          content: JSON.stringify(this.orderService.bookings(), null, 2)
        }
      ];

      const commitMsg = `sync(orders): backup ${this.orderService.orders().length} orders and ${this.orderService.bookings().length} bookings [${new Date().toISOString()}]`;
      const res = await this.publishService.publishFiles(files, commitMsg);

      if (res.success) {
        this.toastService.show(res.message, 'success', 'Orders & Bookings Synced to GitHub');
      } else {
        this.toastService.show(res.message, 'danger', 'Order Sync Failed');
      }
    } catch (e: any) {
      this.toastService.show(e?.message || 'Syncing orders failed', 'danger');
    } finally {
      this.isSyncingOrders = false;
    }
  }

  async triggerPipelineOnly(): Promise<void> {
    if (!this.publishService.isConfigured()) {
      this.toastService.show('Please provide a GitHub Personal Access Token (PAT) before triggering pipeline.', 'warning');
      return;
    }

    this.isTriggeringPipeline = true;
    try {
      const res = await this.publishService.triggerImmediatePipeline('Admin manual trigger from console');
      if (res.success) {
        this.toastService.show(res.message, 'success', 'CI/CD Pipeline Dispatched');
      } else {
        this.toastService.show(res.message, 'danger', 'Pipeline Trigger Failed');
      }
    } catch (e: any) {
      this.toastService.show(e?.message || 'Triggering pipeline failed', 'danger');
    } finally {
      this.isTriggeringPipeline = false;
    }
  }

  // --- Orders Export & Yearly Archiving ---

  exportOrders(): void {
    this.orderService.exportOrdersJson();
    this.toastService.show('Exported orders.json', 'success');
  }

  exportBookings(): void {
    this.orderService.exportBookingsJson();
    this.toastService.show('Exported bookings.json', 'success');
  }

  async runYearlyArchive(): Promise<void> {
    const currentOrders = this.orderService.orders().length;
    const currentBookings = this.orderService.bookings().length;

    if (currentOrders === 0 && currentBookings === 0) {
      this.toastService.show('No orders or bookings present to archive.', 'info');
      return;
    }

    const archiveYear = new Date().getFullYear();
    const confirmed = confirm(
      `Archive and reset orders for ${archiveYear}?\n\nThis will:\n1. Download full ${archiveYear} archive JSON\n2. Email backup to admin\n3. Clear active order & booking storage`
    );

    if (!confirmed) return;

    this.isArchivingOrders = true;
    try {
      const res = await this.orderService.archiveYearAndClear({ download: true, year: archiveYear });
      this.lastBackupYear = res.year;
      this.toastService.show(
        `Successfully archived ${res.orderCount} orders and ${res.bookingCount} bookings for ${res.year}. Storage cleared.`,
        'success',
        'Yearly Archive Complete'
      );
    } catch (e) {
      this.toastService.show('Failed to complete yearly archive.', 'danger');
    } finally {
      this.isArchivingOrders = false;
    }
  }

  // --- Service Center Hub Settings ---

  saveHubSettings(): void {
    this.distanceService.saveHubConfig(this.hubSettings);
    this.toastService.show('Service center hub location and radius updated!', 'success');
  }

  // --- Export & Reset ---

  exportData(type: 'products' | 'accessories' | 'services' | 'shop-owners'): void {
    this.dataService.exportDataJson(type);
    this.toastService.show(`Exported ${type}.json. Commit this file to GitHub for permanent site-wide updates.`, 'success');
  }

  resetAllData(): void {
    if (confirm('Are you sure you want to reset all modifications back to original JSON files?')) {
      this.dataService.resetAllData();
      this.toastService.show('All catalogs reset to bundled JSON defaults', 'info');
    }
  }

  exportAppLogs(): void {
    this.loggerService.exportLogsJson();
    this.toastService.show('Production error & activity logs downloaded', 'success');
  }

  clearAppLogs(): void {
    if (confirm('Clear all stored application logs from this browser?')) {
      this.loggerService.clearLogs();
      this.toastService.show('Application logs cleared', 'info');
    }
  }

  copyOrderTemplateHtml(): void {
    if (navigator?.clipboard?.writeText) {
      navigator.clipboard.writeText(ORDER_NOTIFICATION_TEMPLATE_HTML).then(() => {
        this.toastService.show('Order Notification HTML template copied to clipboard!', 'success');
      }).catch(() => {
        this.toastService.show('Please copy from email-templates/order-notification.html', 'info');
      });
    } else {
      this.toastService.show('Please copy from email-templates/order-notification.html', 'info');
    }
  }

  copyServiceTemplateHtml(): void {
    if (navigator?.clipboard?.writeText) {
      navigator.clipboard.writeText(SERVICE_BOOKING_TEMPLATE_HTML).then(() => {
        this.toastService.show('Service Booking HTML template copied to clipboard!', 'success');
      }).catch(() => {
        this.toastService.show('Please copy from email-templates/service-booking-notification.html', 'info');
      });
    } else {
      this.toastService.show('Please copy from email-templates/service-booking-notification.html', 'info');
    }
  }
}
