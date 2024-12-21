// src/components/custom/ThemeCustomizer.jsx
import { useState } from 'react';
import { Paintbrush } from 'lucide-react';
import { Button } from '../ui/button';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from '../ui/dialog';
import { Input } from '../ui/input';

const DEFAULT_THEME = {
  nodeBg: '#ffffff',
  nodeText: '#000000',
  nodeBorder: '#e2e8f0',
  columnText: '#64748b',
  columnTypeBg: '#f1f5f9'
};

export function ThemeCustomizer({ theme, onThemeChange }) {
  const [isOpen, setIsOpen] = useState(false);
  const [localTheme, setLocalTheme] = useState(theme || DEFAULT_THEME);

  const handleSave = () => {
    onThemeChange(localTheme);
    setIsOpen(false);
  };

  return (
    <>
      <Button
        variant="outline"
        onClick={() => setIsOpen(true)}
        className="flex items-center gap-2"
      >
        <Paintbrush size={16} />
        Customize Theme
      </Button>

      <Dialog open={isOpen} onOpenChange={setIsOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Customize Theme</DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            {Object.entries(localTheme).map(([key, value]) => (
              <div key={key}>
                <label className="text-sm font-medium block mb-1">
                  {key.replace(/([A-Z])/g, ' $1').toLowerCase()}
                </label>
                <div className="flex gap-2">
                  <Input
                    type="color"
                    value={value}
                    onChange={(e) =>
                      setLocalTheme(prev => ({
                        ...prev,
                        [key]: e.target.value
                      }))
                    }
                    className="w-12 p-1 h-8"
                  />
                  <Input
                    type="text"
                    value={value}
                    onChange={(e) =>
                      setLocalTheme(prev => ({
                        ...prev,
                        [key]: e.target.value
                      }))
                    }
                    className="flex-1"
                  />
                </div>
              </div>
            ))}
            <Button onClick={handleSave} className="w-full">
              Apply Theme
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </>
  );
}