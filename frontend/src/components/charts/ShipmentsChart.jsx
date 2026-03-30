import React, { useEffect, useRef, useState } from "react";
import {
  LineChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
  ResponsiveContainer,
} from "recharts";

const tooltipStyle = {
  backgroundColor: "#0f172a",
  border: "1px solid #334155",
  borderRadius: 8,
  color: "#e2e8f0",
};

const ShipmentChart = ({ data = [], height = 280 }) => {
  const frameRef = useRef(null);
  const [canRender, setCanRender] = useState(false);

  useEffect(() => {
    const node = frameRef.current;
    if (!node) return;

    const update = () => {
      const { width, height: measuredHeight } = node.getBoundingClientRect();
      setCanRender(width > 1 && measuredHeight > 1);
    };

    update();
    const observer = new ResizeObserver(update);
    observer.observe(node);

    return () => {
      observer.disconnect();
    };
  }, []);

  return (
    <div ref={frameRef} style={{ width: "100%", height, minHeight: 250, minWidth: 1 }}>
      {canRender ? (
      <ResponsiveContainer width="100%" height={height} minWidth={1} minHeight={250}>
        <LineChart data={data} margin={{ top: 12, right: 12, left: 0, bottom: 4 }}>
          <CartesianGrid strokeDasharray="3 3" stroke="#334155" />
          <XAxis dataKey="label" tick={{ fill: "#cbd5e1", fontSize: 12 }} axisLine={{ stroke: "#475569" }} />
          <YAxis allowDecimals={false} tick={{ fill: "#cbd5e1", fontSize: 12 }} axisLine={{ stroke: "#475569" }} />
          <Tooltip contentStyle={tooltipStyle} labelStyle={{ color: "#93c5fd" }} />
          <Legend />
          <Line 
            type="monotone" 
            dataKey="incoming" 
            stroke="#34d399" 
            strokeWidth={3} 
            name="Incoming" 
            dot={{ fill: "#34d399", strokeWidth: 2 }} 
            activeDot={{ r: 6, strokeWidth: 2 }}
          />
          <Line 
            type="monotone" 
            dataKey="outgoing" 
            stroke="#60a5fa" 
            strokeWidth={3} 
            name="Outgoing" 
            dot={{ fill: "#60a5fa", strokeWidth: 2 }} 
            activeDot={{ r: 6, strokeWidth: 2 }}
          />
          <Line 
            type="monotone" 
            dataKey="delivered" 
            stroke="#10b981" 
            strokeWidth={3} 
            name="Delivered" 
            dot={{ fill: "#10b981", strokeWidth: 2 }} 
            activeDot={{ r: 6, strokeWidth: 2 }}
          />
        </LineChart>
      </ResponsiveContainer>
      ) : null}
    </div>
  );
};

export default ShipmentChart;

