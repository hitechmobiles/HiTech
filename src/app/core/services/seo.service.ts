import { Injectable, inject } from '@angular/core';
import { Title, Meta } from '@angular/platform-browser';
import { DOCUMENT } from '@angular/common';

export interface SeoConfig {
  title?: string;
  description?: string;
  keywords?: string;
  canonicalUrl?: string;
  ogImage?: string;
  ogType?: string;
}

@Injectable({
  providedIn: 'root'
})
export class SeoService {
  private titleService = inject(Title);
  private metaService = inject(Meta);
  private document = inject(DOCUMENT);

  private readonly defaultTitle = 'HiTech — Premium Mobiles, Accessories & Expert Repair Services';
  private readonly defaultDescription = 'Hi Tech Mobile Sales and Service — Your trusted destination for genuine smartphones, premium accessories, and certified mobile repair services with doorstep pickup in Maniyarampatti, Trichy.';
  private readonly defaultKeywords = 'mobile phones, phone repair Trichy, mobile accessories, screen replacement, battery repair, smartphone store Tamil Nadu, wholesale mobile spares';
  private readonly baseUrl = 'https://hitech-mobiles.vercel.app';

  /**
   * Updates page metadata, Open Graph, Twitter cards, and canonical link
   */
  updateMeta(config: SeoConfig = {}): void {
    const pageTitle = config.title ? `${config.title} | HiTech Mobiles` : this.defaultTitle;
    const description = config.description || this.defaultDescription;
    const keywords = config.keywords || this.defaultKeywords;
    const canonical = config.canonicalUrl ? `${this.baseUrl}${config.canonicalUrl}` : this.baseUrl;
    const ogImage = config.ogImage || `${this.baseUrl}/favicon.ico`;
    const ogType = config.ogType || 'website';

    // 1. Page Title
    this.titleService.setTitle(pageTitle);

    // 2. Primary Meta Tags
    this.metaService.updateTag({ name: 'description', content: description });
    this.metaService.updateTag({ name: 'keywords', content: keywords });

    // 3. Open Graph Tags
    this.metaService.updateTag({ property: 'og:title', content: pageTitle });
    this.metaService.updateTag({ property: 'og:description', content: description });
    this.metaService.updateTag({ property: 'og:url', content: canonical });
    this.metaService.updateTag({ property: 'og:image', content: ogImage });
    this.metaService.updateTag({ property: 'og:type', content: ogType });

    // 4. Twitter Card Tags
    this.metaService.updateTag({ name: 'twitter:title', content: pageTitle });
    this.metaService.updateTag({ name: 'twitter:description', content: description });
    this.metaService.updateTag({ name: 'twitter:image', content: ogImage });

    // 5. Canonical Link Tag
    this.updateCanonicalUrl(canonical);
  }

  private updateCanonicalUrl(url: string): void {
    let link: HTMLLinkElement | null = this.document.querySelector('link[rel="canonical"]');
    if (!link) {
      link = this.document.createElement('link');
      link.setAttribute('rel', 'canonical');
      this.document.head.appendChild(link);
    }
    link.setAttribute('href', url);
  }
}
