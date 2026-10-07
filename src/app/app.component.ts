import { Component, OnInit, inject, DestroyRef } from '@angular/core';
import { CommonModule } from '@angular/common';
import { Router, RouterOutlet, NavigationEnd, ActivatedRoute } from '@angular/router';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { filter } from 'rxjs/operators';
import { HeaderComponent } from './shared/components/header/header.component';
import { FooterComponent } from './shared/components/footer/footer.component';
import { ToastService } from './core/services/toast.service';
import { SeoService } from './core/services/seo.service';

@Component({
  selector: 'app-root',
  standalone: true,
  imports: [CommonModule, RouterOutlet, HeaderComponent, FooterComponent],
  templateUrl: './app.component.html',
  styleUrls: ['./app.component.scss']
})
export class AppComponent implements OnInit {
  toastService = inject(ToastService);
  private seoService = inject(SeoService);
  private router = inject(Router);
  private destroyRef = inject(DestroyRef);

  ngOnInit(): void {
    this.router.events
      .pipe(
        filter((e): e is NavigationEnd => e instanceof NavigationEnd),
        takeUntilDestroyed(this.destroyRef)
      )
      .subscribe((event: NavigationEnd) => {
        this.updateRouteSeo(event.urlAfterRedirects || event.url);
      });
  }

  private updateRouteSeo(url: string): void {
    const cleanUrl = url.split('?')[0];

    if (cleanUrl === '/' || cleanUrl === '') {
      this.seoService.updateMeta({
        title: 'HiTech — Premium Mobiles, Accessories & Expert Repair Services',
        description: 'Explore flagship smartphones, certified mobile accessories, and book certified mobile repair technicians with doorstep pickup across Trichy.',
        canonicalUrl: '/'
      });
    } else if (cleanUrl === '/products') {
      this.seoService.updateMeta({
        title: 'Products & Accessories Catalog',
        description: 'Shop genuine smartphones, GaN fast chargers, tempered glass, cases, and audio accessories with warranty at HiTech.',
        canonicalUrl: '/products'
      });
    } else if (cleanUrl === '/services') {
      this.seoService.updateMeta({
        title: 'Certified Mobile Repair Services',
        description: 'Book certified mobile phone repair in Trichy: display replacement, battery revive, water damage ultrasonic cleaning with 6-month warranty.',
        canonicalUrl: '/services'
      });
    } else if (cleanUrl === '/register-shop') {
      this.seoService.updateMeta({
        title: 'B2B Wholesale Shop Registration',
        description: 'Register your mobile retail store with HiTech to unlock 10% to 20% wholesale bulk discounts, priority stock dispatch, and GST billing.',
        canonicalUrl: '/register-shop'
      });
    } else if (cleanUrl === '/cart') {
      this.seoService.updateMeta({
        title: 'Shopping Cart & Checkout',
        description: 'Review your selected smartphones, original accessories, and proceed to secure checkout with Cash on Delivery or UPI.',
        canonicalUrl: '/cart'
      });
    } else if (cleanUrl === '/favourites') {
      this.seoService.updateMeta({
        title: 'Saved Favourites & Wishlist',
        description: 'Your saved favorite smartphones and accessories at HiTech Mobiles.',
        canonicalUrl: '/favourites'
      });
    }
  }
}
