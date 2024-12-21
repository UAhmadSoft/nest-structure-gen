// src/components/custom/ColumnDialog.jsx
import { useState } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '../ui/dialog';
import { Input } from '../ui/input';
import { Button } from '../ui/button';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '../ui/select';
import { useEffect } from 'react';

const COLUMN_TYPES = [
  'varchar',
  'int',
  'boolean',
  'text',
  'float',
  'timestamp',
  'timestamptz',
  'json',
  'jsonb'
];

export function ColumnDialog({ isOpen, onClose, onAddColumn, editingColumn, onEditColumn }) {
  const [column, setColumn] = useState(() =>
    editingColumn || {
      name: '',
      type: 'varchar',
      nullable: false
    }
  );

  useEffect(() => {
    if (editingColumn) {
      setColumn(editingColumn);
    }
  }, [editingColumn]);

  const handleSubmit = (e) => {
    e.preventDefault();
    if (editingColumn) {
      onEditColumn(column);
    } else {
      onAddColumn(column);
    }
    setColumn({ name: '', type: 'varchar', nullable: false });
    onClose();
  };

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>
            {editingColumn ? 'Edit Column' : 'Add New Column'}
          </DialogTitle>
        </DialogHeader>
        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label className="text-sm font-medium">Column Name</label>
            <Input
              value={column.name}
              onChange={(e) => setColumn({ ...column, name: e.target.value })}
              placeholder="Enter column name"
              required
            />
          </div>

          <div>
            <label className="text-sm font-medium">Type</label>
            <Select
              value={column.type}
              onValueChange={(value) => setColumn({ ...column, type: value })}
            >
              <SelectTrigger>
                <SelectValue placeholder="Select type" />
              </SelectTrigger>
              <SelectContent>
                {COLUMN_TYPES.map((type) => (
                  <SelectItem key={type} value={type}>
                    {type}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div className="flex items-center gap-2">
            <input
              type="checkbox"
              id="nullable"
              checked={column.nullable}
              onChange={(e) => setColumn({ ...column, nullable: e.target.checked })}
            />
            <label htmlFor="nullable" className="text-sm">Nullable</label>
          </div>

          <Button type="submit">Add Column</Button>
        </form>
      </DialogContent>
    </Dialog>
  );
}