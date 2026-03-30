import React, { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import useApp from "../hooks/useApp";
import MachineCard from "../components/MachineCard";
import AddMachineModal from "../components/AddMachineModal";

/**
 * Machines page: displays list of machines with search functionality.
 * Clicking a machine navigates to details page.
 */
const Machines = () => {
  const navigate = useNavigate();
  const [isAddModalOpen, setIsAddModalOpen] = useState(false);
  const [localSearch, setLocalSearch] = useState("");
  const [sortBy, setSortBy] = useState("status");
  const [selectedMachine, setSelectedMachine] = useState(null);
  const [deletingMachineIds, setDeletingMachineIds] = useState({});
  const [toast, setToast] = useState(null);
  const { 
    filteredMachines, 
    searchQuery,
    storeLoading,
    storeError,
    deleteMachineError,
    handleDeleteMachine
  } = useApp();

  const getMachineId = (machine, index) => String(machine?.id || machine?._id || `machine-${index}`);

  const getMachineStatusScore = (machine) => {
    const quantity = Number(machine?.quantity ?? machine?.quantity_available ?? 0);
    const minRequired = Number(machine?.minRequired ?? machine?.minimumRequired ?? machine?.minimum_required ?? 0);
    if (quantity <= 0) return 3;
    if (minRequired > 0 && quantity < minRequired) return 2;
    return 1;
  };

  const processedMachines = (Array.isArray(filteredMachines) ? filteredMachines : [])
    .filter((machine) => {
      const globalQuery = String(searchQuery || "").toLowerCase();
      const localQuery = String(localSearch || "").toLowerCase();
      const name = String(machine?.name || "").toLowerCase();
      return (!globalQuery || name.includes(globalQuery)) && (!localQuery || name.includes(localQuery));
    })
    .sort((a, b) => {
      if (sortBy === "quantity") {
        const aq = Number(a?.quantity ?? a?.quantity_available ?? 0);
        const bq = Number(b?.quantity ?? b?.quantity_available ?? 0);
        return bq - aq;
      }
      if (sortBy === "status") {
        return getMachineStatusScore(b) - getMachineStatusScore(a);
      }
      const aw = String(a?.warrantyStatus ?? a?.warranty ?? a?.warrantyExpiryDate ?? "").toLowerCase();
      const bw = String(b?.warrantyStatus ?? b?.warranty ?? b?.warrantyExpiryDate ?? "").toLowerCase();
      return aw.localeCompare(bw);
    });

  const stats = processedMachines.reduce(
    (acc, machine) => {
      const quantity = Number(machine?.quantity ?? machine?.quantity_available ?? 0);
      const minRequired = Number(machine?.minRequired ?? machine?.minimumRequired ?? machine?.minimum_required ?? 0);
      acc.total += 1;
      if (quantity <= 0) acc.critical += 1;
      else if (minRequired > 0 && quantity < minRequired) acc.low += 1;
      else acc.healthy += 1;
      return acc;
    },
    { total: 0, healthy: 0, low: 0, critical: 0 }
  );

  const handleMachineClick = (machineId) => {
    navigate(`/dashboard/machines/${machineId}`);
  };

  useEffect(() => {
    if (!deleteMachineError) return;
    setToast({ type: "error", message: deleteMachineError });
  }, [deleteMachineError]);

  useEffect(() => {
    if (!toast) return undefined;
    const timer = setTimeout(() => setToast(null), 2400);
    return () => clearTimeout(timer);
  }, [toast]);

  const handleDeleteMachineClick = async (machine, machineId) => {
    if (!machineId || machineId.startsWith("machine-")) {
      setToast({ type: "error", message: "Invalid machine ID" });
      return;
    }

    const confirmed = window.confirm("Are you sure you want to delete this machine?");
    if (!confirmed) return;

    setDeletingMachineIds((prev) => ({ ...prev, [machineId]: true }));
    const result = await handleDeleteMachine(machineId);

    if (result?.success) {
      if (String(selectedMachine?.id || selectedMachine?._id || "") === machineId) {
        setSelectedMachine(null);
      }
      setToast({ type: "success", message: `Machine \"${machine?.name || "Unnamed Machine"}\" deleted` });
    } else {
      setToast({ type: "error", message: result?.error || "Failed to delete machine" });
    }

    setDeletingMachineIds((prev) => {
      const next = { ...prev };
      delete next[machineId];
      return next;
    });
  };

  // Show loading state
  if (storeLoading) {
    return (
      <div style={{ width: '100%', minHeight: 'calc(100vh - 64px)', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', padding: '32px 24px' }}>
        <div style={{ fontSize: 48, marginBottom: 16 }}>⏳</div>
        <h2 style={{ color: '#fff', fontSize: 24, marginBottom: 8 }}>Loading...</h2>
        <p style={{ color: '#aaa', fontSize: 14 }}>Fetching machine data...</p>
      </div>
    );
  }

  return (
    <div className="machines-dashboard page-enter">
      <div className="machines-dashboard-inner">
      <div className="machines-header-row">
        <div>
          <h2 className="machines-title">Machines</h2>
          <p className="machines-subtitle">Premium fleet overview with actionable insights and stock health.</p>
        </div>
        <button className="machines-add-btn" onClick={() => setIsAddModalOpen(true)}>
          + Add Machine
        </button>
      </div>

      <div className="machines-insights-grid">
        <div className="machines-insight-card">
          <p>Total Machines</p>
          <h3>{stats.total}</h3>
        </div>
        <div className="machines-insight-card machines-insight-healthy">
          <p>Healthy</p>
          <h3>{stats.healthy}</h3>
        </div>
        <div className="machines-insight-card machines-insight-low">
          <p>Low Stock</p>
          <h3>{stats.low}</h3>
        </div>
        <div className="machines-insight-card machines-insight-critical">
          <p>Critical</p>
          <h3>{stats.critical}</h3>
        </div>
      </div>

      <div className="machines-toolbar">
        <input
          value={localSearch}
          onChange={(e) => setLocalSearch(e.target.value)}
          placeholder="Search machines"
          className="machines-search-input"
        />
        <select value={sortBy} onChange={(e) => setSortBy(e.target.value)} className="machines-sort-select">
          <option value="status">Sort: Status</option>
          <option value="quantity">Sort: Quantity</option>
          <option value="warranty">Sort: Warranty</option>
        </select>
      </div>
      
      {/* Show error notification if any */}
      {storeError && (
        <div className="machines-error-banner">
          <strong>⚠️ Note:</strong> {storeError}
        </div>
      )}
      
      {searchQuery && (
        <p className="machines-global-filter-note">
          Showing results for "{searchQuery}"
        </p>
      )}

      {toast && (
        <div className={`machines-toast machines-toast-${toast.type === "success" ? "success" : "error"}`}>
          {toast.message}
        </div>
      )}

      {processedMachines.length === 0 ? (
        <div className="machines-empty-state">
          {searchQuery || localSearch ? 'No machines match your filters.' : 'No machine data available.'}
        </div>
      ) : (
        <div className="machines-grid">
          {processedMachines.map((machine, index) => {
            const machineId = getMachineId(machine, index);
            return (
            <div key={machineId}>
              <MachineCard
                machine={machine}
                onEdit={() => handleMachineClick(machineId)}
                onDelete={() => handleDeleteMachineClick(machine, machineId)}
                deleteLoading={Boolean(deletingMachineIds[machineId])}
                onViewDetails={() => setSelectedMachine(machine)}
              />
            </div>
            );
          })}
        </div>
      )}
      </div>

      {selectedMachine && (
        <div className="machines-details-modal-backdrop" onClick={() => setSelectedMachine(null)}>
          <div className="machines-details-modal" onClick={(e) => e.stopPropagation()}>
            <h3>{selectedMachine.name || "Machine Details"}</h3>
            <div className="machines-details-grid">
              <div><span>Quantity</span><strong>{Number(selectedMachine.quantity ?? selectedMachine.quantity_available ?? 0)}</strong></div>
              <div><span>Min Required</span><strong>{Number(selectedMachine.minRequired ?? selectedMachine.minimumRequired ?? selectedMachine.minimum_required ?? 0)}</strong></div>
              <div><span>Warranty</span><strong>{selectedMachine.warrantyStatus ?? selectedMachine.warranty ?? selectedMachine.warrantyExpiryDate ?? "N/A"}</strong></div>
              <div><span>Status</span><strong>{getMachineStatusScore(selectedMachine) > 1 ? "LOW STOCK" : "ACTIVE"}</strong></div>
            </div>
            <div className="machines-details-actions">
              <button className="machines-modal-btn" onClick={() => setSelectedMachine(null)}>Close</button>
              <button className="machines-modal-btn machines-modal-btn-primary" onClick={() => navigate(`/dashboard/machines/${getMachineId(selectedMachine, 0)}`)}>Open Details</button>
            </div>
          </div>
        </div>
      )}

      {/* Add Machine Modal */}
      <AddMachineModal 
        isOpen={isAddModalOpen} 
        onClose={() => setIsAddModalOpen(false)}
        onSuccess={() => {
          // Modal automatically closes on success, just notify user
          console.log('[Machines] Machine created successfully');
        }}
      />
    </div>
  );
};

export default Machines;
