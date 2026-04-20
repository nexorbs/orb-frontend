// IAM
export interface User {
  id: string;
  name: string;
  first_surname: string;
  second_surname?: string;
  email: string;
  created_at: string;
}

export interface Role {
  id: string;
  name: string;
  created_at: string;
}

export interface Permission {
  id: string;
  name: string;
  created_at: string;
}

// Stores
export interface Store {
  id: string;
  name: string;
  address?: string;
  created_at: string;
}

export interface Device {
  id: string;
  store_id: string;
  name: string;
  created_at: string;
}

// Catalog
export interface Category {
  id: string;
  name: string;
  created_at: string;
}

export interface Product {
  id: string;
  name: string;
  barcode?: string;
  description?: string;
  cost?: number;
  created_at: string;
}

export interface ProductPrice {
  id: string;
  product_id: string;
  store_id: string;
  price: number;
  created_at: string;
}

// Inventory
export interface InventoryMovement {
  id: string;
  product_id: string;
  store_id: string;
  type: string;
  quantity: number;
  reference_id?: string;
  created_at: string;
}

export interface StockResponse {
  product_id: string;
  store_id: string;
  quantity: number;
}

// Sales
export interface SaleResponse {
  id: string;
  store_id: string;
  user_id: string;
  device_id: string;
  folio?: string;
  total: number;
  status: string;
}

export interface SaleItemResponse {
  id: string;
  product_id: string;
  quantity: number;
  price: number;
  subtotal: number;
}

export interface PaymentResponse {
  id: string;
  method: string;
  amount: number;
}

export interface SaleDetailResponse {
  sale: SaleResponse;
  items: SaleItemResponse[];
  payments: PaymentResponse[];
}

// Cash
export interface CashSession {
  id: string;
  store_id: string;
  user_id: string;
  device_id: string;
  status: string;
  opening_amount: number;
  closing_amount?: number;
  expected_amount?: number;
  opened_at: string;
  closed_at?: string;
}

// Customers
export interface Customer {
  id: string;
  name: string;
  phone?: string;
  email?: string;
  created_at: string;
}
