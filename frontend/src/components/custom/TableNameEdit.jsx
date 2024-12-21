// src/components/custom/TableNameEdit.jsx
import { useState } from 'react';
import { Edit2, Trash2 } from 'lucide-react';
import { Input } from '../ui/input';
import { Button } from '../ui/button';

export function TableNameEdit({ name, onEdit, onDelete }) {
  const [isEditing, setIsEditing] = useState(false);
  const [editedName, setEditedName] = useState(name);

  const handleSubmit = (e) => {
    e.preventDefault();
    if (editedName.trim() && editedName !== name) {
      onEdit(editedName.trim());
    }
    setIsEditing(false);
  };

  if (!isEditing) {
    return (
      <div className="flex items-center gap-2">
        <h2 className="text-lg font-bold">{name}</h2>
        <button
          onClick={() => setIsEditing(true)}
          className="p-1 hover:bg-gray-100 rounded"
        >
          <Edit2 size={14} />
        </button>
        <button
          onClick={onDelete}
          className="p-1 hover:bg-gray-100 rounded"
        >
          <Trash2 size={14} />
        </button>
      </div>
    );
  }

  return (
    <form onSubmit={handleSubmit} className="flex items-center gap-2">
      <Input
        value={editedName}
        onChange={(e) => setEditedName(e.target.value)}
        className="h-8"
        autoFocus
      />
      <Button type="submit" size="sm">Save</Button>
    </form>
  );
}