// src/components/custom/SchemaImport.jsx
import { useState, useRef } from 'react';
import { Upload } from 'lucide-react';
import { Button } from '../ui/button';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '../ui/dialog';

export function SchemaImport({ onImport }) {
  const [isOpen, setIsOpen] = useState(false);
  const fileInputRef = useRef(null);

  const handleFileChange = (event) => {
    const file = event.target.files?.[0];
    if (file) {
      const reader = new FileReader();
      reader.onload = (e) => {
        try {
          const schema = JSON.parse(e.target?.result);
          onImport(schema);
          setIsOpen(false);
        } catch (error) {
          console.error('Error parsing schema:', error);
        }
      };
      reader.readAsText(file);
    }
  };

  return (
    <>
      <Button
        variant="outline"
        onClick={() => setIsOpen(true)}
        className="flex items-center gap-2"
      >
        <Upload size={16} />
        Import Schema
      </Button>

      <Dialog open={isOpen} onOpenChange={setIsOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Import Schema</DialogTitle>
          </DialogHeader>
          <div className="p-4">
            <div className="border-2 border-dashed rounded-lg p-8 text-center">
              <input
                type="file"
                ref={fileInputRef}
                onChange={handleFileChange}
                accept=".json"
                className="hidden"
              />
              <Button
                variant="outline"
                onClick={() => fileInputRef.current?.click()}
              >
                Select Schema File
              </Button>
              <p className="mt-2 text-sm text-gray-500">
                Only .json files are supported
              </p>
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </>
  );
}