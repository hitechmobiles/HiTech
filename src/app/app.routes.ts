import { Routes } from '@angular/router';
import { adminGuard, ownerGuard } from './core/guards/auth.guard';

export const routes: Routes = [
  {
    path: '',
    loadComponent: () => import('./features/dashboard/dashboard.component').then(m => m.DashboardComponent),
    title: 'HiTech — Mobile Phones, Accessories & Repair Care'
  },
  {
    path: 'products',
    loadComponent: () => import('./features/products/products.component').then(m => m.ProductsComponent),
    title: 'Products & Accessories — HiTech'
  },
  {
    path: 'products/:id',
    loadComponent: () => import('./features/products/product-detail/product-detail.component').then(m => m.ProductDetailComponent),
    title: 'Product Specifications — HiTech'
  },
  {
    path: 'services',
    loadComponent: () => import('./features/services/services.component').then(m => m.ServicesComponent),
    title: 'Certified Phone Repair Services — HiTech'
  },
  {
    path: 'favourites',
    loadComponent: () => import('./features/favourites/favourites.component').then(m => m.FavouritesComponent),
    title: 'Saved Favourites — HiTech'
  },
  {
    path: 'cart',
    loadComponent: () => import('./features/cart/cart.component').then(m => m.CartComponent),
    title: 'Shopping Cart & Checkout — HiTech'
  },
  {
    path: 'order-success',
    loadComponent: () => import('./features/order-success/order-success.component').then(m => m.OrderSuccessComponent),
    title: 'Order Registered — HiTech'
  },
  {
    path: 'register-shop',
    loadComponent: () => import('./features/shop-registration/shop-registration.component').then(m => m.ShopRegistrationComponent),
    title: 'Register Your Shop (B2B Wholesale) — HiTech'
  },
  {
    path: 'auth/login',
    loadComponent: () => import('./features/auth/login/auth-login.component').then(m => m.AuthLoginComponent),
    title: 'Portal Login — HiTech'
  },
  {
    path: 'auth/verify-otp',
    loadComponent: () => import('./features/auth/verify-otp/auth-otp.component').then(m => m.AuthOtpComponent),
    title: 'Verify OTP — HiTech'
  },
  {
    path: 'admin',
    loadComponent: () => import('./features/admin/admin-dashboard.component').then(m => m.AdminDashboardComponent),
    canActivate: [adminGuard],
    title: 'Admin Console — HiTech'
  },
  {
    path: 'owner',
    loadComponent: () => import('./features/owner/owner-dashboard.component').then(m => m.OwnerDashboardComponent),
    canActivate: [ownerGuard],
    title: 'Shop Owner Partner Portal — HiTech'
  },
  {
    path: '**',
    loadComponent: () => import('./features/not-found/not-found.component').then(m => m.NotFoundComponent),
    title: '404 — Page Not Found | HiTech'
  }
];
