
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
      name: toSingle(node.data.name),
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
          key = toSnakeCase(toSingle(relation.name)).toLowerCase() + '_id';
          break;

        case 'OneToOne':
          key = toSnakeCase(toSingle(relation.name)).toLowerCase() + '_id';
          break;

        case 'ManyToMany':
          key = undefined;

        default:
          break;
      }
      if (key) {
        let name = nodes.find(n => n.id === relation.name)?.data.name
        table.relations[key] = {
          type: relation.type,
          entity: toCamelCase(toSingle(name)),
          required: relation.required || false
        };
      }
    });

    schema.tables.push(table);
    const manyToManyRelations = nodes.filter(n => n.data.relations?.some(r => r.name === node.data.name && r.type === 'ManyToMany'));

    manyToManyRelations.forEach(relation => {
      // create a new table for many to many relation
      const table1 = toSnakeCase(node.data.name);
      const table2 = toSnakeCase(relation.data.name);

      const tableName = `${table1}_${table2}`;
      const table1Name = toCamelCase(toSingle(node.data.name));
      const table2Name = toCamelCase(toSingle(relation.data.name));

      const table1Key = `${table1Name}_id`;
      const table2Key = `${table2Name}_id`;

      schema.tables.push({
        name: tableName,
        create_pagination_route: true,
        create_relation_get_route: true,
        properties: {},
        relations: {
          [toSingle(toSingle(table1Key)).toLowerCase()]: {
            type: 'ManyToOne',
            entity: table1Name,
            required: true
          },
          [toSingle(toSingle(table2Key)).toLowerCase()]: {
            type: 'ManyToOne',
            entity: table2Name,
            required: true
          }
        }
      });
    });

  })


  schema.tables = Array.from(new Set(schema.tables.map(JSON.stringify))).map(JSON.parse);

  // for many to many tables, add relations to the main tables
  schema.tables.filter(table => Object.keys(table.properties).length === 0).forEach(table => {
    const table1 = toPascalCase(toSingle(table.name.split('_')[0]));
    const table2 = toPascalCase(toSingle(table.name.split('_')[1]));

    const table1Relation = {
      type: 'ManyToMany',
      entity: table2,
      required: false
    };

    const table2Relation = {
      type: 'ManyToMany',
      entity: table1,
      required: false
    };

    const table1Index = schema.tables.findIndex(t => t.name === table1);
    const table2Index = schema.tables.findIndex(t => t.name === table2);

    schema.tables[table1Index].relations[toPlural(table2).toLowerCase()] = table1Relation;
    schema.tables[table2Index].relations[toPlural(table1).toLowerCase()] = table2Relation;

    // change this table name
    table.name = `${toPascalCase(toSingle(table1))}${toPascalCase(toPlural(table2))}`;
  })



  return schema;
}