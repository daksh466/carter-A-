import React, { useEffect, useMemo, useRef, useState } from "react";
import {
  Bar,
  BarChart,
  CartesianGrid,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";

const tooltipStyle = {
  backgroundColor: "#0f172a",
  border: "1px solid #334155",
  borderRadius: 8,
  color: "#e2e8f0",
};

const OrdersChart = ({ orders = [] }) => {
  const frameRef = useRef(null);
  const [canRender, setCanRender] = useState(false);

  useEffect(() => {
    const node = frameRef.current;
    if (!node) return;

    const update = () => {
      const { width, height } = node.getBoundingClientRect();
      setCanRender(width > 1 && height > 1);
    };

    update();
    const observer = new ResizeObserver(update);
    observer.observe(node);

    return () => {
      observer.disconnect();
    };
  }, []);

  const chartData = useMemo(() => {
    const source = Array.isArray(orders) ? orders : [];

    return source.map((order, index) => {
      const itemName =
        order?.item ||
        order?.machines?.[0]?.name ||
        `Order ${index + 1}`;

      const value = Number(order?.price ?? order?.totalAmount ?? order?.quantity ?? 0) || 0;

      return {
        name: itemName,
        value,
      };
    });
  }, [orders]);

  return (
    <div ref={frameRef} style={{ width: "100%", minHeight: 300, height: 300, minWidth: 1 }}>
      {canRender ? (
      <ResponsiveContainer width="100%" height="100%" minWidth={1} minHeight={300}>
        <BarChart data={chartData} margin={{ top: 12, right: 12, left: 0, bottom: 4 }}>
          <CartesianGrid strokeDasharray="3 3" stroke="#334155" />
          <XAxis dataKey="name" tick={{ fill: "#cbd5e1", fontSize: 12 }} axisLine={{ stroke: "#475569" }} />
          <YAxis tick={{ fill: "#cbd5e1", fontSize: 12 }} axisLine={{ stroke: "#475569" }} />
          <Tooltip contentStyle={tooltipStyle} labelStyle={{ color: "#93c5fd" }} />
          <Bar dataKey="value" fill="#60a5fa" radius={[8, 8, 0, 0]} />
        </BarChart>
      </ResponsiveContainer>
      ) : null}
    </div>
  );
};

export default OrdersChart;

