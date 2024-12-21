// src/components/custom/ShortcutsGuide.jsx
import { useState } from 'react';
import { Button } from '../ui/button';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '../ui/dialog';
import { Keyboard } from 'lucide-react';
import { useKeyboardShortcuts } from '../../utils/shortcuts';
export function ShortcutsGuide() {
  const [isOpen, setIsOpen] = useState(false);
  const shortcuts = useKeyboardShortcuts({});

  return (
    <>
      <Button
        variant="ghost"
        size="icon"
        onClick={() => setIsOpen(true)}
        className="shortcuts-button"
        title="Keyboard Shortcuts"
      >
        <Keyboard size={20} />
      </Button>

      <Dialog open={isOpen} onOpenChange={setIsOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Keyboard Shortcuts</DialogTitle>
          </DialogHeader>
          <div className="space-y-2">
            {Object.entries(shortcuts).map(([key, { description }]) => (
              <div key={key} className="flex justify-between items-center">
                <span className="text-sm">{description}</span>
                <kbd className="px-2 py-1 bg-gray-100 rounded text-sm">
                  {key.split('+').map(k => k.toUpperCase()).join(' + ')}
                </kbd>
              </div>
            ))}
          </div>
        </DialogContent>
      </Dialog>
    </>
  );
}