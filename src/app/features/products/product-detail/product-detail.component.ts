import { Component, inject, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { ActivatedRoute, RouterModule, Router } from '@angular/router';
import { DataService } from '../../../core/services/data.service';
import { CartService } from '../../../core/services/cart.service';
import { FavouritesService } from '../../../core/services/favourites.service';
import { ToastService } from '../../../core/services/toast.service';
import { SeoService } from '../../../core/services/seo.service';
import { ProductItem } from '../../../core/models/product.model';

@Component({
  selector: 'app-product-detail',
  standalone: true,
  imports: [CommonModule, RouterModule],
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

  product: ProductItem | null = null;
  quantity: number = 1;

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
}
