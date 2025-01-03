// src/components/custom/TableNode.jsx
import { Trash2, Edit2 } from 'lucide-react';
import { Handle, Position } from 'reactflow';
import { DEFAULT_THEME } from '../../config/theme';

export function TableNode({
  data,
  onEditColumn,
  onDeleteColumn,
  onEditRelation,
  onDeleteRelation,
  theme = DEFAULT_THEME,
  selectedTable
}) {
  return (
    <div
      className="border rounded-lg shadow-lg min-w-[250px]"
      style={{
        background: theme.nodeBg,
        border: `1px solid ${theme.nodeBorder}`,
        color: theme.nodeText
      }}
    >
      <Handle type="target" position={Position.Top} />

      <div className="border-b-2 pb-2 mb-2 pt-2" style={{
        backgroundColor: selectedTable === data.name ? '#3b82f6' : 'transparent',
        color: selectedTable === data.name ? '#fff' : '#000',
        textAlign: 'center'
      }}>
        <h3 className="font-bold text-lg">{data.name}</h3>
      </div>

      <div className="space-y-2 p-4">
        {/* Primary Key */}
        <div className="flex items-center justify-between text-sm">
          <span className="font-semibold">id</span>
          <span style={{ color: theme.columnText }}>int4 (PK)</span>
        </div>

        {/* Columns */}
        {data.columns?.map((column, index) => (
          <div key={index} className="flex items-center justify-between text-sm group">
            <div className="flex-1">
              <span>{column.name}</span>
              <span
                className="ml-2"
                style={{ color: theme.columnText }}
              >
                {column.type}
                {column.nullable && ' (nullable)'}
              </span>
            </div>
            <div className="hidden group-hover:flex items-center gap-1">
              <button
                onClick={(e) => {
                  e.stopPropagation();
                  onEditColumn(index, column);
                }}
                className="p-1 hover:bg-gray-100 rounded"
              >
                <Edit2 size={14} />
              </button>
              <button
                onClick={(e) => {
                  e.stopPropagation();
                  onDeleteColumn(index);
                }}
                className="p-1 hover:bg-gray-100 rounded text-red-500"
              >
                <Trash2 size={14} />
              </button>
            </div>
          </div>
        ))}
      </div>

      {/* Relations */}
      <div className="mt-4 border-t pt-2">
        <h4 className="text-sm font-medium mb-2">Relations</h4>
        {data.relations?.map((relation, index) => (
          <div key={index} className="flex items-center justify-between text-sm group">
            <div className="flex-1">
              <span className="text-blue-600">{relation.name}</span>
              <span
                className="ml-2"
                style={{ color: theme.columnText }}
              >
                {relation.type}
              </span>
            </div>
            <div className="hidden group-hover:flex items-center gap-1">
              <button
                onMouseDown={event => event.stopPropagation()}
                onClick={(e) => {
                  e.stopPropagation();
                  console.log('relation1', relation)
                  onEditRelation({
                    ...relation,
                    sourceTable: data.name
                  });
                }}
                className="p-1 nodrag hover:bg-gray-100 rounded"
              >
                <Edit2 size={14} />
              </button>
              <button
                onMouseDown={event => event.stopPropagation()}
                onClick={(e) => {
                  e.stopPropagation();
                  onDeleteRelation(relation.id);
                }}
                className="p-1 nodrag hover:bg-gray-100 rounded text-red-500"
              >
                <Trash2 size={14} />
              </button>
            </div>
          </div>
        ))}
      </div>

      <Handle type="source" position={Position.Bottom} />
    </div>
  );
}