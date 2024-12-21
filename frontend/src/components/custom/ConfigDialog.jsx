// src/components/custom/ConfigDialog.jsx
import { useState } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '../ui/dialog';
import { Input } from '../ui/input';
import { Button } from '../ui/button';

export function ConfigDialog({ isOpen, onClose, onSave }) {
  const [projectPath, setProjectPath] = useState('');

  const handleSubmit = (e) => {
    e.preventDefault();
    onSave(projectPath);
    onClose();
  };

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Project Configuration</DialogTitle>
        </DialogHeader>
        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label className="text-sm font-medium">Project Path</label>
            <Input
              value={projectPath}
              onChange={(e) => setProjectPath(e.target.value)}
              placeholder="e.g., D:/Projects/NodeJs/my-project/src"
              required
            />
          </div>
          <Button type="submit">Save Configuration</Button>
        </form>
      </DialogContent>
    </Dialog>
  );
}