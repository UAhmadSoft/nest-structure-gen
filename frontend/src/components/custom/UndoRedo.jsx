// src/components/custom/UndoRedo.jsx
import { useReactFlow } from 'reactflow';
import { Undo2, Redo2 } from 'lucide-react';
import { Button } from '../ui/button';

export function UndoRedo() {
  const { undo, redo, canUndo, canRedo } = useReactFlow();

  return (
    <div className="flex gap-1">
      <Button
        variant="ghost"
        size="icon"
        onClick={undo}
        disabled={!canUndo}
        title="Undo (Ctrl+Z)"
      >
        <Undo2 size={16} />
      </Button>
      <Button
        variant="ghost"
        size="icon"
        onClick={redo}
        disabled={!canRedo}
        title="Redo (Ctrl+Y)"
      >
        <Redo2 size={16} />
      </Button>
    </div>
  );
}