// src/components/custom/CustomEdges.jsx
import { getBezierPath } from 'reactflow';

const getEdgeColor = (type) => {
  switch (type) {
    case 'OneToMany':
      return '#3b82f6'; // blue
    case 'ManyToOne':
      return '#10b981'; // green
    case 'OneToOne':
      return '#8b5cf6'; // purple
    case 'ManyToMany':
      return '#f59e0b'; // amber
    default:
      return '#64748b'; // gray
  }
};

export function CustomEdge({
  id,
  sourceX,
  sourceY,
  targetX,
  targetY,
  sourcePosition,
  targetPosition,
  data,
  style = {},
  markerEnd,
}) {
  const [edgePath] = getBezierPath({
    sourceX,
    sourceY,
    sourcePosition,
    targetX,
    targetY,
    targetPosition,
  });

  const color = getEdgeColor(data?.relationType);

  return (
    <>
      <path
        id={id}
        style={{ ...style, strokeWidth: 2, stroke: color }}
        className="react-flow__edge-path"
        d={edgePath}
        markerEnd={markerEnd}
      />
      {data?.label && (
        <text>
          <textPath
            href={`#${id}`}
            style={{ fill: color, fontSize: 12 }}
            startOffset="50%"
            textAnchor="middle"
          >
            {data.label}
          </textPath>
        </text>
      )}
    </>
  );
}