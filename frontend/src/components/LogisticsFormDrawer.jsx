import React, { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { useApp } from '../hooks/useApp';
import api from '../services/api';
import { Button, Input, Select, SelectContent, SelectItem, SelectTrigger, SelectValue, Toggle, ToggleGroup, Label, Textarea } from '../components/ui';
import { X, Truck, Send, Save, Loader2, Plus, Trash2 } from 'lucide-react';

const LogisticsFormDrawer = ({ isOpen, onClose, mode = 'transfer', onSuccess }) => {
  const { stores, spareParts } = useApp();
  const [formData, setFormData] = useState({
    type: 'transfer',
    fromStoreId: '',
    toStoreId: '',
    items: [],
    notes: '',
    isInstant: true,
    driver: { name: '', phone: '', driverId: '' },
    vehicleNumber: '',
    modeOfTransport: 'Truck',
    distanceKm: 0,
    dispatchDate: new Date().toISOString().slice(0, 16),
    expectedDeliveryDate: '',
  });
  const [loading, setLoading] = useState(false);
  const [items, setItems] = useState([]);

  useEffect(() => {
    if (isOpen) {
      setFormData(prev => ({
        ...prev,
        type: mode === 'shipment' ? 'outgoing' : 'transfer',
        isInstant: mode === 'transfer',
      }));
    }
  }, [isOpen, mode]);

  const handleSubmit = async (e) => {
    e.preventDefault();
    setLoading(true);
    try {
      const payload = {
        ...formData,
        isInstant: formData.isInstant || mode === 'transfer',
        items: items.map(item => ({
          spare_part_id: item.sparePartId,
          quantity: item.quantity,
        })),
      };
      if (mode === 'shipment') {
        payload.driver = formData.driver;
        payload.vehicle_number = formData.vehicleNumber;
        payload.mode_of_transport = formData.modeOfTransport;
        payload.distance_km = formData.distanceKm;
        payload.dispatch_date = formData.dispatchDate;
        payload.expected_delivery_date = formData.expectedDeliveryDate;
        payload.isInstant = false;
      }

      await api.post('/transfers', payload);
      onSuccess();
      onClose();
    } catch (error) {
      console.error('Failed to create transfer:', error);
    } finally {
      setLoading(false);
    }
  };

  const addItem = () => {
    setItems(prev => [...prev, { sparePartId: '', quantity: 1 }]);
  };

  const removeItem = (index) => {
    setItems(prev => prev.filter((_, i) => i !== index));
  };

  const updateItem = (index, field, value) => {
    setItems(prev => prev.map((item, i) => i === index ? { ...item, [field]: value } : item));
  };

  return (
    <AnimatePresence>
      {isOpen && (
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          className="fixed inset-0 z-50 overflow-hidden"
          onClick={onClose}
        >
          <motion.div
            initial={{ x: '100%' }}
            animate={{ x: 0 }}
            exit={{ x: '100%' }}
            transition={{ type: 'spring', bounce: 0 }}
            className="absolute right-0 top-0 h-full w-96 bg-white shadow-2xl border-l"
            onClick={e => e.stopPropagation()}
          >
            <div className="p-6 border-b flex justify-between items-center">
              <h2 className="text-xl font-bold">
                New {mode === 'transfer' ? 'Instant Transfer' : 'Shipment'}
              </h2>
              <Button variant="ghost" size="sm" onClick={onClose}>
                <X className="h-4 w-4" />
              </Button>
            </div>

            <form onSubmit={handleSubmit} className="p-6 space-y-6 overflow-y-auto max-h-[calc(100vh-120px)]">
              <div>
                <Label className="text-sm font-medium">From Store</Label>
                <Select value={formData.fromStoreId} onValueChange={(v) => setFormData(prev => ({ ...prev, fromStoreId: v }))}>
                  <SelectTrigger>
                    <SelectValue placeholder="Select source store" />
                  </SelectTrigger>
                  <SelectContent>
                    {stores.map(store => (
                      <SelectItem key={store.id} value={store.id}>{store.name}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              <div>
                <Label className="text-sm font-medium">To Store</Label>
                <Select value={formData.toStoreId} onValueChange={(v) => setFormData(prev => ({ ...prev, toStoreId: v }))}>
                  <SelectTrigger>
                    <SelectValue placeholder="Select destination store" />
                  </SelectTrigger>
                  <SelectContent>
                    {stores.map(store => (
                      <SelectItem key={store.id} value={store.id}>{store.name}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              <div>
                <Label className="text-sm font-medium flex items-center gap-2 mb-2">
                  Items <Button type="button" size="sm" variant="outline" onClick={addItem}><Plus className="h-3 w-3" /></Button>
                </Label>
                <div className="space-y-2">
                  {items.map((item, index) => (
                    <div key={index} className="flex gap-2 items-end p-3 border rounded-lg">
                      <Select value={item.sparePartId} onValueChange={(v) => updateItem(index, 'sparePartId', v)}>
                        <SelectTrigger className="flex-1">
                          <SelectValue placeholder="Part" />
                        </SelectTrigger>
                        <SelectContent>
                          {spareParts.map(part => (
                            <SelectItem key={part.id} value={part.id}>{part.name}</SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                      <Input
                        type="number"
                        placeholder="Qty"
                        value={item.quantity}
                        onChange={(e) => updateItem(index, 'quantity', parseInt(e.target.value) || 1)}
                        min={1}
                        className="w-20"
                      />
                      <Button type="button" variant="destructive" size="sm" onClick={() => removeItem(index)}>
                        <Trash2 className="h-3 w-3" />
                      </Button>
                    </div>
                  ))}
                </div>
              </div>

              {mode === 'shipment' && (
                <>
                  <div className="space-y-2">
                    <Label>Driver Details</Label>
                    <Input
                      placeholder="Driver Name"
                      value={formData.driver.name}
                      onChange={(e) => setFormData(prev => ({ ...prev, driver: { ...prev.driver, name: e.target.value } }))}
                    />
                    <div className="grid grid-cols-2 gap-2">
                      <Input
                        placeholder="Phone"
                        value={formData.driver.phone}
                        onChange={(e) => setFormData(prev => ({ ...prev, driver: { ...prev.driver, phone: e.target.value } }))}
                      />
                      <Input
                        placeholder="Driver ID"
                        value={formData.driver.driverId}
                        onChange={(e) => setFormData(prev => ({ ...prev, driver: { ...prev.driver, driverId: e.target.value } }))}
                      />
                    </div>
                  </div>

                  <div>
                    <Label>Vehicle</Label>
                    <Input
                      placeholder="Vehicle Number"
                      value={formData.vehicleNumber}
                      onChange={(e) => setFormData(prev => ({ ...prev, vehicleNumber: e.target.value }))}
                    />
                  </div>

                  <div className="grid grid-cols-2 gap-2">
                    <div>
                      <Label>Mode</Label>
                      <Select value={formData.modeOfTransport} onValueChange={(v) => setFormData(prev => ({ ...prev, modeOfTransport: v }))}>
                        <SelectTrigger>
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="Truck">Truck</SelectItem>
                          <SelectItem value="Air">Air</SelectItem>
                          <SelectItem value="Ship">Ship</SelectItem>
                          <SelectItem value="Train">Train</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>
                    <div>
                      <Label>Distance (km)</Label>
                      <Input
                        type="number"
                        placeholder="Distance"
                        value={formData.distanceKm}
                        onChange={(e) => setFormData(prev => ({ ...prev, distanceKm: parseFloat(e.target.value) || 0 }))}
                        min="0"
                      />
                    </div>
                  </div>

                  <div className="grid grid-cols-2 gap-2">
                    <div>
                      <Label>Dispatch Date</Label>
                      <Input
                        type="datetime-local"
                        value={formData.dispatchDate}
                        onChange={(e) => setFormData(prev => ({ ...prev, dispatchDate: e.target.value }))}
                      />
                    </div>
                    <div>
                      <Label>Expected Delivery</Label>
                      <Input
                        type="datetime-local"
                        value={formData.expectedDeliveryDate}
                        onChange={(e) => setFormData(prev => ({ ...prev, expectedDeliveryDate: e.target.value }))}
                      />
                    </div>
                  </div>
                </>
              )}

              <div>
                <Label>Notes</Label>
                <Textarea
                  placeholder="Additional notes..."
                  value={formData.notes}
                  onChange={(e) => setFormData(prev => ({ ...prev, notes: e.target.value }))}
                  rows={3}
                />
              </div>

              <div className="flex gap-3 pt-4">
                <Button type="button" variant="outline" className="flex-1" onClick={onClose}>
                  Cancel
                </Button>
                <Button type="submit" className="flex-1 bg-gradient-to-r from-blue-500 to-purple-600" disabled={loading}>
                  {loading ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Send className="mr-2 h-4 w-4" />}
                  {mode === 'transfer' ? 'Transfer Now' : 'Dispatch Shipment'}
                </Button>
              </div>
            </form>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );
};

export default LogisticsFormDrawer;

