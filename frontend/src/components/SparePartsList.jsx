import React from "react";
import "../index.css";

const SparePartsList = ({ parts = [] }) => (
  <div className="spare-parts-list">
    {parts.map(part => (
      <div className="spare-part-card card" key={part.id || part.name}>
        <div className="spare-part-header">
          <span className="spare-part-name">{part.name}</span>
          <span className="spare-part-qty">Qty: <b>{part.quantity}</b></span>
        </div>
        <div className="spare-part-info">
          <div>Machine: <b>{part.machineName}</b></div>
          <div>Warranty: <b>{part.warranty}</b></div>
        </div>
      </div>
    ))}
  </div>
);

export default SparePartsList;
