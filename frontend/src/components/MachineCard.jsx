import React from "react";
import "../index.css";

const getMachineStatus = (quantity, minRequired) => {
  if (quantity <= 0) return "critical";
  if (minRequired > 0 && quantity < minRequired) return "low";
  return "active";
};

const MachineCard = ({ machine = {}, onEdit, onDelete, onViewDetails, deleteLoading = false }) => {
  const name = machine.name || "Unnamed Machine";
  const safeQuantity = Number(machine.quantity ?? machine.quantity_available ?? 0);
  const safeMinRequired = Number(machine.minRequired ?? machine.minimumRequired ?? machine.minimum_required ?? 0);
  const warrantyValue = machine.warranty || machine.warrantyExpiryDate || machine.warranty_expiry_date;
  const safeWarrantyStatus = machine.warrantyStatus ?? (warrantyValue ? "Active" : "N/A");
  const status = getMachineStatus(safeQuantity, safeMinRequired);

  return (
    <article className={`machine-saas-card machine-status-${status}`}>
      <header className="machine-saas-header">
        <h3 className="machine-saas-name">{name}</h3>
        <span className={`machine-saas-badge machine-saas-badge-${status}`}>
          {status === "critical" ? "Critical" : status === "low" ? "Low Stock" : "Active"}
        </span>
      </header>

      <div className="machine-saas-metrics">
        <div className="machine-metric machine-metric-qty">
          <p className="machine-metric-label">Quantity</p>
          <p className="machine-metric-value">{safeQuantity ?? 0}</p>
        </div>
        <div className="machine-metric machine-metric-min">
          <p className="machine-metric-label">Min Required</p>
          <p className="machine-metric-value">{safeMinRequired ?? 0}</p>
        </div>
        <div className="machine-metric machine-metric-warranty">
          <p className="machine-metric-label">Warranty</p>
          <p className="machine-metric-value">{safeWarrantyStatus}</p>
        </div>
      </div>

      <footer className="machine-saas-actions">
        <button className="machine-action-btn" type="button" onClick={onEdit}>Edit</button>
        <button
          className="machine-action-btn machine-action-danger"
          type="button"
          onClick={onDelete}
          disabled={deleteLoading}
        >
          {deleteLoading ? "Deleting..." : "Delete"}
        </button>
        <button className="machine-action-btn machine-action-primary" type="button" onClick={onViewDetails}>View Details</button>
      </footer>
    </article>
  );
};

export default MachineCard;
