import { machines } from '../data/machines.js';
import { spares } from '../data/spares.js';

export const getMachinesByStore = (storeId) => {
  return machines.filter(machine => machine.store_id === storeId);
};

export const getSparesByStore = (storeId) => {
  return spares.filter(spare => spare.store_id === storeId);
};

export const getSparesByMachine = (machineId) => {
  return spares.filter(spare => spare.machine_id === machineId);
};

// Alert generation logic
export const generateAlerts = () => {
  const today = new Date();
  const thirtyDaysFromNow = new Date(today.getTime() + 30 * 24 * 60 * 60 * 1000);

  const lowStockMachines = machines.filter(m => m.quantity_available < m.minimum_required);
  const lowStockSpares = spares.filter(s => s.quantity_available < s.minimum_required);
  
  const expiredWarrantyMachines = machines.filter(m => new Date(m.warranty_expiry_date) < today);
  const expiredWarrantySpares = spares.filter(s => new Date(s.warranty_expiry_date) < today);
  
  const expiringSoonMachines = machines.filter(m => 
    new Date(m.warranty_expiry_date) <= thirtyDaysFromNow && 
    new Date(m.warranty_expiry_date) >= today
  );
  const expiringSoonSpares = spares.filter(s => 
    new Date(s.warranty_expiry_date) <= thirtyDaysFromNow && 
    new Date(s.warranty_expiry_date) >= today
  );

  return {
    lowStockMachines,
    lowStockSpares,
    expiredWarranty: [...expiredWarrantyMachines, ...expiredWarrantySpares],
    expiringSoon: [...expiringSoonMachines, ...expiringSoonSpares]
  };
};
