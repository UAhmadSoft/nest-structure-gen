// src/components/custom/GroupDialog.jsx
import { useState } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '../ui/dialog';
import { Input } from '../ui/input';
import { Button } from '../ui/button';

export function GroupDialog({ isOpen, onClose, onSave, initialData }) {
  const [groupData, setGroupData] = useState(initialData || {
    label: '',
    description: ''
  });

  const handleSubmit = (e) => {
    e.preventDefault();
    onSave(groupData);
    onClose();
  };

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>
            {initialData ? 'Edit Group' : 'Create Group'}
          </DialogTitle>
        </DialogHeader>
        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label className="text-sm font-medium">Group Name</label>
            <Input
              value={groupData.label}
              onChange={(e) => setGroupData(prev => ({
                ...prev,
                label: e.target.value
              }))}
              placeholder="Enter group name"
              required
            />
          </div>
          <div>
            <label className="text-sm font-medium">Description</label>
            <Input
              value={groupData.description}
              onChange={(e) => setGroupData(prev => ({
                ...prev,
                description: e.target.value
              }))}
              placeholder="Enter description"
            />
          </div>
          <Button type="submit">Save Group</Button>
        </form>
      </DialogContent>
    </Dialog>
  );
}