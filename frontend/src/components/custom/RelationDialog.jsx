// src/components/custom/RelationDialog.jsx
import { useEffect, useState } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '../ui/dialog';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '../ui/select';
import { Button } from '../ui/button';

const RELATION_TYPES = [
  { value: 'OneToMany', label: 'One To Many' },
  { value: 'ManyToOne', label: 'Many To One' },
  { value: 'OneToOne', label: 'One To One' },
  { value: 'ManyToMany', label: 'Many To Many' }
];

export function RelationDialog({ isOpen, onClose, tables, sourceTable, onAddRelation, currentRelation }) {
  const [relation, setRelation] = useState(
    { type: 'OneToMany', targetTable: '', required: false }
  );

  useEffect(() => {
    console.log('currentRelation', currentRelation)
    if (currentRelation) {
      setRelation({
        type: currentRelation.type,
        targetTable: currentRelation.targetTable,
        required: currentRelation.required
      });
    }
  }, [currentRelation]);

  // Filter out source table from options
  // const availableTables = tables.filter(table => table.id !== sourceTable);
  const availableTables = tables;

  const handleSubmit = (e) => {
    e.preventDefault();
    onAddRelation({
      ...relation,
      sourceTable,
      id: currentRelation ? currentRelation.id : undefined
    });
    setRelation({ type: 'OneToMany', targetTable: '', required: false });
    onClose();
  };

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>{currentRelation ? 'Edit Relation' : 'Add Relation'}</DialogTitle>
        </DialogHeader>
        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label className="text-sm font-medium">Relation Type</label>
            <Select
              value={relation.type}
              onValueChange={(value) => setRelation({ ...relation, type: value })}
            >
              <SelectTrigger>
                <SelectValue placeholder="Select type" />
              </SelectTrigger>
              <SelectContent>
                {RELATION_TYPES.map((type) => (
                  <SelectItem key={type.value} value={type.value}>
                    {type.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div>
            <label className="text-sm font-medium">Target Table</label>
            <Select
              value={relation.targetTable}
              onValueChange={(value) => setRelation({ ...relation, targetTable: value })}
            >
              <SelectTrigger>
                <SelectValue placeholder="Select table" />
              </SelectTrigger>
              <SelectContent>
                {availableTables.map((table) => (
                  <SelectItem key={table.id} value={table.id}>
                    {table.data.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div className="flex items-center gap-2">
            <input
              type="checkbox"
              id="required"
              checked={relation.required}
              onChange={(e) => setRelation({ ...relation, required: e.target.checked })}
            />
            <label htmlFor="required" className="text-sm">Required</label>
          </div>

          <Button type="submit">Add Relation</Button>
        </form>
      </DialogContent>
    </Dialog>
  );
}