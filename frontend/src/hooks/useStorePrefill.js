import { useState } from 'react';


export const useStorePrefill = (storeId) => {
  const STORAGE_KEY = `logistics_last_used_${storeId}`;
  const [lastUsed, setLastUsed] = useState(() => {
    try {
      const data = localStorage.getItem(STORAGE_KEY);
      return data ? JSON.parse(data) : null;
    } catch {
      return null;
    }
  });

  const isPrefilled = !!lastUsed;

  const loadLastUsed = () => {
    try {
      const data = localStorage.getItem(STORAGE_KEY);
      if (data) {
        const parsed = JSON.parse(data);
        setLastUsed(parsed);
        return parsed;
      }
      setLastUsed(null);
      return null;
    } catch {
      return null;
    }
  };

  const saveCurrent = (data) => {
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(data));
      setLastUsed(data);
    } catch (error) {
      console.warn('Failed to save prefill data:', error);
    }
  };

  const clearPrefill = () => {
    try {
      localStorage.removeItem(STORAGE_KEY);
      setLastUsed(null);
    } catch (error) {
      console.warn('Failed to clear prefill data:', error);
    }
  };

  return {
    lastUsed,  // {driverName, driverPhone, driverId, modeOfTransport, vehicleNumber}
    isPrefilled,
    loadLastUsed,
    saveCurrent,
    clearPrefill
  };
};

