import { Component, inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { RouterModule, Router } from '@angular/router';
import { DataService } from '../../core/services/data.service';
import { ProductCardComponent } from '../../shared/components/product-card/product-card.component';
import { ServiceCardComponent } from '../../shared/components/service-card/service-card.component';
import { ServiceBookingItem } from '../../core/models/service.model';

@Component({
  selector: 'app-dashboard',
  standalone: true,
  imports: [CommonModule, RouterModule, ProductCardComponent, ServiceCardComponent],
  templateUrl: './dashboard.component.html',
  styleUrls: ['./dashboard.component.scss']
})
export class DashboardComponent {
  dataService = inject(DataService);
  private router = inject(Router);

  activeTab: 'all' | 'phone' | 'accessory' = 'all';

  get displayedProducts() {
    if (this.activeTab === 'phone') {
      return this.dataService.publicProducts().slice(0, 6);
    }
    if (this.activeTab === 'accessory') {
      return this.dataService.publicAccessories().slice(0, 6);
    }
    return this.dataService.publicAllProducts().slice(0, 8);
  }

  get popularServices() {
    return this.dataService.services().slice(0, 4);
  }

  readonly smartphoneBrands = [
    { name: 'Apple', query: 'Apple', code: 'apple', label: 'APPLE', tagline: 'iPhone 15 & 16 Series' },
    { name: 'Ai+', query: 'Ai+', code: 'aiplus', label: 'Ai+', tagline: 'Nova & Pulse 5G' },
    { name: 'HMD', query: 'HMD', code: 'hmd', label: 'HMD', tagline: 'Vibe2 5G' },
    { name: 'Infinix', query: 'Infinix', code: 'infinix', label: 'Infinix', tagline: 'Note Edge & Hot 60i' },
    { name: 'iQOO', query: 'iQOO', code: 'iQOO', label: 'iQOO', tagline: 'Z11 & Z11x 5G' },
    { name: 'itel', query: 'itel', code: 'itel', label: 'itel', tagline: 'A100 & Care 2800' },
    { name: 'MIVI', query: 'MIVI', code: 'MIVI', label: 'MIVI', tagline: 'MIVI One 5G' },
    { name: 'Motorola', query: 'Motorola', code: 'moto', label: 'MOTO', tagline: 'Edge 60 & G37 5G' },
    { name: 'Narzo', query: 'Narzo', code: 'narzo', label: 'narzo', tagline: '90x & 100x 5G' },
    { name: 'Nothing', query: 'Nothing', code: 'nothing', label: 'NOTHING', tagline: 'Phone 2a & 3a Lite' },
    { name: 'OnePlus', query: 'OnePlus', code: 'oneplus', label: 'ONEPLUS', tagline: 'Nord CE6 & N6 5G' },
    { name: 'OPPO', query: 'OPPO', code: 'oppo', label: 'oppo', tagline: 'F33 & F35 Pro 5G' },
    { name: 'POCO', query: 'POCO', code: 'poco', label: 'POCO', tagline: 'M8 & M8 Power 5G' },
    { name: 'Realme', query: 'Realme', code: 'realme', label: 'realme', tagline: '16 Pro+ & P4x 5G' },
    { name: 'Redmi', query: 'Redmi', code: 'redmi', label: 'Redmi', tagline: '17 & Note 17 5G' },
    { name: 'Samsung', query: 'Samsung', code: 'samsung', label: 'SAMSUNG', tagline: 'Galaxy A17 & M06' },
    { name: 'Lava', query: 'Lava', code: 'lava', label: 'LAVA', tagline: 'Virat V1 & Smart 4' },
    { name: 'Villaon', query: 'Villaon', code: 'villaon', label: 'VILLAON', tagline: 'F30 & X50 5G' },
    { name: 'Vivo', query: 'Vivo', code: 'vivo', label: 'vivo', tagline: 'T5 Pro & V-Series' }
  ];

  setTab(tab: 'all' | 'phone' | 'accessory'): void {
    this.activeTab = tab;
  }

  onBookService(service: ServiceBookingItem): void {
    this.router.navigate(['/services'], { queryParams: { selectedService: service.id } });
  }

  navigateToBrand(brandQuery: string): void {
    this.router.navigate(['/products'], { queryParams: { brand: brandQuery, category: 'phone' } });
  }
}
