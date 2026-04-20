import { defineStore } from "pinia";
import { ref, computed } from "vue";
import type { Product, CashSession, Store, Device } from "../api/types";

export interface CartItem {
  product: Product;
  quantity: number;
  price: number;
}

export const usePosStore = defineStore("pos", () => {
  const selectedStore = ref<Store | null>(
    JSON.parse(localStorage.getItem("selected_store") ?? "null")
  );
  const selectedDevice = ref<Device | null>(
    JSON.parse(localStorage.getItem("selected_device") ?? "null")
  );
  const activeSession = ref<CashSession | null>(
    JSON.parse(localStorage.getItem("active_session") ?? "null")
  );
  const cart = ref<CartItem[]>([]);

  const cartTotal = computed(() =>
    cart.value.reduce((sum, i) => sum + i.quantity * i.price, 0)
  );

  const cartCount = computed(() =>
    cart.value.reduce((sum, i) => sum + i.quantity, 0)
  );

  function setStore(store: Store) {
    selectedStore.value = store;
    localStorage.setItem("selected_store", JSON.stringify(store));
  }

  function setDevice(device: Device) {
    selectedDevice.value = device;
    localStorage.setItem("selected_device", JSON.stringify(device));
  }

  function setSession(session: CashSession | null) {
    activeSession.value = session;
    if (session) localStorage.setItem("active_session", JSON.stringify(session));
    else localStorage.removeItem("active_session");
  }

  function addToCart(product: Product, price: number) {
    const existing = cart.value.find((i) => i.product.id === product.id);
    if (existing) {
      existing.quantity += 1;
    } else {
      cart.value.push({ product, quantity: 1, price });
    }
  }

  function removeFromCart(productId: string) {
    const idx = cart.value.findIndex((i) => i.product.id === productId);
    if (idx !== -1) cart.value.splice(idx, 1);
  }

  function updateQuantity(productId: string, quantity: number) {
    const item = cart.value.find((i) => i.product.id === productId);
    if (item) {
      if (quantity <= 0) removeFromCart(productId);
      else item.quantity = quantity;
    }
  }

  function clearCart() {
    cart.value = [];
  }

  return {
    selectedStore, selectedDevice, activeSession,
    cart, cartTotal, cartCount,
    setStore, setDevice, setSession,
    addToCart, removeFromCart, updateQuantity, clearCart,
  };
});
