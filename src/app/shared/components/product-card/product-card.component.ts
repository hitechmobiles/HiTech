import { Component, Input, inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { RouterModule } from '@angular/router';
import { ProductItem } from '../../../core/models/product.model';
import { CartService } from '../../../core/services/cart.service';
import { FavouritesService } from '../../../core/services/favourites.service';
import { ToastService } from '../../../core/services/toast.service';

@Component({
  selector: 'app-product-card',
  standalone: true,
  imports: [CommonModule, RouterModule],
  templateUrl: './product-card.component.html',
  styleUrls: ['./product-card.component.scss']
})
export class ProductCardComponent {
  @Input({ required: true }) product!: ProductItem;

  cartService = inject(CartService);
  favService = inject(FavouritesService);
  toastService = inject(ToastService);

  get discountPercent(): number {
    if (this.product.originalPrice && this.product.originalPrice > this.product.price) {
      return Math.round((1 - this.product.price / this.product.originalPrice) * 100);
    }
    return 0;
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
}
