export interface Product {
  id: string;
  name: string;
  price: number;
  stock?: number | null;
  barcode?: string | null;
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

export type DiscountType = "percentage" | "fixed";

export interface AppliedAbandonedCartCoupon {
  code: string;
  type: DiscountType;
  value: number;
  minimumSubtotal: number;
  description: string;
  discountAmount: number;
  subtotal: number;
  shippingAmount: number;
  totalBeforeDiscount: number;
  totalAfterDiscount: number;
}

export interface Order {
  id: string;
  date: string;
  items: CartItem[];
  total: number;
  subtotal?: number;
  shippingTotal?: number;
  discountTotal?: number;
  couponCode?: string;
  status: 'processing' | 'shipped' | 'delivered';
  shippingCompany?: string;
  shippingTrackingNo?: string;
  shippingAddress?: {
    addressName?: string;
    firstName: string;
    lastName: string;
    phone: string;
    street: string;
    province: string;
    district: string;
    neighborhood: string;
  };
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

export interface AdminOrderTimelineEvent {
  id: string;
  type: "created" | "processing" | "shipped" | "delivered";
  createdAt: string;
  note?: string;
  shippingCompany?: string;
  shippingTrackingNo?: string;
}

export interface AdminOrderShipment {
  provider: string;
  status: "created" | "failed";
  referenceId?: string;
  postNumber?: string;
  carrierName?: string;
  trackingUrl?: string;
  barcodeUrl?: string;
  errorMessage?: string;
  createdAt?: string;
  updatedAt?: string;
}

export interface AdminOrder extends Order {
  shippingCompany?: string;
  shippingTrackingNo?: string;
  shipment?: AdminOrderShipment | null;
  customer: AdminOrderCustomer;
  timeline: AdminOrderTimelineEvent[];
}

export interface AdminContactRequest {
  id: string;
  name: string;
  email: string;
  subject: string;
  message: string;
  createdAt: string;
}

export interface AdminUserSummary {
  id: string;
  firstName: string;
  lastName: string;
  email: string;
  phone: string;
  createdAt: string;
}

export interface AdminAbandonedCartSettings {
  enabled: boolean;
  delayMinutes: number;
  subject: string;
  heading: string;
  body: string;
  ctaLabel: string;
  couponEnabled: boolean;
  couponCode: string;
  couponType: DiscountType;
  couponValue: number;
  couponMinimumSubtotal: number;
  couponDescription: string;
}

export interface AdminAbandonedCartStats {
  eligibleUsers: number;
  sentLast7Days: number;
  lastSentAt: string | null;
  mailConfigured: boolean;
}

export interface AdminAbandonedCartCampaignResponse {
  settings: AdminAbandonedCartSettings;
  stats: AdminAbandonedCartStats;
}

export interface AdminCustomerCouponSettings {
  id?: string;
  enabled: boolean;
  code: string;
  type: DiscountType;
  value: number;
  minimumSubtotal: number;
  description: string;
  createdAt?: string;
  updatedAt?: string;
}

export interface AdminAbandonedCartRunSummary {
  enabled: boolean;
  scanned: number;
  eligible: number;
  sent: number;
  skipped: number;
  failed: number;
  message: string;
}
