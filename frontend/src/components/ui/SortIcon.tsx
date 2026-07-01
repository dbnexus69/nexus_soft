import { ArrowUpDown, ArrowUp, ArrowDown } from 'lucide-react';

interface SortIconProps {
  field: string;
  currentSort: string;
  sortOrder: 'asc' | 'desc';
}

export default function SortIcon({ field, currentSort, sortOrder }: SortIconProps) {
  const active = field === currentSort;
  if (!active) return <ArrowUpDown size={12} className="text-gray-300" />;
  return sortOrder === 'asc' 
    ? <ArrowUp size={12} className="text-white bg-primary rounded-full p-0.5" /> 
    : <ArrowDown size={12} className="text-white bg-primary rounded-full p-0.5" />;
}
