import { defineStore } from 'pinia';

export interface CartItem {
  productId: string;
  variantId: string | null;
  slug: string;
  name: string;
  variantName: string | null;
  price: number;
  image: string | null;
  quantity: number;
  maxQuantity: number; // stock cap at the time of adding
}

const STORAGE_KEY = 'atlas-cart-v1';

export const useCartStore = defineStore('cart', {
  state: () => ({
    items: [] as CartItem[],
    loaded: false,
  }),

  getters: {
    count: (state) => state.items.reduce((sum, i) => sum + i.quantity, 0),
    total: (state) =>
      Math.round(
        state.items.reduce((sum, i) => sum + i.price * i.quantity, 0) * 100
      ) / 100,
    isEmpty: (state) => state.items.length === 0,
  },

  actions: {
    load() {
      if (this.loaded || !import.meta.client) return;
      try {
        const raw = localStorage.getItem(STORAGE_KEY);
        if (raw) {
          const parsed = JSON.parse(raw);
          if (Array.isArray(parsed)) this.items = parsed;
        }
      } catch {
        this.items = [];
      }
      this.loaded = true;
    },

    persist() {
      if (!import.meta.client) return;
      localStorage.setItem(STORAGE_KEY, JSON.stringify(this.items));
    },

    add(item: Omit<CartItem, 'quantity'>, quantity = 1) {
      this.load();
      const existing = this.items.find(
        (i) => i.productId === item.productId && i.variantId === item.variantId
      );
      if (existing) {
        existing.quantity = Math.min(
          existing.quantity + quantity,
          existing.maxQuantity || 99,
          99
        );
      } else {
        this.items.push({
          ...item,
          quantity: Math.min(quantity, item.maxQuantity || 99, 99),
        });
      }
      this.persist();
    },

    setQuantity(productId: string, variantId: string | null, quantity: number) {
      const item = this.items.find(
        (i) => i.productId === productId && i.variantId === variantId
      );
      if (!item) return;
      if (quantity <= 0) {
        this.remove(productId, variantId);
        return;
      }
      item.quantity = Math.min(quantity, item.maxQuantity || 99, 99);
      this.persist();
    },

    remove(productId: string, variantId: string | null) {
      this.items = this.items.filter(
        (i) => !(i.productId === productId && i.variantId === variantId)
      );
      this.persist();
    },

    clear() {
      this.items = [];
      this.persist();
    },
  },
});
