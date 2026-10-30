import { TestBed } from '@angular/core/testing';
import { ProductCardComponent } from './product-card.component';
import { provideRouter } from '@angular/router';
import { provideHttpClient } from '@angular/common/http';
import { ProductItem } from '../../../core/models/product.model';

describe('ProductCardComponent', () => {
  const mockProduct: ProductItem = {
    id: 'pc-test-1',
    name: 'Test Smartphone Pro',
    brand: 'TestBrand',
    category: 'phone',
    subCategory: 'Flagship Smartphone',
    price: 45000,
    originalPrice: 55000,
    rating: 4.5,
    reviewsCount: 200,
    image: 'https://example.com/phone.jpg',
    specs: { ram: '8GB', storage: '256GB', display: '6.7 AMOLED' },
    inStock: true,
    isFeatured: true,
    description: 'A premium test smartphone'
  };

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [ProductCardComponent],
      providers: [
        provideRouter([]),
        provideHttpClient()
      ]
    }).compileComponents();
  });

  it('should create with product input', () => {
    const fixture = TestBed.createComponent(ProductCardComponent);
    fixture.componentInstance.product = mockProduct;
    fixture.detectChanges();
    expect(fixture.componentInstance).toBeTruthy();
  });

  it('should display product name', () => {
    const fixture = TestBed.createComponent(ProductCardComponent);
    fixture.componentInstance.product = mockProduct;
    fixture.detectChanges();
    const compiled = fixture.nativeElement as HTMLElement;
    expect(compiled.querySelector('.product-name')?.textContent).toContain('Test Smartphone Pro');
  });

  it('should display product brand', () => {
    const fixture = TestBed.createComponent(ProductCardComponent);
    fixture.componentInstance.product = mockProduct;
    fixture.detectChanges();
    const compiled = fixture.nativeElement as HTMLElement;
    expect(compiled.querySelector('.badge-brand, .product-brand-tag')?.textContent).toContain('TestBrand');
  });

  it('should display product price', () => {
    const fixture = TestBed.createComponent(ProductCardComponent);
    fixture.componentInstance.product = mockProduct;
    fixture.detectChanges();
    const compiled = fixture.nativeElement as HTMLElement;
    expect(compiled.querySelector('.main-price')?.textContent).toContain('45,000');
  });

  it('should display original price when available', () => {
    const fixture = TestBed.createComponent(ProductCardComponent);
    fixture.componentInstance.product = mockProduct;
    fixture.detectChanges();
    const compiled = fixture.nativeElement as HTMLElement;
    expect(compiled.querySelector('.original-price')?.textContent).toContain('55,000');
  });

  it('should display product rating', () => {
    const fixture = TestBed.createComponent(ProductCardComponent);
    fixture.componentInstance.product = mockProduct;
    fixture.detectChanges();
    const compiled = fixture.nativeElement as HTMLElement;
    expect(compiled.querySelector('.rating-val')?.textContent).toContain('4.5');
  });

  it('should show "Featured" badge for featured products', () => {
    const fixture = TestBed.createComponent(ProductCardComponent);
    fixture.componentInstance.product = mockProduct;
    fixture.detectChanges();
    const compiled = fixture.nativeElement as HTMLElement;
    expect(compiled.querySelector('.badge-cyan, .badge-featured')?.textContent).toContain('Featured');
  });

  it('should show "Out of Stock" badge when not in stock', () => {
    const fixture = TestBed.createComponent(ProductCardComponent);
    fixture.componentInstance.product = { ...mockProduct, inStock: false, isFeatured: false };
    fixture.detectChanges();
    const compiled = fixture.nativeElement as HTMLElement;
    expect(compiled.querySelector('.badge-danger, .badge-stock-out')?.textContent).toContain('Out of Stock');
  });

  it('should show notify-me button and hide add-to-cart button when out of stock', () => {
    const fixture = TestBed.createComponent(ProductCardComponent);
    fixture.componentInstance.product = { ...mockProduct, inStock: false };
    fixture.detectChanges();
    const compiled = fixture.nativeElement as HTMLElement;
    const addBtn = compiled.querySelector('.add-cart-btn');
    const notifyBtn = compiled.querySelector('.btn-notify-me');
    expect(addBtn).toBeNull();
    expect(notifyBtn).toBeTruthy();
  });

  it('should have favourite toggle button', () => {
    const fixture = TestBed.createComponent(ProductCardComponent);
    fixture.componentInstance.product = mockProduct;
    fixture.detectChanges();
    const compiled = fixture.nativeElement as HTMLElement;
    expect(compiled.querySelector('.fav-toggle-btn')).toBeTruthy();
  });

  it('should call addToCart and show toast when add-to-cart button clicked', () => {
    const fixture = TestBed.createComponent(ProductCardComponent);
    fixture.componentInstance.product = mockProduct;
    fixture.detectChanges();

    spyOn(fixture.componentInstance.cartService, 'addToCart');
    spyOn(fixture.componentInstance.toastService, 'show');

    const addBtn = fixture.nativeElement.querySelector('.add-cart-btn') as HTMLButtonElement;
    addBtn.click();

    expect(fixture.componentInstance.cartService.addToCart).toHaveBeenCalledWith(mockProduct);
    expect(fixture.componentInstance.toastService.show).toHaveBeenCalled();
  });

  it('should show warning toast when trying to add out-of-stock product', () => {
    const fixture = TestBed.createComponent(ProductCardComponent);
    fixture.componentInstance.product = { ...mockProduct, inStock: false };
    fixture.detectChanges();

    spyOn(fixture.componentInstance.toastService, 'show');
    const fakeEvent = new MouseEvent('click');
    spyOn(fakeEvent, 'stopPropagation');

    fixture.componentInstance.addToCart(fakeEvent);
    expect(fixture.componentInstance.toastService.show).toHaveBeenCalledWith(
      'Item is currently out of stock.',
      'warning'
    );
  });

  it('should toggle favourite when fav button clicked', () => {
    const fixture = TestBed.createComponent(ProductCardComponent);
    fixture.componentInstance.product = mockProduct;
    fixture.detectChanges();

    spyOn(fixture.componentInstance.favService, 'toggleFavourite').and.returnValue(true);
    spyOn(fixture.componentInstance.toastService, 'show');

    const favBtn = fixture.nativeElement.querySelector('.fav-toggle-btn') as HTMLButtonElement;
    favBtn.click();

    expect(fixture.componentInstance.favService.toggleFavourite).toHaveBeenCalledWith(mockProduct);
    expect(fixture.componentInstance.toastService.show).toHaveBeenCalledWith(
      `Saved ${mockProduct.name} to favourites`,
      'info'
    );

    // Test removing from favourites
    (fixture.componentInstance.favService.toggleFavourite as jasmine.Spy).and.returnValue(false);
    favBtn.click();
    expect(fixture.componentInstance.toastService.show).toHaveBeenCalledWith(
      'Removed from favourites',
      'info'
    );
  });
});
