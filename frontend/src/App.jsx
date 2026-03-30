import React from "react";
import { BrowserRouter, Navigate, Route, Routes } from "react-router-dom";
import AppLayout from "./components/AppLayout";
import { AppProvider } from "./context/AppContext.jsx";
import Alerts from "./pages/Alerts";
import Dashboard from "./pages/Dashboard";
import Home from "./pages/Home";
import Inventory from "./pages/Inventory";
import Logistics from "./pages/Logistics";
import MachineDetails from "./pages/MachineDetails";
import Machines from "./pages/Machines";
import IncomingShipments from "./pages/IncomingShipments";
import Orders from "./pages/Orders";
import OutgoingShipments from "./pages/OutgoingShipments";
import Purchases from "./pages/Purchases";
import Reports from "./pages/Reports";
import Shipments from "./pages/Shipments";
import SpareParts from "./pages/SpareParts";
import StoreDetails from "./pages/StoreDetails";
import StoreList from "./pages/StoreList";
import TransferHistory from "./pages/TransferHistory";
import Transfers from "./pages/Transfers";
import TransferTransit from "./pages/TransferTransit";
import Welcome from "./pages/Welcome";

function App() {
  return (
    <AppProvider>
      <BrowserRouter future={{ v7_startTransition: true, v7_relativeSplatPath: true }}>
        <Routes>
          <Route path="/" element={<Navigate to="/dashboard/welcome" replace />} />

          <Route path="/dashboard/welcome" element={<Welcome />} />

          <Route path="/dashboard" element={<AppLayout />}>
            <Route index element={<Dashboard />} />
            <Route path="home" element={<Home />} />
            <Route path="machines" element={<Machines />} />
            <Route path="machines/:id" element={<MachineDetails />} />
            <Route path="spares" element={<SpareParts />} />
            <Route path="inventory" element={<Inventory />} />
            <Route path="shipments" element={<Shipments />} />
            <Route path="transfers" element={<Transfers />} />
            <Route path="transfers/transit" element={<TransferTransit />} />
            <Route path="transfer-history" element={<TransferHistory />} />
            <Route path="incoming" element={<IncomingShipments />} />
            <Route path="outgoing" element={<OutgoingShipments />} />
            <Route path="alerts" element={<Alerts />} />
            <Route path="stores" element={<StoreList />} />
            <Route path="stores/:id" element={<StoreDetails />} />
            <Route path="orders" element={<Orders />} />
            <Route path="purchases" element={<Purchases />} />
            <Route path="reports" element={<Reports />} />
            <Route path="logistics" element={<Logistics />} />
          </Route>

          <Route path="/inventory" element={<Navigate to="/dashboard/inventory" replace />} />
          <Route path="/alerts" element={<Navigate to="/dashboard/alerts" replace />} />
          <Route path="*" element={<Navigate to="/dashboard/welcome" replace />} />
        </Routes>
      </BrowserRouter>
    </AppProvider>
  );
}

export default App;
