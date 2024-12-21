// src/components/custom/ExportImage.jsx
import { useState } from 'react';
import { Camera } from 'lucide-react';
import { Button } from '../ui/button';
import { useReactFlow } from 'reactflow';

export function ExportImage() {
  const [isExporting, setIsExporting] = useState(false);
  const { getNodes, getEdges, toObject } = useReactFlow();

  const handleExport = async () => {
    setIsExporting(true);
    try {
      const dataUrl = await toObject();
      const link = document.createElement('a');
      link.download = 'schema-diagram.png';
      link.href = dataUrl;
      document.body.appendChild(link);
      link.click();
      link.remove();
    } catch (error) {
      console.error('Failed to export image:', error);
    } finally {
      setIsExporting(false);
    }
  };

  return (
    <Button
      variant="outline"
      onClick={handleExport}
      disabled={isExporting}
      className="flex items-center gap-2"
    >
      <Camera size={16} />
      {isExporting ? 'Exporting...' : 'Export Image'}
    </Button>
  );
}