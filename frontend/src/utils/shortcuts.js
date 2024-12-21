// src/utils/shortcuts.js
import { useEffect } from 'react';

const shortcuts = {
  'ctrl+s': { action: 'save', description: 'Export Schema' },
  'ctrl+z': { action: 'undo', description: 'Undo' },
  'ctrl+y': { action: 'redo', description: 'Redo' },
  'ctrl+g': { action: 'group', description: 'Add Group' },
  'ctrl+f': { action: 'search', description: 'Search' },
  'delete': { action: 'delete', description: 'Delete Selected' },
  'esc': { action: 'deselect', description: 'Deselect' },
};

export function useKeyboardShortcuts(handlers) {
  useEffect(() => {
    const handleKeyDown = (event) => {
      const key = `${event.ctrlKey ? 'ctrl+' : ''}${event.key.toLowerCase()}`;
      const shortcut = shortcuts[key];

      if (shortcut && handlers[shortcut.action]) {
        event.preventDefault();
        handlers[shortcut.action]();
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [handlers]);

  return shortcuts;
}