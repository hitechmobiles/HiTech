import { Component, inject, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { ActivatedRoute, RouterModule } from '@angular/router';
import { DataService } from '../../core/services/data.service';
import { EmailService } from '../../core/services/email.service';
import { ToastService } from '../../core/services/toast.service';
import { ProductCardComponent } from '../../shared/components/product-card/product-card.component';
import { ProductItem } from '../../core/models/product.model';

@Component({
  selector: 'app-products',
  standalone: true,
  imports: [CommonModule, FormsModule, RouterModule, ProductCardComponent],
  templateUrl: './products.component.html',
  styleUrls: ['./products.component.scss']
})
export class ProductsComponent implements OnInit {
  dataService = inject(DataService);
  emailService = inject(EmailService);
  toastService = inject(ToastService);
  private route = inject(ActivatedRoute);

  selectedCategory: string = 'all';
  selectedSubCategory: string = 'all';
  selectedBrand: string = 'all';
  searchQuery: string = '';
  sortBy: 'featured' | 'price-asc' | 'price-desc' | 'rating' = 'featured';
  inStockOnly: boolean = false;

  readonly availableBrands = [
    'Apple', 'Ai+', 'HMD', 'Infinix', 'iQOO', 'itel', 'MIVI',
    'Motorola', 'Narzo', 'Nothing', 'OnePlus', 'OPPO', 'POCO',
    'Realme', 'Redmi', 'Samsung', 'Lava', 'Villaon', 'Vivo'
  ];

  readonly subCategories = [
    'Cases & Covers',
    'Chargers & Cables',
    'Audio & Earphones',
    'Screen Protectors',
    'Power Banks'
  ];

  // Request order form state when phone / product not found
  requestForm = {
    requestedProduct: '',
    customerName: '',
    customerPhone: '',
    customerEmail: '',
    preferredSpecs: '',
    customerNotes: ''
  };
  requestSubmitting: boolean = false;
  requestSubmitted: boolean = false;

  ngOnInit(): void {
    this.route.queryParams.subscribe(params => {
      if (params['category']) {
        this.selectedCategory = params['category'];
      }
      if (params['search']) {
        this.searchQuery = params['search'];
        this.requestForm.requestedProduct = params['search'];
      }
      if (params['brand']) {
        this.selectedBrand = params['brand'];
        this.selectedCategory = 'phone';
      }
    });
  }

  get filteredProducts(): ProductItem[] {
    let list = this.dataService.publicAllProducts();

    // Category filter
    if (this.selectedCategory === 'phone') {
      list = list.filter(p => p.category === 'phone');
    } else if (this.selectedCategory === 'accessory') {
      list = list.filter(p => p.category === 'accessory');
    }

    // Brand filter
    if (this.selectedBrand !== 'all') {
      list = list.filter(p => p.brand.toLowerCase() === this.selectedBrand.toLowerCase());
    }

    // Subcategory filter
    if (this.selectedSubCategory !== 'all') {
      list = list.filter(p => p.subCategory === this.selectedSubCategory);
    }

    // In Stock filter
    if (this.inStockOnly) {
      list = list.filter(p => p.inStock);
    }

    // Search query filter
    if (this.searchQuery.trim()) {
      const q = this.searchQuery.toLowerCase();
      list = list.filter(p =>
        p.name.toLowerCase().includes(q) ||
        p.brand.toLowerCase().includes(q) ||
        p.subCategory.toLowerCase().includes(q) ||
        p.description.toLowerCase().includes(q)
      );
    }

    // Sorting
    return list.sort((a, b) => {
      if (this.sortBy === 'price-asc') return a.price - b.price;
      if (this.sortBy === 'price-desc') return b.price - a.price;
      if (this.sortBy === 'rating') return b.rating - a.rating;
      return (b.isFeatured ? 1 : 0) - (a.isFeatured ? 1 : 0);
    });
  }

  resetFilters(): void {
    this.selectedCategory = 'all';
    this.selectedSubCategory = 'all';
    this.selectedBrand = 'all';
    this.searchQuery = '';
    this.inStockOnly = false;
    this.sortBy = 'featured';
    this.requestSubmitted = false;
  }

  getAccessoryCount(subCat: string): number {
    if (subCat === 'all') {
      return this.dataService.accessories().length;
    }
    return this.dataService.accessories().filter(a => a.subCategory === subCat).length;
  }

  initRequestForm(): void {
    this.requestForm.requestedProduct = this.searchQuery.trim() || '';
    this.requestSubmitted = false;
  }

  async submitProductRequest(): Promise<void> {
    if (!this.requestForm.requestedProduct.trim()) {
      this.toastService.show('Please enter the device name or model you are looking for.', 'warning');
      return;
    }
    if (!this.requestForm.customerName.trim() || !this.requestForm.customerPhone.trim()) {
      this.toastService.show('Please enter your name and contact phone number.', 'warning');
      return;
    }
    if (this.requestForm.customerPhone.trim().length < 10) {
      this.toastService.show('Please enter a valid 10-digit phone number.', 'warning');
      return;
    }

    this.requestSubmitting = true;
    try {
      await this.emailService.sendProductRequestNotification({
        requestedProduct: this.requestForm.requestedProduct.trim(),
        customerName: this.requestForm.customerName.trim(),
        customerPhone: this.requestForm.customerPhone.trim(),
        customerEmail: this.requestForm.customerEmail.trim() || undefined,
        preferredSpecs: this.requestForm.preferredSpecs.trim() || undefined,
        customerNotes: this.requestForm.customerNotes.trim() || undefined
      });

      this.requestSubmitted = true;
      this.toastService.show(
        `Order request for ${this.requestForm.requestedProduct} logged! We will reply shortly.`,
        'success',
        'Request Sent'
      );
    } catch {
      this.toastService.show('Failed to submit product request. Please try again.', 'danger');
    } finally {
      this.requestSubmitting = false;
    }
  }
}
