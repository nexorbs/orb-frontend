import { api } from "./client";
import type {
  User, Role, Permission, Store, Device,
  Category, Product, ProductPrice,
  InventoryMovement, StockResponse,
  SaleResponse, SaleDetailResponse,
  CashSession, Customer,
} from "./types";

export { authApi } from "./auth";
export type * from "./types";

// IAM
export const iamApi = {
  registerUser: (data: { name: string; first_surname: string; second_surname?: string; email: string; password: string }) =>
    api.post<User>("/users", data),
  listUsers: () => api.get<User[]>("/users"),
  listRoles: () => api.get<Role[]>("/roles"),
  createRole: (name: string) => api.post<Role>("/roles", { name }),
  assignRole: (userId: string, roleId: string) =>
    api.post<void>(`/users/${userId}/roles/${roleId}`),
  listPermissions: () => api.get<Permission[]>("/permissions"),
  createPermission: (name: string) => api.post<Permission>("/permissions", { name }),
  assignPermission: (roleId: string, permissionId: string) =>
    api.post<void>(`/roles/${roleId}/permissions/${permissionId}`),
};

// Stores
export const storesApi = {
  list: () => api.get<Store[]>("/stores"),
  create: (name: string, address?: string) => api.post<Store>("/stores", { name, address }),
  listDevices: (storeId: string) => api.get<Device[]>(`/stores/${storeId}/devices`),
  createDevice: (storeId: string, name: string) =>
    api.post<Device>(`/stores/${storeId}/devices`, { name }),
};

// Catalog
export const catalogApi = {
  listCategories: () => api.get<Category[]>("/categories"),
  createCategory: (name: string) => api.post<Category>("/categories", { name }),
  listProducts: () => api.get<Product[]>("/products"),
  createProduct: (data: { name: string; barcode?: string; description?: string; cost?: number; category_ids?: string[] }) =>
    api.post<Product>("/products", data),
  updateProduct: (productId: string, data: { name?: string; barcode?: string; description?: string; cost?: number }) =>
    api.put<Product>(`/products/${productId}`, data),
  assignCategory: (productId: string, categoryId: string) =>
    api.post<void>(`/products/${productId}/categories/${categoryId}`),
  removeCategory: (productId: string, categoryId: string) =>
    api.delete<void>(`/products/${productId}/categories/${categoryId}`),
  setPrice: (productId: string, storeId: string, price: number) =>
    api.post<ProductPrice>(`/products/${productId}/stores/${storeId}/price`, { price }),
};

// Inventory
export const inventoryApi = {
  createMovement: (data: { product_id: string; store_id: string; type: string; quantity: number }) =>
    api.post<InventoryMovement>("/inventory/movements", data),
  listByStore: (storeId: string) =>
    api.get<InventoryMovement[]>(`/inventory/movements/stores/${storeId}`),
  getStock: (productId: string, storeId: string) =>
    api.get<StockResponse>(`/inventory/stock/${productId}/stores/${storeId}`),
};

// Sales
export const salesApi = {
  create: (data: {
    store_id: string; user_id: string; device_id: string; folio?: string;
    items: { product_id: string; quantity: number; price: number }[];
    payments: { method: string; amount: number; reference?: string }[];
  }) => api.post<SaleDetailResponse>("/sales", data),
  listByStore: (storeId: string) => api.get<SaleResponse[]>(`/sales/stores/${storeId}`),
  getDetail: (saleId: string) => api.get<SaleDetailResponse>(`/sales/${saleId}`),
};

// Cash
export const cashApi = {
  openSession: (data: { store_id: string; user_id: string; device_id: string; opening_amount: number }) =>
    api.post<CashSession>("/cash/sessions", data),
  closeSession: (sessionId: string, data: { closing_amount: number; expected_amount: number }) =>
    api.post<CashSession>(`/cash/sessions/${sessionId}/close`, data),
  listByStore: (storeId: string) => api.get<CashSession[]>(`/cash/sessions/stores/${storeId}`),
  getSession: (sessionId: string) => api.get<CashSession>(`/cash/sessions/${sessionId}`),
};

// Customers
export const customersApi = {
  list: () => api.get<Customer[]>("/customers"),
  create: (data: { name: string; phone?: string; email?: string }) =>
    api.post<Customer>("/customers", data),
  get: (id: string) => api.get<Customer>(`/customers/${id}`),
};
