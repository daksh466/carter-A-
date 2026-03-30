import React from "react";
import MachineCard from "./MachineCard";
import "../index.css";

const MachineList = ({ machines = [], renderSpareParts }) => (
  <div className="machine-list">
    {machines.map(machine => (
      <MachineCard
        key={machine.id || machine.name}
        machine={machine}
        onEdit={() => {}}
        onDelete={() => {}}
        onViewDetails={() => {}}
      >
        {renderSpareParts && renderSpareParts(machine)}
      </MachineCard>
    ))}
  </div>
);

export default MachineList;
