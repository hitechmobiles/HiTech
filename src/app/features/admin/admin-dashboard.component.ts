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

  activeTab: 'products' | 'pricing' | 'owners' | 'orders' | 'settings' = 'products';
  pricingCategoryTab: 'phones' | 'accessories' | 'services' = 'phones';
  searchQuery: string = '';
  ownerFilter: 'all' | 'pending' | 'active' | 'suspended' = 'all';
  ordersSubTab: 'orders' | 'services' | 'restock' = 'orders';
  notifyRequests: Array<{ productId?: string; productName: string; customerName: string; customerPhone: string; customerEmail?: string; timestamp: string }> = [];

  // --- Product Add / Edit Modal State ---
  showProductModal: boolean = false;
  isEditingProduct: boolean = false;
  productForm = {
    id: '',
    name: '',
    brand: '',
    category: 'phone' as 'phone' | 'accessory',
    subCategory: 'Smartphones',
    price: 0,
    originalPrice: 0,
    image: '',
    description: '',
    isFeatured: false,
    inStock: true,
    ram: '',
    storage: '',
    display: '',
    battery: '',
    camera: '',
    compatibleWith: ''
  };

  // Quick Price Edit Modal
  editingProduct: ProductItem | null = null;
  editingPriceValue: number = 0;

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

  setTab(tab: 'products' | 'pricing' | 'owners' | 'orders' | 'settings'): void {
    this.activeTab = tab;
    if (tab === 'orders') {
      this.loadNotifyRequests();
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
      originalPrice: 0,
      image: 'https://images.unsplash.com/photo-1592750475338-74b7b21085ab?auto=format&fit=crop&w=800&q=80',
      description: '',
      isFeatured: false,
      inStock: true,
      ram: '8 GB',
      storage: '128 GB',
      display: '6.1-inch OLED 120Hz',
      battery: '4500 mAh',
      camera: '50MP + 12MP',
      compatibleWith: ''
    };
    this.showProductModal = true;
  }

  openEditProductFull(product: ProductItem): void {
    this.isEditingProduct = true;
    this.productForm = {
      id: product.id,
      name: product.name,
      brand: product.brand,
      category: product.category,
      subCategory: product.subCategory,
      price: product.price,
      originalPrice: product.originalPrice || product.price,
      image: product.image,
      description: product.description || '',
      isFeatured: !!product.isFeatured,
      inStock: product.inStock,
      ram: product.specs?.ram || '',
      storage: product.specs?.storage || '',
      display: product.specs?.display || '',
      battery: product.specs?.battery || '',
      camera: product.specs?.camera || '',
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

  saveProductForm(): void {
    if (!this.productForm.name.trim() || !this.productForm.brand.trim() || this.productForm.price <= 0) {
      this.toastService.show('Please provide a valid Product Name, Brand, and Price.', 'warning');
      return;
    }

    if (!this.productForm.image.trim()) {
      this.toastService.show('Please provide an image URL.', 'warning');
      return;
    }

    let specs: ProductSpecs | undefined;
    if (this.productForm.category === 'phone') {
      specs = {
        ram: this.productForm.ram,
        storage: this.productForm.storage,
        display: this.productForm.display,
        battery: this.productForm.battery,
        camera: this.productForm.camera
      };
    }

    if (this.isEditingProduct) {
      const updatedItem: ProductItem = {
        id: this.productForm.id,
        name: this.productForm.name,
        brand: this.productForm.brand,
        category: this.productForm.category,
        subCategory: this.productForm.subCategory,
        price: this.productForm.price,
        originalPrice: this.productForm.originalPrice || this.productForm.price,
        rating: 4.5,
        reviewsCount: 0,
        image: this.productForm.image,
        description: this.productForm.description,
        isFeatured: this.productForm.isFeatured,
        inStock: this.productForm.inStock,
        specs,
        compatibleWith: this.productForm.compatibleWith
      };
      this.dataService.updateProduct(updatedItem);
      this.toastService.show(`${updatedItem.name} updated successfully!`, 'success', 'Product Updated');
    } else {
      const created = this.dataService.addProduct({
        name: this.productForm.name,
        brand: this.productForm.brand,
        category: this.productForm.category,
        subCategory: this.productForm.subCategory,
        price: this.productForm.price,
        originalPrice: this.productForm.originalPrice || this.productForm.price,
        rating: 4.8,
        reviewsCount: 1,
        image: this.productForm.image,
        description: this.productForm.description,
        isFeatured: this.productForm.isFeatured,
        inStock: this.productForm.inStock,
        specs,
        compatibleWith: this.productForm.compatibleWith
      });
      this.toastService.show(`${created.name} added to catalog!`, 'success', 'Product Created');
    }

    this.showProductModal = false;
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
  }

  saveProductPrice(): void {
    if (this.editingProduct && this.editingPriceValue > 0) {
      this.dataService.updateProductPrice(this.editingProduct.id, this.editingPriceValue);
      this.toastService.show(`Price updated to ₹${this.editingPriceValue.toLocaleString()}`, 'success');
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
