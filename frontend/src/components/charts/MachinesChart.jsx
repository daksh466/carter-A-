import React, { useEffect, useMemo, useRef, useState } from "react";
import {
  Cell,
  Legend,
  Pie,
  PieChart,
  ResponsiveContainer,
  Tooltip,
} from "recharts";

const COLORS = {
  Running: "#34d399",
  Idle: "#fbbf24",
  Error: "#f87171",
};

const tooltipStyle = {
  backgroundColor: "#0f172a",
  border: "1px solid #334155",
  borderRadius: 8,
  color: "#e2e8f0",
};

const normalizeStatus = (status = "") => {
  const value = String(status).toLowerCase();
  if (value.includes("run")) return "Running";
  if (value.includes("idle")) return "Idle";
  return "Error";
};

const MachinesChart = ({ machines = [] }) => {
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
    const source = Array.isArray(machines) ? machines : [];

    const summary = {
      Running: 0,
      Idle: 0,
      Error: 0,
    };

    source.forEach((machine) => {
      const key = normalizeStatus(machine?.status);
      summary[key] += 1;
    });

    return Object.entries(summary).map(([name, value]) => ({ name, value }));
  }, [machines]);

  return (
    <div ref={frameRef} style={{ width: "100%", minHeight: 300, height: 300, minWidth: 1 }}>
      {canRender ? (
      <ResponsiveContainer width="100%" height="100%" minWidth={1} minHeight={300}>
        <PieChart>
          <Pie
            data={chartData}
            dataKey="value"
            nameKey="name"
            innerRadius={55}
            outerRadius={95}
            paddingAngle={4}
            stroke="#1e293b"
          >
            {chartData.map((entry) => (
              <Cell key={entry.name} fill={COLORS[entry.name]} />
            ))}
          </Pie>
          <Tooltip contentStyle={tooltipStyle} labelStyle={{ color: "#93c5fd" }} />
          <Legend wrapperStyle={{ color: "#cbd5e1", fontSize: 12 }} />
        </PieChart>
      </ResponsiveContainer>
      ) : null}
    </div>
  );
};

export default MachinesChart;

