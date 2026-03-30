import { useMemo, useCallback } from 'react';

export const useStockValidation = (inventory = [], items = [], onItemsChange) => {
  const availableById = useMemo(() => {
    const map = new Map();
    inventory.forEach(item => {
      map.set(String(item.id), Number(item.quantity_available || item.quantity || 0));
    });
    return map;
  }, [inventory]);

  const rowStates = useMemo(() => {
    return items.map(item => {
      const available = Number(availableById.get(String(item.itemId)) || 0);
      const requested = Number(item.quantity || 0);
      const ratio = available > 0 ? requested / available : Infinity;
      
      let color = 'green'; // ratio <= 1
      let label = 'OK';
      if (ratio > 1) {
        color = 'red';
        label = 'Over stock';
      } else if (ratio >= 0.8) {
        color = 'yellow';
        label = 'Near limit';
      }

      return {
        available,
        requested,
        ratio,
        color,
        label,
        isValid: ratio <= 1
      };
    });
  }, [items, availableById]);

  const isFormValid = useMemo(() => {
    return rowStates.every(row => row.isValid);
  }, [rowStates]);

  const errorMsg = useMemo(() => {
    const invalid = rowStates.find(row => !row.isValid);
    return invalid ? `Insufficient stock for item: ${invalid.available} available` : '';
  }, [rowStates]);

  // Auto-correct on invalid input (optional optimistic)
  const handleQuantityChange = useCallback((index, newQty) => {
    const available = Number(availableById.get(String(items[index]?.itemId)) || 0);
    const safeQty = Math.min(Number(newQty) || 0, available);
    onItemsChange?.(prevItems => {
      const newItems = [...prevItems];
      newItems[index] = { ...newItems[index], quantity: safeQty };
      return newItems;
    });
  }, [items, availableById, onItemsChange]);

  return {
    availableById,
    rowStates,
    isFormValid,
    errorMsg,
    handleQuantityChange
  };
};

