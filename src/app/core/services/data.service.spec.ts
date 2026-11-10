import { TestBed } from '@angular/core/testing';
import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { DataService } from './data.service';
import { SupabaseService } from './supabase.service';
import { ProductItem } from '../models/product.model';
import { ServiceBookingItem } from '../models/service.model';
import { ShopOwner } from '../models/shop-owner.model';

describe('DataService', () => {
  let service: DataService;
  let httpMock: HttpTestingController;

  const mockProducts: ProductItem[] = [
    {
      id: 'p-1',
      name: 'Test Phone',
      brand: 'BrandA',
      category: 'phone',
      subCategory: 'Flagship',
      price: 50000,
      rating: 4.8,
      reviewsCount: 120,
      image: 'phone.jpg',
      specs: {},
      inStock: true,
      isFeatured: true,
      description: 'Phone description'
    }
  ];

  const mockAccessories: ProductItem[] = [
    {
      id: 'a-1',
      name: 'Test Charger',
      brand: 'BrandB',
      category: 'accessory',
      subCategory: 'Chargers',
      price: 1500,
      rating: 4.5,
      reviewsCount: 50,
      image: 'charger.jpg',
      specs: {},
      inStock: true,
      isFeatured: false,
      description: 'Charger description'
    }
  ];

  const mockServices: ServiceBookingItem[] = [
    {
      id: 's-1',
      name: 'Screen Repair',
      category: 'repair',
      icon: 'smartphone',
      startingPrice: 1999,
      estimatedTime: '2 hours',
      warrantyPeriod: '6 Months',
      description: 'Screen replacement',
      available: true,
      isPopular: false,
      includedPoints: ['Quality OEM Screen']
    }
  ];

  const mockShopOwners: ShopOwner[] = [
    {
      id: 'o-1',
      email: 'owner@test.com',
      defaultPasswordPlain: 'pass123',
      role: 'shopowner',
      shopName: 'Test Shop',
      ownerName: 'John',
      phone: '9876543210',
      location: 'City Center',
      shopPhoto: 'shop.jpg',
      gstNumber: 'GST123',
      status: 'active',
      registeredDate: '2026-01-01',
      bulkDiscountTier: 'Standard'
    }
  ];

  beforeEach(async () => {
    localStorage.clear();

    const mockSupabaseService = {
      getProducts: jasmine.createSpy('getProducts').and.callFake(() => {
        if (localStorage.getItem('hitech_custom_products')) {
          return Promise.resolve([]);
        }
        return Promise.resolve([...mockProducts, ...mockAccessories]);
      }),
      updateProduct: jasmine.createSpy('updateProduct').and.returnValue(Promise.resolve(null)),
      createProduct: jasmine.createSpy('createProduct').and.returnValue(Promise.resolve(null)),
      deleteProduct: jasmine.createSpy('deleteProduct').and.returnValue(Promise.resolve(null)),
      toggleStock: jasmine.createSpy('toggleStock').and.returnValue(Promise.resolve(null)),
      updateProductPrice: jasmine.createSpy('updateProductPrice').and.returnValue(Promise.resolve(null))
    };

    TestBed.configureTestingModule({
      providers: [
        provideHttpClient(),
        provideHttpClientTesting(),
        { provide: SupabaseService, useValue: mockSupabaseService },
        DataService
      ]
    });

    httpMock = TestBed.inject(HttpTestingController);
    service = TestBed.inject(DataService);

    await service.initData();

    const sReq = httpMock.match('data/services.json');
    sReq.forEach(req => req.flush(mockServices));

    const oReq = httpMock.match('data/shop-owners.json');
    oReq.forEach(req => req.flush(mockShopOwners));
  });

  afterEach(() => {
    httpMock.verify();
    localStorage.clear();
  });

  it('should be created and load data', () => {
    expect(service).toBeTruthy();
    expect(service.products().length).toBeGreaterThan(0);
    expect(service.accessories().length).toBeGreaterThan(0);
    expect(service.services().length).toBeGreaterThan(0);
    expect(service.shopOwners().length).toBeGreaterThan(0);
  });

  it('should compute allProducts and featuredProducts', () => {
    expect(service.allProducts().length).toBe(2);
    expect(service.featuredProducts().length).toBe(1);
    expect(service.featuredProducts()[0].id).toBe('p-1');
  });

  it('should compute activeShopOwners', () => {
    expect(service.activeShopOwners().length).toBe(1);
    expect(service.activeShopOwners()[0].id).toBe('o-1');
  });

  it('should toggle product availability for phone', () => {
    expect(service.products()[0].inStock).toBeTrue();
    service.toggleProductAvailability('p-1');
    expect(service.products()[0].inStock).toBeFalse();
    service.toggleProductAvailability('p-1');
    expect(service.products()[0].inStock).toBeTrue();
  });

  it('should toggle product availability for accessory', () => {
    expect(service.accessories()[0].inStock).toBeTrue();
    service.toggleProductAvailability('a-1');
    expect(service.accessories()[0].inStock).toBeFalse();
  });

  it('should update product price for phone', () => {
    service.updateProductPrice('p-1', 48000);
    expect(service.products()[0].price).toBe(48000);
  });

  it('should update product price for accessory', () => {
    service.updateProductPrice('a-1', 1200);
    expect(service.accessories()[0].price).toBe(1200);
  });

  it('should toggle service availability and update service price', () => {
    expect(service.services()[0].available).toBeTrue();
    service.toggleServiceAvailability('s-1');
    expect(service.services()[0].available).toBeFalse();

    service.updateServicePrice('s-1', 2499);
    expect(service.services()[0].startingPrice).toBe(2499);
  });

  it('should toggle shop owner status', () => {
    expect(service.shopOwners()[0].status).toBe('active');
    service.toggleShopOwnerStatus('o-1');
    expect(service.shopOwners()[0].status).toBe('suspended');
    service.toggleShopOwnerStatus('o-1');
    expect(service.shopOwners()[0].status).toBe('active');
  });

  it('should update shop owner credentials', () => {
    service.updateShopOwnerCredentials('o-1', 'newemail@test.com', 'newpass', 'Premium');
    const updated = service.shopOwners()[0];
    expect(updated.email).toBe('newemail@test.com');
    expect(updated.defaultPasswordPlain).toBe('newpass');
    expect(updated.bulkDiscountTier).toBe('Premium');
  });

  it('should register a new shop owner', () => {
    const initialCount = service.shopOwners().length;
    const newOwner = service.registerNewShopOwner({
      shopName: 'Green Mobile',
      ownerName: 'Alice',
      email: 'alice@shop.com',
      phone: '9988776655',
      location: 'South City',
      shopPhoto: 'shop.jpg'
    });

    expect(newOwner).toBeTruthy();
    expect(newOwner.email).toBe('alice@shop.com');
    expect(service.shopOwners().length).toBe(initialCount + 1);
  });

  it('should load from localStorage if present', async () => {
    localStorage.setItem('hitech_custom_products', JSON.stringify([{ id: 'stored-1', name: 'Stored Phone', inStock: true, price: 1000 }]));
    localStorage.setItem('hitech_custom_accessories', JSON.stringify([{ id: 'stored-2', name: 'Stored Acc', inStock: true, price: 500 }]));
    localStorage.setItem('hitech_custom_services', JSON.stringify([{ id: 'stored-3', name: 'Stored Srv', available: true, startingPrice: 300 }]));
    localStorage.setItem('hitech_custom_shopowners', JSON.stringify([{ id: 'stored-4', ownerName: 'Stored Owner', status: 'active' }]));

    await service.initData();

    expect(service.products()[0].id).toBe('stored-1');
    expect(service.accessories()[0].id).toBe('stored-2');
    expect(service.services()[0].id).toBe('stored-3');
    expect(service.shopOwners()[0].id).toBe('stored-4');
  });

  it('should reset all data', () => {
    spyOn(service, 'initData');
    service.resetAllData();
    expect(service.initData).toHaveBeenCalled();
  });

  it('should trigger JSON export for data types', () => {
    const createObjectURLSpy = spyOn(window.URL, 'createObjectURL').and.returnValue('blob:fake');
    const revokeObjectURLSpy = spyOn(window.URL, 'revokeObjectURL').and.callFake(() => {});

    service.exportDataJson('products');
    service.exportDataJson('accessories');
    service.exportDataJson('services');
    service.exportDataJson('shop-owners');

    expect(createObjectURLSpy).toHaveBeenCalledTimes(4);
    expect(revokeObjectURLSpy).toHaveBeenCalledTimes(4);
  });
});
