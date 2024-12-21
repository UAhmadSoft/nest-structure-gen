// src/components/custom/FilterPanel.jsx
import { Check } from 'lucide-react';

const RELATION_TYPES = [
  { value: 'OneToMany', label: 'One To Many', color: '#3b82f6' },
  { value: 'ManyToOne', label: 'Many To One', color: '#10b981' },
  { value: 'OneToOne', label: 'One To One', color: '#8b5cf6' },
  { value: 'ManyToMany', label: 'Many To Many', color: '#f59e0b' },
];

export function FilterPanel({ activeFilters, onFilterChange }) {
  return (
    <div className="p-4 rounded-lg shadow">
      <h3 className="font-medium mb-2">Filter Relations</h3>
      <div className="space-y-2">
        {RELATION_TYPES.map((type) => (
          <label
            key={type.value}
            className="flex items-center gap-2 cursor-pointer"
          >
            <div
              className={`w-4 h-4 border rounded flex items-center justify-center
                ${activeFilters.includes(type.value) ? 'bg-blue-500 border-blue-500' : 'border-gray-300'}`}
            >
              {activeFilters.includes(type.value) && (
                <Check size={12} className="text-white" />
              )}
            </div>
            <span
              className="flex-1"
              style={{ color: type.color }}
            >
              {type.label}
            </span>
          </label>
        ))}
      </div>
    </div>
  );
}