// src/components/custom/TableDialog.jsx
import { useState } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from '../ui/dialog';
import { Input } from '../ui/input';
import { Button } from '../ui/button';

export function TableDialog({ onAddTable }) {
  const [tableName, setTableName] = useState('');

  const handleSubmit = (e) => {
    e.preventDefault();
    onAddTable({
      name: tableName,
      columns: [],
      relations: []
    });
    setTableName('');
  };

  return (
    <Dialog>
      <DialogTrigger asChild>
        <Button className="w-full">Add Table</Button>
      </DialogTrigger>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Add New Table</DialogTitle>
        </DialogHeader>
        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label className="text-sm font-medium">Table Name</label>
            <Input
              value={tableName}
              onChange={(e) => setTableName(e.target.value)}
              placeholder="Enter table name"
              required
            />
          </div>
          <Button type="submit">Create Table</Button>
        </form>
      </DialogContent>
    </Dialog>
  );
}