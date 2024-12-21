// src/components/custom/SearchBar.jsx
import { useState } from 'react';
import { Search } from 'lucide-react';
import { Input } from '../ui/input';

export function SearchBar({ onSearch }) {
  return (
    <div className="relative">
      <Search
        size={16}
        className="absolute left-2 top-1/2 transform -translate-y-1/2 text-gray-400"
      />
      <Input
        placeholder="Search tables..."
        className="pl-8"
        onChange={(e) => onSearch(e.target.value)}
      />
    </div>
  );
}