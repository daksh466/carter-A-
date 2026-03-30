import React, { useEffect } from "react";
import { useParams, useNavigate } from "react-router-dom";
import useApp from "../hooks/useApp";

/**
 * MachineDetails page: displays detailed information about a specific machine.
 */
const MachineDetails = () => {
  const { id } = useParams();
  const navigate = useNavigate();
  const { getMachineById, spareParts } = useApp();
  
  const machine = getMachineById(id);

  useEffect(() => {
    if (import.meta.env.DEV) {
      console.log("Machine details payload:", machine);
    }
  }, [machine]);
  
  // Get spare parts for this machine
  const machineSpareParts = spareParts.filter(
    sp => sp.machineName === machine?.name
  );

  if (!machine) {
    return (
      <div style={{ textAlign: 'center', padding: 48, color: '#fff' }}>
        <h2>Machine not found</h2>
        <button 
          onClick={() => navigate('/dashboard/machines')}
          style={{ marginTop: 16, padding: '8px 16px', cursor: 'pointer' }}
        >
          Back to Machines
        </button>
      </div>
    );
  }

  const quantity = Number(machine.quantity ?? machine.quantity_available ?? 0);
  const minRequired = Number(machine.minRequired ?? machine.minimumRequired ?? machine.minimum_required ?? 0);
  const warranty = machine.warranty ?? machine.warrantyExpiryDate ?? machine.warranty_expiry_date ?? null;
  const warrantyStatus = machine.warrantyStatus ?? (warranty ? "Active" : "N/A");
  const warrantyExpiring = Boolean(machine.warrantyExpiring);
  const isLowStock = quantity <= minRequired;

  return (
    <div style={{ width: '100%', minHeight: 'calc(100vh - 64px)', padding: '32px 0 24px 0' }}>
      <button 
        onClick={() => navigate('/dashboard/machines')}
        style={{ 
          marginLeft: 24, 
          marginBottom: 24,
          padding: '8px 16px',
          background: 'transparent',
          border: '1px solid #6ea8fe',
          color: '#6ea8fe',
          borderRadius: 6,
          cursor: 'pointer',
        }}
      >
        ← Back to Machines
      </button>

      <div style={{ maxWidth: 800, margin: '0 auto', padding: '0 24px' }}>
        <div className="card" style={{ marginBottom: 24 }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 24 }}>
            <h2 style={{ fontSize: 28, fontWeight: 700, color: '#1e2a78', margin: 0 }}>{machine.name}</h2>
            <span className={`badge badge-${isLowStock ? 'low' : 'normal'}`} style={{ fontSize: 14, padding: '6px 12px' }}>
              {isLowStock ? 'Low Stock' : 'Normal'}
            </span>
          </div>

          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, 1fr)', gap: 24 }}>
            <div>
              <div style={{ fontSize: 13, color: '#666', marginBottom: 4 }}>Current Quantity</div>
              <div style={{ fontSize: 24, fontWeight: 700, color: isLowStock ? '#ef4444' : '#166534' }}>
                {quantity ?? "0"}
              </div>
            </div>
            <div>
              <div style={{ fontSize: 13, color: '#666', marginBottom: 4 }}>Minimum Required</div>
              <div style={{ fontSize: 24, fontWeight: 700, color: '#1e2a78' }}>
                {minRequired ?? "N/A"}
              </div>
            </div>
            <div>
              <div style={{ fontSize: 13, color: '#666', marginBottom: 4 }}>Warranty Status</div>
              <div style={{ fontSize: 18, fontWeight: 600, color: warrantyStatus === 'Active' ? '#166534' : '#ef4444' }}>
                {warrantyStatus}
              </div>
            </div>
            <div>
              <div style={{ fontSize: 13, color: '#666', marginBottom: 4 }}>Warranty</div>
              <div style={{ fontSize: 18, fontWeight: 600, color: warrantyExpiring ? '#b45309' : '#666' }}>
                {warranty ?? 'N/A'}
              </div>
            </div>
          </div>
        </div>

        {/* Related Spare Parts */}
        <h3 style={{ fontSize: 20, fontWeight: 600, color: '#fff', marginBottom: 16 }}>
          Related Spare Parts
        </h3>
        
        {machineSpareParts.length === 0 ? (
          <p style={{ color: '#888' }}>No spare parts found for this machine.</p>
        ) : (
          <div style={{ display: 'grid', gap: 12 }}>
            {machineSpareParts.map(part => (
              <div key={part.id} className="card" style={{ padding: 16 }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                  <div>
                    <div style={{ fontWeight: 600, color: '#1e2a78' }}>{part.name}</div>
                    <div style={{ fontSize: 13, color: '#666' }}>Warranty: {part.warranty}</div>
                  </div>
                  <div style={{ textAlign: 'right' }}>
                    <div style={{ fontSize: 20, fontWeight: 700, color: part.quantity <= part.minRequired ? '#ef4444' : '#166534' }}>
                      {part.quantity}
                    </div>
                    <div style={{ fontSize: 12, color: '#666' }}>in stock</div>
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
};

export default MachineDetails;
