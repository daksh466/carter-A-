import React, { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { X, Search, MapPin, Phone, Mail, Building2 } from 'lucide-react';

const ShipmentTypeSelector = ({ stores = [], onSelect, isOpen = true }) => {
  const [searchTerm, setSearchTerm] = useState('');

  const filteredStores = stores.filter(store =>
    store.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
    (store.location && store.location.toLowerCase().includes(searchTerm.toLowerCase())) ||
    (store.address && store.address.toLowerCase().includes(searchTerm.toLowerCase()))
  );

  const handleStoreSelect = (store) => {
    onSelect({ store, type: 'all' });
    setSearchTerm('');
  };

  const colorPalette = [
    'from-blue-500 to-blue-600',
    'from-purple-500 to-purple-600',
    'from-pink-500 to-pink-600',
    'from-green-500 to-green-600',
    'from-orange-500 to-orange-600',
    'from-red-500 to-red-600',
    'from-indigo-500 to-indigo-600',
    'from-cyan-500 to-cyan-600',
  ];

  const getGradient = (index) => colorPalette[index % colorPalette.length];
  const getIconBg = (index) => {
    const bgColors = [
      'bg-blue-100 text-blue-600',
      'bg-purple-100 text-purple-600',
      'bg-pink-100 text-pink-600',
      'bg-green-100 text-green-600',
      'bg-orange-100 text-orange-600',
      'bg-red-100 text-red-600',
      'bg-indigo-100 text-indigo-600',
      'bg-cyan-100 text-cyan-600',
    ];
    return bgColors[index % bgColors.length];
  };

  return (
    <AnimatePresence>
      {isOpen && (
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          className="fixed inset-0 bg-black/40 backdrop-blur-sm z-50 flex items-center justify-center p-4"
        >
          <motion.div
            initial={{ opacity: 0, scale: 0.95, y: 20 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.95, y: 20 }}
            className="bg-white rounded-2xl shadow-2xl max-w-2xl w-full max-h-[80vh] flex flex-col overflow-hidden"
          >
            {/* Header */}
            <div className="bg-gradient-to-r from-blue-600 to-blue-700 px-8 py-6 text-white">
              <div className="flex items-center justify-between mb-4">
                <div className="flex items-center gap-3">
                  <div className="p-2 bg-white/20 rounded-lg">
                    <Building2 className="w-6 h-6" />
                  </div>
                  <div>
                    <h2 className="text-2xl font-bold">Select Store</h2>
                    <p className="text-blue-100 text-sm">Choose a store to view shipments</p>
                  </div>
                </div>
                <button
                  onClick={() => onSelect(null)}
                  className="p-2 hover:bg-white/10 rounded-lg transition-colors"
                >
                  <X className="w-6 h-6" />
                </button>
              </div>

              {/* Search Bar */}
              <div className="relative">
                <Search className="absolute left-3 top-3 w-5 h-5 text-blue-200" />
                <input
                  type="text"
                  placeholder="Search stores by name, location..."
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                  className="w-full pl-10 pr-4 py-3 bg-white/90 text-gray-900 rounded-lg focus:outline-none focus:ring-2 focus:ring-white placeholder-gray-500 text-sm"
                />
              </div>
            </div>

            {/* Stores Grid */}
            <div className="flex-1 overflow-y-auto p-6">
              {filteredStores.length > 0 ? (
                <motion.div
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 1 }}
                  className="grid grid-cols-1 md:grid-cols-2 gap-4"
                >
                  {filteredStores.map((store, index) => (
                    <motion.button
                      key={store.id}
                      initial={{ opacity: 0, y: 10 }}
                      animate={{ opacity: 1, y: 0 }}
                      transition={{ delay: index * 0.05 }}
                      onClick={() => handleStoreSelect(store)}
                      className="text-left group"
                    >
                      <div className={`bg-gradient-to-br ${getGradient(index)} rounded-xl p-1 shadow-lg hover:shadow-2xl transition-all duration-300 transform hover:scale-105 h-full`}>
                        <div className="bg-white rounded-[10px] p-5 h-full flex flex-col">
                          {/* Store Header */}
                          <div className="flex items-start gap-3 mb-3">
                            <div className={`p-3 rounded-lg ${getIconBg(index)}`}>
                              <Building2 className="w-5 h-5" />
                            </div>
                            <div className="flex-1">
                              <h3 className="font-bold text-gray-900 text-lg group-hover:text-blue-600 transition-colors">
                                {store.name}
                              </h3>
                              {store.location && (
                                <p className={`text-xs font-semibold bg-gradient-to-r ${getGradient(index)} bg-clip-text text-transparent mt-1`}>
                                  {store.location}
                                </p>
                              )}
                            </div>
                          </div>

                          {/* Store Details */}
                          <div className="space-y-2 flex-1">
                            {store.address && (
                              <div className="flex items-start gap-2">
                                <MapPin className="w-4 h-4 text-gray-400 mt-0.5 flex-shrink-0" />
                                <p className="text-sm text-gray-600">{store.address}</p>
                              </div>
                            )}
                            {store.phone && (
                              <div className="flex items-center gap-2">
                                <Phone className="w-4 h-4 text-gray-400 flex-shrink-0" />
                                <p className="text-sm text-gray-600">{store.phone}</p>
                              </div>
                            )}
                            {store.email && (
                              <div className="flex items-center gap-2">
                                <Mail className="w-4 h-4 text-gray-400 flex-shrink-0" />
                                <p className="text-sm text-gray-600">{store.email}</p>
                              </div>
                            )}
                          </div>

                          {/* Footer */}
                          <div className={`mt-4 pt-3 border-t border-gray-100 flex items-center justify-between`}>
                            <span className={`inline-block px-3 py-1 bg-gradient-to-r ${getGradient(index)} bg-clip-text text-transparent font-semibold text-xs`}>
                              Click to select
                            </span>
                            <div className={`w-2 h-2 rounded-full bg-gradient-to-r ${getGradient(index)}`}></div>
                          </div>
                        </div>
                      </div>
                    </motion.button>
                  ))}
                </motion.div>
              ) : (
                <motion.div
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 1 }}
                  className="flex flex-col items-center justify-center py-12"
                >
                  <div className="p-4 bg-gray-100 rounded-full mb-4">
                    <Search className="w-8 h-8 text-gray-400" />
                  </div>
                  <p className="text-gray-600 font-medium">No stores found</p>
                  <p className="text-gray-500 text-sm mt-1">Try adjusting your search terms</p>
                </motion.div>
              )}
            </div>

            {/* Footer Info */}
            {filteredStores.length > 0 && (
              <div className="border-t border-gray-200 px-6 py-3 bg-gray-50 text-xs text-gray-600 text-center">
                Showing <span className="font-semibold text-gray-900">{filteredStores.length}</span> of <span className="font-semibold text-gray-900">{stores.length}</span> stores
              </div>
            )}
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );
};

export default ShipmentTypeSelector;
