export interface Product {
  id: string;
  name: string;
  price: number;
  image: string;
  images?: string[];
  hoverImage?: string;
  category: string;
  description: string;
  features: string[];
  colors: string[];
  tags?: string[];
  isNew?: boolean;
  isBestseller?: boolean;
}

export interface Category {
  id: string;
  name: string;
  image: string;
  description: string;
}

export interface CartItem {
  product: Product;
  quantity: number;
  color?: string;
}

export interface Order {
  id: string;
  date: string;
  items: CartItem[];
  total: number;
  status: 'processing' | 'shipped' | 'delivered';
  shippingCompany?: string;
  shippingTrackingNo?: string;
}

export interface User {
  id: string;
  email: string;
  firstName: string;
  lastName: string;
  phone?: string;
  gender?: string;
  addresses: Address[];
}

export interface Address {
  id: string;
  firstName: string;
  lastName: string;
  phone: string;
  street: string;
  province: string;
  district: string;
  neighborhood: string;
  isDefault: boolean;
}

export interface AdminOrderCustomer {
  firstName: string;
  lastName: string;
  email: string;
  phone: string;
  address: {
    firstName: string;
    lastName: string;
    phone: string;
    street: string;
    province: string;
    district: string;
    neighborhood: string;
  } | null;
}

export interface AdminOrder extends Order {
  shippingCompany?: string;
  shippingTrackingNo?: string;
  customer: AdminOrderCustomer;
}

export interface AdminContactRequest {
  id: string;
  name: string;
  email: string;
  subject: string;
  message: string;
  createdAt: string;
}
