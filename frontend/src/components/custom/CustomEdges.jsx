import { getBezierPath } from 'reactflow';

function getEdgeAngle(sourceX, sourceY, targetX, targetY) {
  // Calculate raw angle in degrees
  const angle = (Math.atan2(targetY - sourceY, targetX - sourceX) * 180) / Math.PI;

  // Flip the text when angle is too large (so it doesn't show upside down)
  if (angle > 90) {
    return angle - 180;
  } else if (angle < -90) {
    return angle + 180;
  } else {
    return angle;
  }
}

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
  // `getBezierPath` can return [path, labelX, labelY].
  // The second and third items are recommended label coordinates on the curve.
  const [edgePath, labelX, labelY] = getBezierPath({
    sourceX,
    sourceY,
    targetX,
    targetY,
    sourcePosition,
    targetPosition,
  });

  const labelAngle = getEdgeAngle(sourceX, sourceY, targetX, targetY);
  const color = getEdgeColor(data?.relationType);

  return (
    <>
      <path
        id={id}
        style={{
          ...style,
          strokeWidth: 2,
          stroke: data?.color || '#999',
        }}
        className="react-flow__edge-path"
        d={edgePath}
        markerEnd={markerEnd}
      />
      {data?.label && (
        <text
          // place text at the recommended coordinates
          x={labelX}
          y={labelY}
          // rotate the text so that it’s never upside down
          transform={`rotate(${labelAngle}, ${labelX}, ${labelY})`}
          style={{ fill: color, fontSize: 18, fontWeight: 'bold' }}
        >
          {data.label}
        </text>
      )}
    </>
  );
}
