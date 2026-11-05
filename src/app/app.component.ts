import { Component, OnInit, inject, DestroyRef, HostListener } from '@angular/core';
import { CommonModule } from '@angular/common';
import { Router, RouterOutlet, NavigationEnd, ActivatedRoute } from '@angular/router';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { filter } from 'rxjs/operators';
import { HeaderComponent } from './shared/components/header/header.component';
import { FooterComponent } from './shared/components/footer/footer.component';
import { ToastService } from './core/services/toast.service';
import { SeoService } from './core/services/seo.service';
import { AnalyticsService } from './core/services/analytics.service';

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
  private analyticsService = inject(AnalyticsService);
  private router = inject(Router);
  private destroyRef = inject(DestroyRef);

  showScrollTop: boolean = false;

  @HostListener('window:scroll')
  onWindowScroll(): void {
    if (typeof window !== 'undefined') {
      const scrollY = window.pageYOffset || document.documentElement.scrollTop || document.body.scrollTop || 0;
      this.showScrollTop = scrollY > 280;
    }
  }

  scrollToTop(): void {
    if (typeof window !== 'undefined') {
      window.scrollTo({
        top: 0,
        left: 0,
        behavior: 'smooth'
      });
    }
  }

  ngOnInit(): void {
    // Initialize Google Analytics 4 tracking
    this.analyticsService.initialize();

    this.router.events
      .pipe(
        filter((e): e is NavigationEnd => e instanceof NavigationEnd),
        takeUntilDestroyed(this.destroyRef)
      )
      .subscribe((event: NavigationEnd) => {
        // Universal scroll restoration: every page starts cleanly at the top
        if (typeof window !== 'undefined') {
          window.scrollTo({ top: 0, left: 0, behavior: 'instant' });
          document.documentElement.scrollTop = 0;
          document.body.scrollTop = 0;
        }
        this.updateRouteSeo(event.urlAfterRedirects || event.url);
      });
  }

  private updateRouteSeo(url: string): void {
    const cleanUrl = url.split('?')[0];

    if (cleanUrl === '/' || cleanUrl === '') {
      this.seoService.updateMeta({
        title: 'HiTech Mobiles Trichy — Buy Phones, Accessories & Repair Service',
        description: 'Hi Tech Mobile Sales and Service — Your trusted destination for genuine flagship smartphones, certified mobile repair with doorstep pickup, and premium accessories in Maniyarampatti, Trichy.',
        canonicalUrl: '/'
      });
    } else if (cleanUrl === '/products') {
      this.seoService.updateMeta({
        title: 'Mobile Phones & Accessories — HiTech Mobiles Trichy',
        description: 'Shop genuine smartphones from Apple, Samsung, OnePlus, Vivo, Realme, Redmi and premium accessories like GaN fast chargers, tempered glass, and cases at HiTech Mobiles Trichy.',
        canonicalUrl: '/products'
      });
    } else if (cleanUrl === '/services') {
      this.seoService.updateMeta({
        title: 'Phone Repair Service in Trichy — Screen & Battery — HiTech Mobiles',
        description: 'Book certified mobile phone repair in Trichy — display replacement, battery revival, water damage cleaning with 6-month warranty and free doorstep pickup across Maniyarampatti.',
        canonicalUrl: '/services'
      });
    } else if (cleanUrl === '/register-shop') {
      this.seoService.updateMeta({
        title: 'B2B Wholesale Mobile Registration — HiTech Mobiles Trichy',
        description: 'Register your mobile retail store with HiTech to unlock 10% to 20% wholesale bulk discounts, priority stock dispatch, and GST billing.',
        canonicalUrl: '/register-shop'
      });
    } else if (cleanUrl === '/cart') {
      this.seoService.updateMeta({
        title: 'Shopping Cart & Checkout — HiTech Mobiles',
        description: 'Review your selected smartphones, original accessories, and proceed to secure checkout with Cash on Delivery or UPI.',
        canonicalUrl: '/cart'
      });
    } else if (cleanUrl === '/favourites') {
      this.seoService.updateMeta({
        title: 'Saved Favourites & Wishlist — HiTech Mobiles',
        description: 'Your saved favorite smartphones and accessories at HiTech Mobiles Trichy.',
        canonicalUrl: '/favourites'
      });
    }
  }
}
