import React, { useState, useMemo } from "react";
import { useApp } from "../hooks/useApp";
import AddOrderModal from "../components/AddOrderModal";
import { deleteOrder } from "../services/api";

const Orders = () => {
  const [isAddModalOpen, setIsAddModalOpen] = useState(false);
  const { orders, ordersSummary, ordersLoading, ordersError } = useApp();
  const [deletingOrderId, setDeletingOrderId] = useState(null);

  const safeNumber = (value) => {
    const num = Number(value);
    return Number.isFinite(num) ? num : 0;
  };

  const formatAmount = (value) => safeNumber(value).toLocaleString("en-IN");

  const formatDate = (value) => {
    if (!value) return "N/A";
    const date = new Date(value);
    if (Number.isNaN(date.getTime())) return "N/A";
    return date.toLocaleString("en-IN");
  };

  const getOrderId = (order) => order?.id || order?._id || "";

  const handleDeleteOrder = async (orderId) => {
    if (!orderId) return;
    if (!window.confirm("Are you sure you want to delete this order?")) return;

    setDeletingOrderId(orderId);
    const result = await deleteOrder(orderId);
    if (result.success) {
      window.location.reload();
    } else {
      alert("Failed to delete order: " + (result.error || "Unknown error"));
    }
    setDeletingOrderId(null);
  };

  const [paymentFilter, setPaymentFilter] = useState("all");
  const [searchTerm, setSearchTerm] = useState("");
  const [sortBy, setSortBy] = useState("date-new");

  const filteredOrders = useMemo(() => {
    let result = Array.isArray(orders) ? [...orders] : [];

    if (paymentFilter !== "all") {
      result = result.filter((order) => order?.paymentStatus === paymentFilter);
    }

    if (searchTerm.trim()) {
      result = result.filter((order) =>
        String(order?.customerName || "")
          .toLowerCase()
          .includes(searchTerm.toLowerCase())
      );
    }

    if (sortBy === "date-new") {
      result.sort((a, b) => new Date(b?.orderDate || 0) - new Date(a?.orderDate || 0));
    } else if (sortBy === "date-old") {
      result.sort((a, b) => new Date(a?.orderDate || 0) - new Date(b?.orderDate || 0));
    } else if (sortBy === "amount-high") {
      result.sort((a, b) => safeNumber(b?.totalAmount) - safeNumber(a?.totalAmount));
    } else if (sortBy === "amount-low") {
      result.sort((a, b) => safeNumber(a?.totalAmount) - safeNumber(b?.totalAmount));
    }

    return result;
  }, [orders, paymentFilter, searchTerm, sortBy]);

  if (ordersLoading) {
    return (
      <div
        style={{
          width: "100%",
          minHeight: "calc(100vh - 64px)",
          display: "flex",
          flexDirection: "column",
          alignItems: "center",
          justifyContent: "center",
          padding: "32px 24px",
        }}
      >
        <div style={{ fontSize: 48, marginBottom: 16 }}>⏳</div>
        <h2 style={{ color: "#fff", fontSize: 24, marginBottom: 8 }}>Loading Orders...</h2>
        <p style={{ color: "#aaa", fontSize: 14 }}>Fetching order data...</p>
      </div>
    );
  }

  return (
    <div style={{ width: "100%", minHeight: "calc(100vh - 64px)", padding: "32px 24px" }}>
      <div style={{ marginBottom: 32, display: "flex", justifyContent: "space-between", alignItems: "flex-start" }}>
        <div>
          <h2
            style={{
              fontSize: 32,
              fontWeight: 700,
              marginBottom: 8,
              color: "#fff",
              letterSpacing: 1,
              textShadow: "0 2px 12px #1e2a78cc",
            }}
          >
            Orders
          </h2>
          <p style={{ color: "#aaa", fontSize: 14 }}>Manage all orders and track payment status</p>
        </div>
        <button
          onClick={() => setIsAddModalOpen(true)}
          style={{
            padding: "10px 20px",
            background: "#2563eb",
            color: "#fff",
            border: "none",
            borderRadius: 6,
            cursor: "pointer",
            fontSize: 14,
            fontWeight: 600,
            transition: "background 0.2s",
          }}
          onMouseEnter={(e) => {
            e.target.style.background = "#1d4ed8";
          }}
          onMouseLeave={(e) => {
            e.target.style.background = "#2563eb";
          }}
        >
          + Create Order
        </button>
      </div>

      {ordersError && (
        <div
          style={{
            width: "100%",
            maxWidth: 1200,
            margin: "0 auto 24px",
            padding: 16,
            background: "#fee2e2",
            border: "1px solid #fca5a5",
            borderRadius: 8,
            color: "#991b1b",
            textAlign: "center",
          }}
        >
          <strong>⚠️ Warning:</strong> {ordersError}
        </div>
      )}

      <div
        style={{
          display: "grid",
          gridTemplateColumns: "repeat(auto-fit, minmax(200px, 1fr))",
          gap: 16,
          maxWidth: 1200,
          margin: "0 auto 32px",
        }}
      >
        <div style={{ padding: 20, background: "#1e2a78", borderRadius: 8, border: "1px solid #2a3a9f" }}>
          <div style={{ fontSize: 12, color: "#aaa", marginBottom: 8 }}>Total Orders</div>
          <div style={{ fontSize: 28, fontWeight: 700, color: "#6ea8fe" }}>{safeNumber(ordersSummary?.total)}</div>
        </div>
        <div style={{ padding: 20, background: "#1e2a78", borderRadius: 8, border: "1px solid #2a3a9f" }}>
          <div style={{ fontSize: 12, color: "#aaa", marginBottom: 8 }}>Paid</div>
          <div style={{ fontSize: 28, fontWeight: 700, color: "#86efac" }}>{safeNumber(ordersSummary?.paid)}</div>
        </div>
        <div style={{ padding: 20, background: "#1e2a78", borderRadius: 8, border: "1px solid #2a3a9f" }}>
          <div style={{ fontSize: 12, color: "#aaa", marginBottom: 8 }}>Pending</div>
          <div style={{ fontSize: 28, fontWeight: 700, color: "#fca5a5" }}>{safeNumber(ordersSummary?.pending)}</div>
        </div>
        <div style={{ padding: 20, background: "#1e2a78", borderRadius: 8, border: "1px solid #2a3a9f" }}>
          <div style={{ fontSize: 12, color: "#aaa", marginBottom: 8 }}>Total Amount</div>
          <div style={{ fontSize: 28, fontWeight: 700, color: "#fbbf24" }}>₹{formatAmount(ordersSummary?.totalAmount)}</div>
        </div>
      </div>

      <div
        style={{
          maxWidth: 1200,
          margin: "0 auto 24px",
          display: "grid",
          gridTemplateColumns: "repeat(auto-fit, minmax(200px, 1fr))",
          gap: 16,
        }}
      >
        <div>
          <label style={{ display: "block", fontSize: 12, color: "#aaa", marginBottom: 6, fontWeight: 600 }}>Search by Customer</label>
          <input
            type="text"
            placeholder="Search by customer"
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            style={{
              width: "100%",
              padding: "10px 12px",
              border: "1px solid #2a3a9f",
              borderRadius: 6,
              background: "#0f172a",
              color: "#fff",
              fontSize: 14,
              outline: "none",
            }}
          />
        </div>

        <div>
          <label style={{ display: "block", fontSize: 12, color: "#aaa", marginBottom: 6, fontWeight: 600 }}>Payment Status</label>
          <select
            value={paymentFilter}
            onChange={(e) => setPaymentFilter(e.target.value)}
            style={{
              width: "100%",
              padding: "10px 12px",
              border: "1px solid #2a3a9f",
              borderRadius: 6,
              background: "#0f172a",
              color: "#fff",
              fontSize: 14,
              cursor: "pointer",
            }}
          >
            <option value="all">All Orders</option>
            <option value="Paid">Paid</option>
            <option value="Pending">Pending</option>
          </select>
        </div>

        <div>
          <label style={{ display: "block", fontSize: 12, color: "#aaa", marginBottom: 6, fontWeight: 600 }}>Sort By</label>
          <select
            value={sortBy}
            onChange={(e) => setSortBy(e.target.value)}
            style={{
              width: "100%",
              padding: "10px 12px",
              border: "1px solid #2a3a9f",
              borderRadius: 6,
              background: "#0f172a",
              color: "#fff",
              fontSize: 14,
              cursor: "pointer",
            }}
          >
            <option value="date-new">Newest First</option>
            <option value="date-old">Oldest First</option>
            <option value="amount-high">Highest Amount</option>
            <option value="amount-low">Lowest Amount</option>
          </select>
        </div>
      </div>

      <div style={{ maxWidth: 1200, margin: "0 auto" }}>
        {filteredOrders.length === 0 ? (
          <div style={{ textAlign: "center", padding: 48 }}>
            <div style={{ fontSize: 48, marginBottom: 16 }}>📭</div>
            <p style={{ color: "#888", fontSize: 18 }}>
              {searchTerm || paymentFilter !== "all" ? "No orders match your filters" : "No data found"}
            </p>
          </div>
        ) : (
          <div style={{ display: "grid", gap: 16 }}>
            {filteredOrders?.map((order, index) => {
              const orderId = getOrderId(order);
              const machines = Array.isArray(order?.machines) ? order.machines : [];

              return (
                <div
                  key={orderId || `order-${index}`}
                  style={{
                    background: "#1a2f60",
                    border: "1px solid #2a3a9f",
                    borderRadius: 8,
                    padding: 20,
                    transition: "all 0.2s",
                    position: "relative",
                  }}
                >
                  <button
                    onClick={() => handleDeleteOrder(orderId)}
                    disabled={!orderId || deletingOrderId === orderId}
                    style={{
                      position: "absolute",
                      top: 12,
                      right: 12,
                      background: "#ef4444",
                      color: "#fff",
                      border: "none",
                      borderRadius: 6,
                      padding: "6px 12px",
                      fontSize: 12,
                      fontWeight: 600,
                      cursor: !orderId || deletingOrderId === orderId ? "not-allowed" : "pointer",
                      opacity: !orderId || deletingOrderId === orderId ? 0.6 : 1,
                    }}
                  >
                    {deletingOrderId === orderId ? "Deleting..." : "Delete"}
                  </button>

                  <div
                    style={{
                      display: "grid",
                      gridTemplateColumns: "1fr auto",
                      gap: 16,
                      marginBottom: 16,
                      paddingBottom: 16,
                      borderBottom: "1px solid #2a3a9f",
                    }}
                  >
                    <div>
                      <div style={{ display: "flex", gap: 12, alignItems: "center", marginBottom: 8 }}>
                        <div style={{ fontSize: 14, fontWeight: 700, color: "#e0e7ff" }}>{orderId || "N/A"}</div>
                        <div style={{ fontSize: 12, color: "#aaa" }}>{formatDate(order?.orderDate)}</div>
                      </div>
                      <div style={{ fontSize: 16, fontWeight: 600, color: "#fff" }}>{order?.customerName || "Unknown Customer"}</div>
                      <div style={{ fontSize: 12, color: "#aaa", marginTop: 4 }}>
                        📧 {order?.customerEmail || "N/A"} • 📞 {order?.customerPhone || "N/A"}
                      </div>
                    </div>
                    <div style={{ textAlign: "right" }}>
                      <div style={{ fontSize: 24, fontWeight: 700, color: "#fbbf24", marginBottom: 8 }}>
                        ₹{formatAmount(order?.totalAmount)}
                      </div>
                      <div
                        style={{
                          display: "inline-block",
                          padding: "6px 14px",
                          borderRadius: 16,
                          fontSize: 12,
                          fontWeight: 600,
                          background: order?.paymentStatus === "Paid" ? "#dcfce7" : "#fee2e2",
                          color: order?.paymentStatus === "Paid" ? "#166534" : "#991b1b",
                        }}
                      >
                        {order?.paymentStatus === "Paid" ? "✓ Paid" : "⏳ Pending"}
                      </div>
                    </div>
                  </div>

                  <div style={{ marginBottom: 16 }}>
                    <div style={{ fontSize: 12, fontWeight: 600, color: "#aaa", marginBottom: 8, textTransform: "uppercase" }}>
                      Machines Ordered
                    </div>
                    <div style={{ display: "grid", gap: 8 }}>
                      {machines.length === 0 ? (
                        <div
                          style={{
                            padding: "10px 12px",
                            background: "#0f172a",
                            borderRadius: 6,
                            border: "1px solid #1e2a78",
                            color: "#aaa",
                            fontSize: 14,
                          }}
                        >
                          No machine data
                        </div>
                      ) : (
                        machines.map((machine, idx) => (
                          <div
                            key={`machine-${idx}`}
                            style={{
                              display: "flex",
                              justifyContent: "space-between",
                              alignItems: "center",
                              padding: "10px 12px",
                              background: "#0f172a",
                              borderRadius: 6,
                              border: "1px solid #1e2a78",
                            }}
                          >
                            <span style={{ color: "#e0e7ff", fontSize: 14 }}>{machine?.name || "Unnamed Machine"}</span>
                            <span
                              style={{
                                background: "#2a3a9f",
                                color: "#6ea8fe",
                                padding: "4px 10px",
                                borderRadius: 4,
                                fontSize: 12,
                                fontWeight: 600,
                              }}
                            >
                              Qty: {safeNumber(machine?.quantity)}
                            </span>
                          </div>
                        ))
                      )}
                    </div>
                  </div>

                  <div style={{ fontSize: 12, color: "#aaa" }}>
                    <strong>Verified By:</strong> {order?.verifiedBy || "N/A"}
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>

      {filteredOrders.length > 0 && (
        <div
          style={{
            textAlign: "center",
            marginTop: 32,
            padding: 16,
            color: "#aaa",
            fontSize: 12,
          }}
        >
          Showing {filteredOrders.length} of {safeNumber(ordersSummary?.total)} orders
        </div>
      )}

      <AddOrderModal
        isOpen={isAddModalOpen}
        onClose={() => setIsAddModalOpen(false)}
        onSuccess={() => {
          console.log("[Orders] Order created successfully");
        }}
      />
    </div>
  );
};

export default Orders;
