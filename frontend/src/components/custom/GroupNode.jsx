// src/components/custom/GroupNode.jsx
import { useCallback } from 'react';
import { Handle, Position } from 'reactflow';
import { Edit2, X } from 'lucide-react';

export function GroupNode({ data, onEditGroup, onDeleteGroup }) {
  const onDragOver = useCallback((event) => {
    event.preventDefault();
    event.dataTransfer.dropEffect = 'move';
  }, []);

  const onDrop = useCallback((event) => {
    event.preventDefault();
    const nodeType = event.dataTransfer.getData('application/reactflow');
    if (nodeType) {
      data.onDrop(nodeType);
    }
  }, [data]);

  return (
    <div
      className="border-2 border-dashed rounded-lg p-4 min-w-[300px] min-h-[200px] bg-gray-50/50"
      onDragOver={onDragOver}
      onDrop={onDrop}
    >
      <div className="flex justify-between items-center mb-4">
        <div className="font-medium text-sm text-gray-600">{data.label}</div>
        <div className="flex items-center gap-1">
          <button
            onClick={(e) => {
              e.stopPropagation();
              onEditGroup(data);
            }}
            className="p-1 hover:bg-gray-100 rounded"
          >
            <Edit2 size={14} />
          </button>
          <button
            onClick={(e) => {
              e.stopPropagation();
              onDeleteGroup();
            }}
            className="p-1 hover:bg-gray-100 rounded text-red-500"
          >
            <X size={14} />
          </button>
        </div>
      </div>
      <Handle type="target" position={Position.Left} />
      <Handle type="source" position={Position.Right} />
    </div>
  );
}