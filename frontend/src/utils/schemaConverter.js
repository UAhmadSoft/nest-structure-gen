// src/utils/schemaConverter.js
export function schemaToNodes(schema) {
  const nodes = [];
  const edges = [];

  schema.tables.forEach((table, index) => {
    // Create node
    const node = {
      id: table.name,
      type: 'tableNode',
      position: { x: 250 * index, y: 100 * index }, // Basic positioning
      data: {
        name: table.name,
        columns: Object.entries(table.properties).map(([name, prop]) => ({
          name,
          type: prop.type,
          nullable: prop.nullable || false
        })),
        relations: Object.entries(table.relations).map(([name, rel]) => ({
          name: rel.entity,
          type: rel.type,
          required: rel.required || false
        }))
      }
    };
    nodes.push(node);

    // Create edges for relations
    Object.entries(table.relations).forEach(([name, rel]) => {
      edges.push({
        id: `${table.name}-${rel.entity}`,
        source: table.name,
        target: rel.entity,
        label: rel.type,
        type: 'custom',
        animated: true,
        data: {
          relationType: rel.type,
          label: rel.type
        },
      });
    });


  });

  return { nodes, edges };
}