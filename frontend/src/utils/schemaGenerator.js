// src/utils/schemaGenerator.js
export function generateSchema(nodes, projectPath) {
  const schema = {
    url: projectPath || "D:/Projects/NodeJs/my-project/src",
    char_primary_key: false,
    insert_to_modules: true,
    entity_module_file: `${projectPath}/infrastructure/entities/db.ts`,
    repository_module_file: `${projectPath}/infrastructure/repository/repository.module.ts`,
    usecase_module_file: `${projectPath}/usecases/usecase.module.ts`,
    controller_module_file: `${projectPath}/infrastructure/controllers/controller.module.ts`,
    tables: []
  };

  nodes.forEach(node => {
    const table = {
      name: node.data.name,
      create_pagination_route: true,
      create_relation_get_route: true,
      properties: {},
      relations: {}
    };

    // Add properties
    node.data.columns.forEach(column => {
      table.properties[column.name] = {
        type: column.type,
        nullable: column.nullable || false
      };
    });

    // Add relations
    node.data.relations?.forEach(relation => {
      table.relations[relation.name] = {
        type: relation.type,
        entity: nodes.find(n => n.id === relation.name)?.data.name,
        required: relation.required || false
      };
    });

    schema.tables.push(table);
  });

  return schema;
}