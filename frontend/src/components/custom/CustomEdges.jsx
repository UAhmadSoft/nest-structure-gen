import { getBezierPath } from 'reactflow';

function getEdgeAngle(sourceX, sourceY, targetX, targetY) {
  const angle = (Math.atan2(targetY - sourceY, targetX - sourceX) * 180) / Math.PI;
  if (angle > 90) return angle - 180;
  if (angle < -90) return angle + 180;
  return angle;
}

const getEdgeColor = (type) => {
  switch (type) {
    case 'OneToMany': return '#3b82f6';
    case 'ManyToOne': return '#10b981';
    case 'OneToOne': return '#8b5cf6';
    case 'ManyToMany': return '#f59e0b';
    default: return '#64748b';
  }
};

// Register this as a custom edge type in ReactFlow
// Usage: edgeTypes={{ custom: CustomEdge }}
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
  isSelected
}) {
  // console.log('id', id)
  const [edgePath, labelX, labelY] = getBezierPath({
    sourceX,
    sourceY,
    targetX,
    targetY,
    sourcePosition,
    targetPosition,
    curvature: 0.2 // Reduced curvature for smoother bends
  });

  const labelAngle = getEdgeAngle(sourceX, sourceY, targetX, targetY);
  const color = getEdgeColor(data?.relationType);

  return (
    <>
      <g className="react-flow__connection" style={{ zIndex: 1 }}>
        <path
          id={id}
          style={{
            ...style,
            strokeWidth: 2,
            stroke: color,
            fill: 'none',
            zIndex: 0
          }}
          className="react-flow__edge-path"
          d={edgePath}
          markerEnd={markerEnd}
        />
      </g>
      {data?.label && (
        <g className="react-flow__connection-label" style={{ zIndex: 2 }}>
          <text
            x={labelX}
            y={labelY}
            transform={`rotate(${labelAngle}, ${labelX}, ${labelY})`}
            style={{
              fill: color,
              fontSize: 12,
              fontWeight: 'bold',
              textAnchor: 'middle',
              dominantBaseline: 'central',
              pointerEvents: 'none'
            }}
          >
            {data.label}
          </text>
        </g>
      )}
    </>
  );
}