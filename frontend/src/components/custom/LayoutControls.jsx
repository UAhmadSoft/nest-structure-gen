// src/components/custom/LayoutControls.jsx
import { Button } from '../ui/button';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '../ui/select';
import { Layout, ArrowDown, ArrowRight } from 'lucide-react';

export function LayoutControls({ onLayout }) {
  return (
    <div className="flex items-center gap-2">
      <Select defaultValue="TB" onValueChange={(direction) => onLayout(direction)}>
        <SelectTrigger className="w-[140px]">
          <SelectValue placeholder="Layout Direction" />
        </SelectTrigger>
        <SelectContent>
          <SelectItem value="TB">
            <div className="flex items-center gap-2">
              <ArrowDown size={14} />
              Top to Bottom
            </div>
          </SelectItem>
          <SelectItem value="LR">
            <div className="flex items-center gap-2">
              <ArrowRight size={14} />
              Left to Right
            </div>
          </SelectItem>
        </SelectContent>
      </Select>
      <Button
        variant="outline"
        onClick={() => onLayout('TB')}
        className="flex items-center gap-2"
      >
        <Layout size={14} />
        Auto Layout
      </Button>
    </div>
  );
}