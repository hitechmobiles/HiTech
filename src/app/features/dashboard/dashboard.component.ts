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
    { name: 'Apple', query: 'Apple', code: 'apple', label: 'APPLE' },
    { name: 'Ai+', query: 'Ai+', code: 'aiplus', label: 'Ai+' },
    { name: 'HMD', query: 'HMD', code: 'hmd', label: 'HMD' },
    { name: 'Infinix', query: 'Infinix', code: 'infinix', label: 'Infinix' },
    { name: 'iQOO', query: 'iQOO', code: 'iqoo', label: 'iQOO' },
    { name: 'itel', query: 'itel', code: 'itel', label: 'itel' },
    { name: 'MIVI', query: 'MIVI', code: 'mivi', label: 'MIVI' },
    { name: 'Motorola', query: 'Motorola', code: 'moto', label: 'MOTO' },
    { name: 'Narzo', query: 'Narzo', code: 'narzo', label: 'narzo' },
    { name: 'Nothing', query: 'Nothing', code: 'nothing', label: 'NOTHING' },
    { name: 'OnePlus', query: 'OnePlus', code: 'oneplus', label: 'ONEPLUS' },
    { name: 'OPPO', query: 'OPPO', code: 'oppo', label: 'oppo' },
    { name: 'POCO', query: 'POCO', code: 'poco', label: 'POCO' },
    { name: 'Realme', query: 'Realme', code: 'realme', label: 'realme' },
    { name: 'Redmi', query: 'Redmi', code: 'redmi', label: 'Redmi' },
    { name: 'Samsung', query: 'Samsung', code: 'samsung', label: 'SAMSUNG' },
    { name: 'Lava', query: 'Lava', code: 'lava', label: 'LAVA' },
    { name: 'Villaon', query: 'Villaon', code: 'villaon', label: 'VILLAON' },
    { name: 'Vivo', query: 'Vivo', code: 'vivo', label: 'vivo' }
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
