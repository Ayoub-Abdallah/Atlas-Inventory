interface SaleItem {
  id: string;
  productId: string;
  variantId?: string;
  productName: string;
  variantName?: string;
  sku?: string;
  quantity: number;
  unitPrice: number;
  unitCost: number;
  taxRate: number;
  lineTotal: number;
}

interface SaleDraft {
  id?: string;
  supplierId?: string;
  supplierName?: string;
  items: SaleItem[];
  notes?: string;
}

const STORAGE_KEY = 'openstock_sale_draft';

export function useSaleDraft() {
  const draft = useState<SaleDraft>('saleDraft', () => ({
    items: [],
  }));

  const isLoaded = ref(false);

  // Load draft from sessionStorage on mount
  const loadDraft = () => {
    if (typeof window === 'undefined') return;
    
    try {
      const stored = sessionStorage.getItem(STORAGE_KEY);
      if (stored) {
        const parsed = JSON.parse(stored);
        draft.value = parsed;
      }
    } catch (e) {
      console.error('Failed to load sale draft:', e);
    }
    isLoaded.value = true;
  };

  // Save draft to sessionStorage
  const saveDraft = () => {
    if (typeof window === 'undefined') return;
    
    try {
      sessionStorage.setItem(STORAGE_KEY, JSON.stringify(draft.value));
    } catch (e) {
      console.error('Failed to save sale draft:', e);
    }
  };

  // Add item to draft
  const addItem = (item: Omit<SaleItem, 'id' | 'lineTotal'>) => {
    // Check if item already exists (same product and variant)
    const existingIndex = draft.value.items.findIndex(
      i => i.productId === item.productId && i.variantId === item.variantId
    );

    if (existingIndex >= 0) {
      // Update quantity
      const existingItem = draft.value.items[existingIndex];
      if (existingItem) {
        existingItem.quantity += item.quantity;
        existingItem.lineTotal = existingItem.quantity * existingItem.unitPrice;
      }
    } else {
      // Add new item
      const newItem: SaleItem = {
        ...item,
        id: `item_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
        lineTotal: item.quantity * item.unitPrice,
      };
      draft.value.items.push(newItem);
    }

    saveDraft();
  };

  // Update item quantity
  const updateItemQuantity = (itemId: string, quantity: number) => {
    const index = draft.value.items.findIndex(i => i.id === itemId);
    if (index >= 0) {
      if (quantity <= 0) {
        draft.value.items.splice(index, 1);
      } else {
        const item = draft.value.items[index];
        if (item) {
          item.quantity = quantity;
          item.lineTotal = quantity * item.unitPrice;
        }
      }
      saveDraft();
    }
  };

  // Remove item
  const removeItem = (itemId: string) => {
    const index = draft.value.items.findIndex(i => i.id === itemId);
    if (index >= 0) {
      draft.value.items.splice(index, 1);
      saveDraft();
    }
  };

  // Set supplier
  const setSupplier = (supplierId: string, supplierName: string) => {
    draft.value.supplierId = supplierId;
    draft.value.supplierName = supplierName;
    saveDraft();
  };

  // Clear supplier
  const clearSupplier = () => {
    draft.value.supplierId = undefined;
    draft.value.supplierName = undefined;
    saveDraft();
  };

  // Set notes
  const setNotes = (notes: string) => {
    draft.value.notes = notes;
    saveDraft();
  };

  // Clear draft
  const clearDraft = () => {
    draft.value = { items: [] };
    if (typeof window !== 'undefined') {
      sessionStorage.removeItem(STORAGE_KEY);
    }
  };

  // Computed values for easier access
  const items = computed(() => draft.value.items);
  const selectedSupplierId = computed({
    get: () => draft.value.supplierId || null,
    set: (value: string | null) => {
      draft.value.supplierId = value || undefined;
      saveDraft();
    },
  });
  const notes = computed({
    get: () => draft.value.notes || '',
    set: (value: string) => {
      draft.value.notes = value;
      saveDraft();
    },
  });

  const subtotal = computed(() => 
    draft.value.items.reduce((sum, item) => sum + item.lineTotal, 0)
  );

  const taxTotal = computed(() =>
    draft.value.items.reduce((sum, item) => 
      sum + (item.lineTotal * (item.taxRate / 100)), 0)
  );

  const taxAmount = taxTotal; // Alias

  // Total is just subtotal - no automatic tax added
  const total = computed(() => subtotal.value);

  const totalCost = computed(() =>
    draft.value.items.reduce((sum, item) => 
      sum + (item.unitCost * item.quantity), 0)
  );

  const itemCount = computed(() => 
    draft.value.items.reduce((sum, item) => sum + item.quantity, 0)
  );

  const isEmpty = computed(() => draft.value.items.length === 0);

  // Create sale from draft
  const createSale = async () => {
    if (isEmpty.value) {
      throw new Error('Cannot create sale with no items');
    }

    const saleData = {
      supplierId: draft.value.supplierId,
      notes: draft.value.notes,
      items: draft.value.items.map(item => ({
        productId: item.productId,
        variantId: item.variantId,
        quantity: item.quantity,
        unitPrice: item.unitPrice,
        unitCost: item.unitCost,
        taxRate: item.taxRate,
      })),
    };

    const sale = await $fetch('/api/sales', {
      method: 'POST',
      body: saleData,
    });

    return sale;
  };

  // Remove item by productId and variantId (for draft.vue compatibility)
  const removeItemByProduct = (productId: string, variantId: string | null) => {
    const index = draft.value.items.findIndex(
      i => i.productId === productId && (i.variantId || null) === variantId
    );
    if (index >= 0) {
      draft.value.items.splice(index, 1);
      saveDraft();
    }
  };

  // Update quantity by productId and variantId (for draft.vue compatibility)
  const updateQuantity = (productId: string, variantId: string | null, quantity: number) => {
    const index = draft.value.items.findIndex(
      i => i.productId === productId && (i.variantId || null) === variantId
    );
    if (index >= 0) {
      if (quantity <= 0) {
        draft.value.items.splice(index, 1);
      } else {
        const item = draft.value.items[index];
        if (item) {
          item.quantity = quantity;
          item.lineTotal = quantity * item.unitPrice;
        }
      }
      saveDraft();
    }
  };

  // Update unit price by productId and variantId (for discounts)
  const updateItemPrice = (productId: string, variantId: string | null, newPrice: number) => {
    const index = draft.value.items.findIndex(
      i => i.productId === productId && (i.variantId || null) === variantId
    );
    if (index >= 0) {
      const item = draft.value.items[index];
      if (item && newPrice > 0) {
        item.unitPrice = newPrice;
        item.lineTotal = item.quantity * newPrice;
        saveDraft();
      }
    }
  };

  // Update unit price by item id
  const updateItemPriceById = (itemId: string, newPrice: number) => {
    const index = draft.value.items.findIndex(i => i.id === itemId);
    if (index >= 0) {
      const item = draft.value.items[index];
      if (item && newPrice > 0) {
        item.unitPrice = newPrice;
        item.lineTotal = item.quantity * newPrice;
        saveDraft();
      }
    }
  };

  // Initialize on mount
  onMounted(() => {
    loadDraft();
  });

  return {
    draft: readonly(draft),
    isLoaded,
    // Direct computed refs for template binding
    items,
    selectedSupplierId,
    notes,
    // Item operations
    addItem,
    updateItemQuantity,
    updateQuantity,
    updateItemPrice,
    updateItemPriceById,
    removeItem,
    removeItemByProduct,
    // Supplier operations
    setSupplier,
    clearSupplier,
    setNotes,
    clearDraft,
    createSale,
    // Computed totals
    subtotal,
    taxAmount,
    taxTotal,
    total,
    totalCost,
    itemCount,
    isEmpty,
  };
}
