import { Component, inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { Router, RouterModule } from '@angular/router';
import { SeoService } from '../../core/services/seo.service';

@Component({
  selector: 'app-not-found',
  standalone: true,
  imports: [CommonModule, FormsModule, RouterModule],
  templateUrl: './not-found.component.html',
  styleUrls: ['./not-found.component.scss']
})
export class NotFoundComponent {
  private router = inject(Router);
  private seoService = inject(SeoService);

  searchQuery: string = '';

  constructor() {
    this.seoService.updateMeta({
      title: '404 — Quantum Signal Lost | HiTech',
      description: 'The requested page could not be located on the HiTech Mobile & Accessories platform.'
    });
  }

  handleSearch(): void {
    if (this.searchQuery.trim()) {
      this.router.navigate(['/products'], { queryParams: { search: this.searchQuery.trim() } });
    } else {
      this.router.navigate(['/products']);
    }
  }
}
