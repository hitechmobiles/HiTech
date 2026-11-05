import { Injectable, inject } from '@angular/core';
import { DOCUMENT } from '@angular/common';
import { Router, NavigationEnd } from '@angular/router';
import { filter } from 'rxjs/operators';
import { environment } from '../../../environments/environment';

declare global {
  interface Window {
    dataLayer: unknown[];
    gtag: (...args: unknown[]) => void;
  }
}

/**
 * Google Analytics 4 (GA4) service for tracking page views and custom events.
 * Automatically tracks SPA route changes via Angular Router.
 *
 * Usage:
 *   - Inject this service in AppComponent and call `initialize()` once.
 *   - Call `trackEvent()` anywhere to send custom events.
 */
@Injectable({
  providedIn: 'root'
})
export class AnalyticsService {
  private document = inject(DOCUMENT);
  private router = inject(Router);
  private initialized = false;

  private get measurementId(): string {
    return environment.ga?.measurementId ?? '';
  }

  /**
   * Initializes GA4 tracking. Call once from AppComponent.ngOnInit().
   * - Injects the gtag.js script into the document head
   * - Subscribes to Angular Router events for SPA page-view tracking
   */
  initialize(): void {
    if (this.initialized || !this.measurementId || typeof window === 'undefined') {
      return;
    }

    this.injectGtagScript();
    this.setupRouteTracking();
    this.initialized = true;
  }

  /**
   * Tracks a custom event in GA4.
   *
   * @param eventName - The event name (e.g., 'add_to_cart', 'book_service')
   * @param params - Optional event parameters
   *
   * @example
   *   this.analytics.trackEvent('add_to_cart', {
   *     item_name: 'iPhone 16 Pro Max',
   *     item_category: 'phone',
   *     value: 134900
   *   });
   */
  trackEvent(eventName: string, params: Record<string, unknown> = {}): void {
    if (typeof window !== 'undefined' && window.gtag) {
      window.gtag('event', eventName, params);
    }
  }

  /**
   * Tracks a page view manually (auto-tracked on route change, but
   * available for edge cases like modal navigations or virtual pages).
   */
  trackPageView(pageTitle: string, pagePath: string): void {
    if (typeof window !== 'undefined' && window.gtag) {
      window.gtag('event', 'page_view', {
        page_title: pageTitle,
        page_location: window.location.href,
        page_path: pagePath
      });
    }
  }

  // ── Private Helpers ──────────────────────────────────────────────

  private injectGtagScript(): void {
    // 1. Async script tag for gtag.js
    const script = this.document.createElement('script');
    script.async = true;
    script.src = `https://www.googletagmanager.com/gtag/js?id=${this.measurementId}`;
    this.document.head.appendChild(script);

    // 2. Inline config script
    const inlineScript = this.document.createElement('script');
    inlineScript.text = `
      window.dataLayer = window.dataLayer || [];
      function gtag(){dataLayer.push(arguments);}
      gtag('js', new Date());
      gtag('config', '${this.measurementId}', {
        send_page_view: false
      });
    `;
    this.document.head.appendChild(inlineScript);
  }

  private setupRouteTracking(): void {
    this.router.events
      .pipe(filter((e): e is NavigationEnd => e instanceof NavigationEnd))
      .subscribe((event: NavigationEnd) => {
        const pageUrl = event.urlAfterRedirects || event.url;
        const pageTitle = this.document.title;

        if (typeof window !== 'undefined' && window.gtag) {
          window.gtag('event', 'page_view', {
            page_title: pageTitle,
            page_location: `${window.location.origin}${pageUrl}`,
            page_path: pageUrl
          });
        }
      });
  }
}

