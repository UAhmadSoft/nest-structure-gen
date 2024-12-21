// src/utils/schemaValidation.js
export function validateSchema(nodes) {
  const errors = [];
  const tableNames = new Set();

  nodes.forEach(node => {
    // Validate table name
    if (!node.data.name) {
      errors.push(`Table with ID ${node.id} has no name`);
      return;
    }

    if (tableNames.has(node.data.name.toLowerCase())) {
      errors.push(`Duplicate table name: ${node.data.name}`);
    }
    tableNames.add(node.data.name.toLowerCase());

    // Validate columns
    if (!node.data.columns?.length) {
      errors.push(`Table ${node.data.name} has no columns`);
    }

    const columnNames = new Set();
    node.data.columns?.forEach(column => {
      if (!column.name) {
        errors.push(`Table ${node.data.name} has a column with no name`);
        return;
      }

      if (columnNames.has(column.name.toLowerCase())) {
        errors.push(`Table ${node.data.name} has duplicate column name: ${column.name}`);
      }
      columnNames.add(column.name.toLowerCase());
    });

    // Validate relations
    node.data.relations?.forEach(relation => {
      if (!relation.name) {
        errors.push(`Table ${node.data.name} has a relation with no target`);
        return;
      }

      const targetTable = nodes.find(n => n.id === relation.name);
      if (!targetTable) {
        errors.push(`Table ${node.data.name} has a relation to non-existent table: ${relation.name}`);
      }
    });
  });

  return errors;
}