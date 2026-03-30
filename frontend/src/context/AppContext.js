import React, { createContext, useContext, useState } from "react";

const AppContext = createContext();

export const AppProvider = ({ children }) => {
	const [selectedStore, setSelectedStore] = useState(null);
	const [machines, setMachines] = useState([]);
	const [spareParts, setSpareParts] = useState([]);
	const [alerts, setAlerts] = useState([]);

	const value = {
		selectedStore,
		setSelectedStore,
		machines,
		setMachines,
		spareParts,
		setSpareParts,
		alerts,
		setAlerts,
	};

	return <AppContext.Provider value={value}>{children}</AppContext.Provider>;
};

export const useAppContext = () => useContext(AppContext);
