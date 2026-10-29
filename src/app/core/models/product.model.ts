export interface ProductSpecs {
  ram?: string;
  storage?: string;
  display?: string;
  battery?: string;
  camera?: string;
  processor?: string;
  os?: string;
  connectivity?: string;
  warranty?: string;
}

export interface ProductImageView {
  id: string;
  label: string;
  type: 'front' | 'back' | 'angle' | 'specs';
  url: string;
  caption: string;
}

export interface ProductItem {
  id: string;
  name: string;
  brand: string;
  category: 'phone' | 'accessory';
  subCategory: string;
  price: number;
  originalPrice?: number;
  rating: number;
  reviewsCount: number;
  image: string;
  images?: string[];
  views?: ProductImageView[];
  specs?: ProductSpecs;
  compatibleWith?: string;
  inStock: boolean;
  isFeatured?: boolean;
  description: string;
  bulkDiscountPercent?: number;
}

export interface CartItem {
  product: ProductItem;
  quantity: number;
  selectedPrice: number;
}
