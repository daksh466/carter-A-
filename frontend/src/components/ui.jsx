import React from 'react';

// Button Component
export const Button = React.forwardRef(
  ({ className = '', children, disabled, variant = 'default', ...props }, ref) => {
    const baseStyles = 'px-4 py-2 rounded-lg font-medium transition-colors flex items-center gap-2';
    const variants = {
      default: 'bg-blue-600 text-white hover:bg-blue-700 disabled:bg-gray-400',
      outline: 'border border-gray-300 text-gray-700 hover:bg-gray-50',
      ghost: 'text-gray-700 hover:bg-gray-100',
    };
    return (
      <button
        ref={ref}
        disabled={disabled}
        className={`${baseStyles} ${variants[variant]} ${className}`}
        {...props}
      >
        {children}
      </button>
    );
  }
);
Button.displayName = 'Button';

// Input Component
export const Input = React.forwardRef(
  ({ className = '', ...props }, ref) => (
    <input
      ref={ref}
      className={`px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 ${className}`}
      {...props}
    />
  )
);
Input.displayName = 'Input';

// Label Component
export const Label = React.forwardRef(
  ({ className = '', ...props }, ref) => (
    <label ref={ref} className={`block text-sm font-medium text-gray-700 ${className}`} {...props} />
  )
);
Label.displayName = 'Label';

// Textarea Component
export const Textarea = React.forwardRef(
  ({ className = '', ...props }, ref) => (
    <textarea
      ref={ref}
      className={`px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 ${className}`}
      {...props}
    />
  )
);
Textarea.displayName = 'Textarea';

// Badge Component
export const Badge = ({ className = '', children, variant = 'default' }) => {
  const variants = {
    default: 'bg-blue-100 text-blue-800',
    secondary: 'bg-gray-100 text-gray-800',
    success: 'bg-green-100 text-green-800',
    warning: 'bg-yellow-100 text-yellow-800',
    error: 'bg-red-100 text-red-800',
  };
  return (
    <span className={`inline-block px-2 py-1 rounded-full text-xs font-semibold ${variants[variant]} ${className}`}>
      {children}
    </span>
  );
};

// Card Component
export const Card = ({ className = '', children }) => (
  <div className={`bg-white rounded-lg border border-gray-200 shadow-sm ${className}`}>{children}</div>
);

// CardHeader Component
export const CardHeader = ({ className = '', children }) => (
  <div className={`px-6 py-4 border-b border-gray-200 ${className}`}>{children}</div>
);

// CardContent Component
export const CardContent = ({ className = '', children }) => (
  <div className={`px-6 py-4 ${className}`}>{children}</div>
);

// CardFooter Component
export const CardFooter = ({ className = '', children }) => (
  <div className={`px-6 py-4 border-t border-gray-200 flex gap-2 ${className}`}>{children}</div>
);

// Table Component
const TableHeader = ({ children }) => (
  <thead className="bg-gray-50 border-b border-gray-200">{children}</thead>
);

const TableBody = ({ children }) => (
  <tbody>{children}</tbody>
);

const TableRow = ({ children, className = '' }) => (
  <tr className={`border-b border-gray-200 hover:bg-gray-50 ${className}`}>{children}</tr>
);

const TableHead = ({ children, className = '' }) => (
  <th className={`px-6 py-3 text-left text-sm font-semibold text-gray-900 ${className}`}>{children}</th>
);

const TableCell = ({ children, className = '' }) => (
  <td className={`px-6 py-3 text-sm text-gray-700 ${className}`}>{children}</td>
);

const Table = ({ children, className = '' }) => (
  <table className={`w-full border-collapse ${className}`}>{children}</table>
);

Table.Header = TableHeader;
Table.Body = TableBody;
Table.Row = TableRow;
Table.Head = TableHead;
Table.Cell = TableCell;

// Named exports for backward compatibility
export { Table };
export { TableHeader };
export { TableBody };
export { TableRow };
export { TableHead };
export { TableCell };

// Tabs Component
const TabsList = ({ children, className = '', activeTab, setActiveTab }) => (
  <div className={`flex border-b border-gray-200 ${className}`}>
    {React.Children.map(children, (child) =>
      child && React.cloneElement(child, { activeTab, setActiveTab })
    )}
  </div>
);

const TabsTrigger = ({ value, children, activeTab, setActiveTab, className = '' }) => (
  <button
    onClick={() => setActiveTab && setActiveTab(value)}
    className={`px-4 py-2 font-medium border-b-2 transition-colors ${
      activeTab === value
        ? 'border-blue-600 text-blue-600'
        : 'border-transparent text-gray-600 hover:text-gray-900'
    } ${className}`}
  >
    {children}
  </button>
);

const TabsContent = ({ value, children, activeTab, className = '' }) =>
  activeTab === value ? <div className={className}>{children}</div> : null;

const Tabs = ({ children, value, defaultValue, onValueChange, className = '' }) => {
  // Use value if provided (controlled), otherwise use internal state (uncontrolled)
  const isControlled = value !== undefined;
  const [internalActive, setInternalActive] = React.useState(defaultValue || 'all');
  
  const activeTab = isControlled ? value : internalActive;
  
  const handleValueChange = (newValue) => {
    if (!isControlled) {
      setInternalActive(newValue);
    }
    if (onValueChange) {
      onValueChange(newValue);
    }
  };

  return (
    <div className={className}>
      {React.Children.map(children, (child) => {
        if (!child) return null;
        // Only pass props to our custom components
        if (child.type === TabsList || child.type === TabsTrigger || child.type === TabsContent) {
          return React.cloneElement(child, { activeTab, setActiveTab: handleValueChange });
        }
        return child;
      })}
    </div>
  );
};

Tabs.List = TabsList;
Tabs.Trigger = TabsTrigger;
Tabs.Content = TabsContent;

// Named exports for backward compatibility
export { Tabs };
export { TabsList };
export { TabsTrigger };
export { TabsContent };

// Toggle Component
export const Toggle = React.forwardRef(
  ({ className = '', pressed = false, onPressedChange, children, ...props }, ref) => (
    <button
      ref={ref}
      onClick={() => onPressedChange && onPressedChange(!pressed)}
      className={`px-3 py-2 rounded-lg border transition-colors ${
        pressed
          ? 'bg-blue-600 text-white border-blue-600'
          : 'border-gray-300 text-gray-700 hover:bg-gray-100'
      } ${className}`}
      {...props}
    >
      {children}
    </button>
  )
);
Toggle.displayName = 'Toggle';

// ToggleGroup Component
export const ToggleGroup = ({ children, ...props }) => (
  <div className="flex gap-2" {...props}>
    {children}
  </div>
);

// Select Component
const SelectTrigger = React.forwardRef(
  ({ className = '', children, open, setOpen, ...props }, ref) => (
    <button
      ref={ref}
      onClick={() => setOpen && setOpen(!open)}
      className={`w-full px-3 py-2 rounded-lg border border-gray-300 flex items-center justify-between bg-white hover:bg-gray-50 ${className}`}
      {...props}
    >
      {children}
      <svg className={`w-4 h-4 transition-transform ${open ? 'rotate-180' : ''}`} fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 14l-7 7m0 0l-7-7m7 7V3" />
      </svg>
    </button>
  )
);
SelectTrigger.displayName = 'SelectTrigger';

const SelectValue = ({ placeholder, children }) => children || placeholder;

const SelectContent = ({ children, open, setOpen, onValueChange, ...props }) =>
  open ? (
    <div className="absolute z-50 w-full mt-1 bg-white border border-gray-300 rounded-lg shadow-lg" {...props}>
      {React.Children.map(children, (child) =>
        child && React.cloneElement(child, { onValueChange, setOpen })
      )}
    </div>
  ) : null;

const SelectItem = ({ value, children, onValueChange, setOpen, ...props }) => (
  <button
    onClick={() => {
      if (onValueChange) onValueChange(value);
      if (setOpen) setOpen(false);
    }}
    className="w-full px-3 py-2 text-left text-sm hover:bg-blue-50 text-gray-700"
    {...props}
  >
    {children}
  </button>
);

const Select = ({ children, value, onValueChange }) => {
  const [open, setOpen] = React.useState(false);

  return (
    <div className="relative">
      {React.Children.map(children, (child) => {
        if (!child) return null;
        // Only pass props to our custom Select components
        if (child.type === SelectTrigger || child.type === SelectContent || child.type === SelectValue) {
          return React.cloneElement(child, { open, setOpen, value, onValueChange });
        }
        return child;
      })}
    </div>
  );
};

Select.Trigger = SelectTrigger;
Select.Value = SelectValue;
Select.Content = SelectContent;
Select.Item = SelectItem;

// Named exports for backward compatibility
export { Select };
export { SelectTrigger };
export { SelectValue };
export { SelectContent };
export { SelectItem };
