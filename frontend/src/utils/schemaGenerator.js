
const toSnakeCase = (string) => {
  let str = string.replace(/([A-Z])/g, (match) => `_${match.toLowerCase()}`)
  return str.startsWith('_') ? str.slice(1) : str;
};

const toCamelCase = (string) => {
  return string.replace(/([-_][a-z])/ig, (match) => match.toUpperCase().replace('-', '').replace('_', ''));
}

const toPascalCase = (string) => {
  return string.replace(/(\w)(\w*)/g, (g0, g1, g2) => g1.toUpperCase() + g2.toLowerCase());
}

const toSingle = (string) => {
  return string.endsWith('ies') ? (string.slice(0, -3) + 'y') :
    string.endsWith('s') ? (string.slice(0, -1)) :
      (string);
}

const toPlural = (string) => {
  return string.endsWith('s') ? (string) :
    string.endsWith('y') ? (string.slice(0, -1) + 'ies') :
      (string + 's');
}
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
        nullable: column.nullable || false,
        default: column.default || null,
        length: column.length || null,
        unsigned: column.unsigned || false
      };
    });

    // Add relations
    node.data.relations?.forEach(relation => {
      let key = '';
      switch (relation.type) {
        case 'OneToMany':
          key = toPlural(toSnakeCase(relation.name)).toLowerCase();
          break;

        case 'ManyToOne':
          key = toSnakeCase(relation.name) + '_id';
          break;

        case 'OneToOne':
          key = toSnakeCase(relation.name) + '_id';
          break;

        default:
          break;
      }
      let name = nodes.find(n => n.id === relation.name)?.data.name
      table.relations[key] = {
        type: relation.type,
        entity: toCamelCase(toSingle(name)),
        required: relation.required || false
      };
    });

    schema.tables.push(table);
  });

  return schema;
}