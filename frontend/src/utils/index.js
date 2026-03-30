// Utility functions for the Inventory Management System

/**
 * Format a number as currency (USD)
 */
export function formatCurrency(amount) {
  return new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: "USD",
    maximumFractionDigits: 2,
  }).format(amount);
}

/**
 * Get status color classes for inventory status
 */
export function getStatusColor(status) {
  switch (status) {
    case "In Stock":
      return "bg-green-100 text-green-700";
    case "Low":
      return "bg-yellow-100 text-yellow-700";
    case "Out":
      return "bg-red-100 text-red-700";
    default:
      return "bg-gray-100 text-gray-700";
  }
}
