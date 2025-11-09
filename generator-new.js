const fs = require('fs');
const path = require('path');
const pluralize = require('pluralize');
const prettier = require('prettier');
const { Project } = require('ts-morph');
const chalk = require('chalk');

class NestjsResourceGenerator {
  constructor(schemaPath) {
    this.schema = JSON.parse(fs.readFileSync(schemaPath, 'utf8'));
    this.project = new Project();

    // Initialize chalk for colorful logging
    this.log = {
      info: (msg) => console.log(chalk.cyan('ℹ'), msg),
      success: (msg) => console.log(chalk.green('✓'), chalk.green(msg)),
      warning: (msg) => console.log(chalk.yellow('⚠'), chalk.yellow(msg)),
      error: (msg) => console.log(chalk.red('✗'), chalk.red(msg)),
      process: (msg) => console.log(chalk.blue('➤'), chalk.blue(msg)),
      file: (msg) => console.log(chalk.magenta('  📄'), chalk.gray(msg))
    };

    // Transform paths to use root
    if (this.schema.root && this.schema.paths) {
      this.schema.url = this.schema.root + (this.schema.paths.src || '/src');
      this.schema.entity_module_file = this.schema.root + this.schema.paths.entity_module;
      this.schema.repository_module_file = this.schema.root + this.schema.paths.repository_module;
      this.schema.usecase_module_file = this.schema.root + this.schema.paths.usecase_module;
      this.schema.controller_module_file = this.schema.root + this.schema.paths.controller_module;
      this.schema.entities_folder = path.relative(
        this.schema.root,
        path.dirname(this.schema.entity_module_file)
      ).replace(/\\/g, '/');

    }
  }

  // Utility functions for naming conventions
  getPascalCase(str) {
    return str
      .split(/[-_\s]/)
      .map(word => word.charAt(0).toUpperCase() + word.slice(1))
      .join('');
  }

  getCamelCase(str) {
    const intermediate = str.replace(/([-_][a-z])/ig, (match) =>
      match.toUpperCase().replace('-', '').replace('_', '')
    );
    return intermediate.charAt(0).toLowerCase() + intermediate.slice(1);
  }

  getPlural(str) {
    return pluralize(str);
  }

  getPascalSpaceCase(str) {
    return str.replace(/([A-Z])/g, (match) => ` ${this.getPascalCase(match)}`).trim();
  }

  toSnakeCase(string) {
    let str = string.replace(/([A-Z])/g, (match) => `_${match.toLowerCase()}`)
    return str.startsWith('_') ? str.slice(1) : str;
  };

  toSingle(string) {
    return string.endsWith('ies') ? (string.slice(0, -3) + 'y') :
      string.endsWith('s') ? string.slice(0, -1) : string;
  }

  getEntityClassName(name) {
    return this.getPlural(this.getPascalCase(name));
  }

  getEntityFileName(name) {
    return `${name.toLowerCase()}.entity.ts`;
  }

  // Helper method to extract enum names from properties
  getEnumsFromTable(table) {
    const enums = {};
    Object.entries(table.properties).forEach(([key, prop]) => {
      if (prop.type === 'enum' && prop.enum) {
        const enumName = `${this.getPascalCase(table.name)}${this.getPascalCase(key)}Enum`;

        // Default useDbEnum to true if not explicitly set to false
        const useDbEnum = prop.useDbEnum !== false;

        // Validate: if useDbEnum is true, dbEnumName must be provided
        if (useDbEnum && !prop.dbEnumName) {
          throw new Error(
            `❌ Table "${table.name}" -> Property "${key}": ` +
            `When enum type is used with useDbEnum=true (or not explicitly set to false), ` +
            `"dbEnumName" must be provided. ` +
            `Either provide "dbEnumName" or set "useDbEnum: false" to use varchar column.`
          );
        }

        enums[key] = {
          name: enumName,
          values: prop.enum,
          useDbEnum: useDbEnum,
          dbEnumName: useDbEnum ? prop.dbEnumName : null
        };
      }
    });
    return enums;
  }

  // Helper method to extract indexes from table
  getIndexesFromTable(table) {
    if (!table.indexes || !Array.isArray(table.indexes)) {
      return [];
    }
    return table.indexes.map((index, idx) => ({
      columns: index.columns || [],
      unique: index.unique || false,
      name: index.name || `idx_${table.name.toLowerCase()}_${index.columns.join('_')}`
    }));
  }

  // Helper method to extract check constraints from table
  getCheckConstraintsFromTable(table) {
    if (!table.constraints || !Array.isArray(table.constraints)) {
      return [];
    }
    return table.constraints.filter(c => c.type === 'CHECK').map(constraint => ({
      name: constraint.name || `chk_${table.name.toLowerCase()}_${Date.now()}`,
      expression: constraint.expression
    }));
  }

  // Helper method to extract unique constraints from table
  getUniqueConstraintsFromTable(table) {
    if (!table.constraints || !Array.isArray(table.constraints)) {
      return [];
    }
    return table.constraints.filter(c => c.type === 'UNIQUE').map(constraint => ({
      name: constraint.name || `uniq_${table.name.toLowerCase()}_${constraint.columns.join('_')}`,
      columns: constraint.columns || []
    }));
  }

  // Generate enum file for a table
  async generateEnumFile(table) {
    const enums = this.getEnumsFromTable(table);
    if (Object.keys(enums).length === 0) return null;

    const entityName = this.getPascalCase(table.name);
    const fileName = `${table.name.toLowerCase()}-enums.enum.ts`;

    let enumDefinitions = [];
    let enumArrays = [];

    Object.entries(enums).forEach(([key, enumData]) => {
      // Create enum definition
      enumDefinitions.push(`
export enum ${enumData.name} {
  ${enumData.values.map(value =>
        `${value.toUpperCase().replace(/[^A-Z0-9]/g, '_')} = '${value}'`
      ).join(',\n  ')}
}`);

      // Create array of values
      enumArrays.push(`
export const ${enumData.name}Values = [
  ${enumData.values.map(value => `'${value}'`).join(',\n  ')}
] as const;`);
    });

    const template = `${enumDefinitions.join('\n\n')}
${enumArrays.join('\n')}

export type ${entityName}EnumTypes = {
  ${Object.entries(enums).map(([key, enumData]) =>
      `${key}: ${enumData.name}`
    ).join(';\n  ')};
};
`;

    const formattedCode = await this.formatCode(template);
    return { fileName, content: formattedCode };
  }

  // Generate entity with enum support
  generateEntity(table) {
    const entityClassName = this.getEntityClassName(table.name);
    const tableName = this.toSnakeCase(this.getCamelCase(this.getPlural(table.name))).toLowerCase();
    const enums = this.getEnumsFromTable(table);
    const indexes = this.getIndexesFromTable(table);

    // Build import statements
    const imports = [`
import {
  Entity,
  PrimaryGeneratedColumn,
  CreateDateColumn,
  UpdateDateColumn,
  Column,
  OneToOne,
  OneToMany,
  ManyToOne,
  ManyToMany,
  JoinTable,
  JoinColumn,
  Index
} from 'typeorm';`];

    // Add enum imports if needed
    if (Object.keys(enums).length > 0) {
      const enumImports = Object.values(enums).map(e => e.name).join(', ');
      imports.push(`import { ${enumImports} } from '../enums/${table.name.toLowerCase()}-enums.enum';`);
    }

    // Add relation entity imports
    const relationImports = new Set();
    Object.entries(table.relations || {}).forEach(([key, rel]) => {
      if (rel.entity) {
        const relatedEntity = this.getEntityClassName(rel.entity);
        relationImports.add(`import { ${relatedEntity} } from './${rel.entity.toLowerCase()}.entity';`);
      }
    });
    imports.push(...Array.from(relationImports));

    // Build index decorators
    const indexDecorators = indexes.map(index => {
      const columns = index.columns.map(col => `"${col}"`).join(', ');
      return `@Index("${index.name}", [${columns}]${index.unique ? ', { unique: true }' : ''})`;
    }).join('\n');

    const template = `${imports.join('\n')}

${indexDecorators ? indexDecorators + '\n' : ''}@Entity('${tableName}')
export class ${entityClassName} {
  @PrimaryGeneratedColumn({ type: '${this.schema.char_primary_key ? 'uuid' : 'int4'}' })
  id: ${this.schema.char_primary_key ? 'string' : 'number'};

  ${Object.entries(table.properties).map(([key, prop]) => {
      if (prop.type === 'enum') {
        const enumData = enums[key];
        if (enumData.useDbEnum) {
          // Database-level enum
          const defaultValue = prop.default ? `, default: ${enumData.name}.${prop.default.toUpperCase().replace(/[^A-Z0-9]/g, '_')}` : '';
          return `
  @Column({
    type: 'enum',
    enum: ${enumData.name}${prop.required === false ? ', nullable: true' : ''}${prop.unique === true ? ', unique: true' : ''}${defaultValue}
  })
  ${key}: ${enumData.name};`;
        } else {
          // TypeScript-only enum (varchar column)
          return `
  @Column({ type: 'varchar'${prop.required === false ? ', nullable: true' : ''}${prop.unique === true ? ', unique: true' : ''}${prop.default ? `, default: '${prop.default}'` : ''} })
  ${key}: ${enumData.name};`;
        }
      } else {
        // Handle default values properly for different types
        let defaultClause = '';
        if (prop.default !== undefined) {
          if (prop.type === 'jsonb' || prop.type === 'json') {
            // For jsonb/json, use raw SQL default - escape quotes for template literals
            const escapedDefault = prop.default.replace(/"/g, '\\"');
            defaultClause = `, default: () => "${escapedDefault}"`;
          } else if (typeof prop.default === 'string') {
            defaultClause = `, default: '${prop.default}'`;
          } else {
            defaultClause = `, default: ${prop.default}`;
          }
        }

        return `
  @Column({ type: '${prop.type}'${prop.required === false ? ', nullable: true' : ''}${prop.unique === true ? ', unique: true' : ''}${defaultClause} })
  ${key}: ${this.getTypeScriptType(prop.type)};`;
      }
    }).join('\n')}

  ${Object.entries(table.relations || {}).map(([key, rel]) =>
      this.generateRelation(key, rel, table.name)
    ).join('\n')}

  @CreateDateColumn({ type: 'timestamp' })
  created_on: Date;

  @UpdateDateColumn({ type: 'timestamp' })
  updated_on: Date;
}`;

    return this.formatCode(template);
  }

  // Generate DTO with proper imports and enum support
  generateDto(table) {
    const entityName = this.getPascalCase(table.name);
    const enums = this.getEnumsFromTable(table);

    // Build imports
    const imports = [
      `import { IsString, IsNotEmpty, IsOptional, IsNumber, IsBoolean, IsDate, IsEnum } from 'class-validator';`,
      `import { ApiProperty } from '@nestjs/swagger';`
    ];

    // Add enum imports if needed
    if (Object.keys(enums).length > 0) {
      const enumImports = Object.values(enums).map(e => e.name).join(', ');
      imports.push(`import { ${enumImports} } from '../../enums/${table.name.toLowerCase()}-enums.enum';`);
    }

    // Helper to build ApiProperty options
    function buildApiPropertyOptions(key, prop) {
      const options = {
        required: prop.required === false ? false : true,
        type: prop.type === 'varchar' || prop.type === 'text' ? 'string' : prop.type === 'int' || prop.type === 'int4' ? 'number' : prop.type === 'boolean' ? 'boolean' : prop.type,
        example: prop.example !== undefined ? prop.example : (prop.type === 'varchar' || prop.type === 'text' ? `${key}_example` : prop.type === 'int' || prop.type === 'int4' ? 1 : prop.type === 'boolean' ? true : null),
      };
      if (prop.enum) {
        options.enum = prop.enum;
      }
      if (prop.description) {
        options.description = prop.description;
      }
      return options;
    }

    const template = `${imports.join('\n')}

export class Create${entityName}Dto {
  ${Object.entries(table.properties).map(([key, prop]) => {
      if (prop.type === 'enum') {
        return `
  ${prop.required === false ? '@IsOptional()' : '@IsNotEmpty()'}
  @IsEnum(${enums[key].name})
  @ApiProperty(${JSON.stringify(buildApiPropertyOptions(key, prop))})
  ${key}: ${enums[key].name};`;
      } else {
        return `
  ${prop.required === false ? '@IsOptional()' : '@IsNotEmpty()'}
  ${this.getPropTypeValidator(prop.type)}
  @ApiProperty(${JSON.stringify(buildApiPropertyOptions(key, prop))})
  ${key}: ${this.getTypeScriptType(prop.type)};`;
      }
    }).join('\n')}
  
  ${Object.entries(table.relations || {}).map(([key, prop]) =>
      (prop.type === 'ManyToOne' || (prop.type === 'OneToOne' && prop.isOwner === false)) ? `
  ${prop.required ? '@IsOptional()' : '@IsNotEmpty()'}
  @IsNumber()
  @ApiProperty({ required: ${prop.required}, type: 'number', example: 1 })
  ${key}${prop.required === false ? "?" : ""}: number;` : ""
    ).join('\n')}
}

export class Update${entityName}Dto {
  ${Object.entries(table.properties).map(([key, prop]) => {
      if (prop.type === 'enum') {
        return `
  @IsOptional()
  @IsEnum(${enums[key].name})
  @ApiProperty(${JSON.stringify({ ...buildApiPropertyOptions(key, prop), required: false })})
  ${key}?: ${enums[key].name};`;
      } else {
        return `
  @IsOptional()
  ${this.getPropTypeValidator(prop.type)}
  @ApiProperty(${JSON.stringify({ ...buildApiPropertyOptions(key, prop), required: false })})
  ${key}?: ${this.getTypeScriptType(prop.type)};`;
      }
    }).join('\n')}
  
  ${Object.entries(table.relations || {}).map(([key, prop]) =>
      (prop.type === 'ManyToOne' || (prop.type === 'OneToOne' && prop.isOwner === false)) ? `
  @IsOptional()
  @IsNumber()
  @ApiProperty({ required: false, type: 'number', example: 1 })
  ${key}?: number;` : ""
    ).join('\n')}
}

export class Query${entityName}Dto {
  @IsOptional()
  @ApiProperty({ required: false, type: 'number', example: 1 })
  page?: number;

  @IsOptional()
  @ApiProperty({ required: false, type: 'number', example: 10 })
  limit?: number;

  @IsOptional()
  @ApiProperty({ required: false, type: 'string', example: '-id' })
  sort?: string;
}`;

    return this.formatCode(template);
  }

  // Generate model with enum support
  generateModel(table) {
    const entityName = this.getPascalCase(table.name);
    const enums = this.getEnumsFromTable(table);

    // Build imports
    const imports = [];
    if (Object.keys(enums).length > 0) {
      const enumImports = Object.values(enums).map(e => e.name).join(', ');
      imports.push(`import { ${enumImports} } from '../../infrastructure/enums/${table.name.toLowerCase()}-enums.enum';`);
    }

    // Add relation model imports
    const relationImports = new Set();
    Object.entries(table.relations || {}).forEach(([key, rel]) => {
      if (rel.entity) {
        const entityFileName = rel.entity.toLowerCase();
        const relationFileName = `${this.schema.entities_folder}/${entityFileName}.entity`;
        const entityClassName = this.getEntityClassName(rel.entity || key);

        relationImports.add(`import { ${this.getPlural(this.getPascalCase(rel.entity))} } from '${relationFileName}';`);
      }
    });
    imports.push(...Array.from(relationImports));

    const template = `${imports.join('\n')}

export class ${entityName}Model {
  ${Object.entries(table.properties).map(([key, prop]) => {
      const optional = prop.required === false ? '?' : '';
      if (prop.type === 'enum') {
        return `${key}${optional}: ${enums[key].name};`;
      } else {
        return `${key}${optional}: ${this.getTypeScriptType(prop.type)};`;
      }
    }).join('\n  ')}
  
  ${Object.entries(table.relations || {}).map(([key, rel]) => {
      if (rel.type === 'ManyToOne') {
        return `${this.toSnakeCase(key)}${rel.required === false ? '?' : ''}: number;`;
      }
      else if (rel.type === 'OneToOne' && !rel.isOwner) {
        return `${this.toSnakeCase(key)}${rel.required === false ? '?' : ''}: number;`;
      }
      return '';
    }).filter(Boolean).join('\n  ')}
}

export class Fetch${entityName}Model extends ${entityName}Model {
  id: ${this.schema.char_primary_key ? 'string' : 'number'};
  created_on: Date;
  updated_on: Date;
  
  ${Object.entries(table.relations || {}).map(([key, rel]) => {
      if (rel.type === 'ManyToOne') {
        return `${this.toSnakeCase(key).replace("_id", "_data")}${rel.required === true ? "" : "?"}: ${this.getEntityClassName(rel.entity || key)};`;
      } else if (rel.type === 'OneToMany') {
        return `${this.getCamelCase(this.getPlural(key))}?: ${this.getEntityClassName(rel.entity || key)}[];`;
      } else if (rel.type === 'OneToOne' && !rel.isOwner) {
        return `${this.toSnakeCase(key).replace("_id", "_data")}${rel.required === true ? "" : "?"}: ${this.getEntityClassName(rel.entity || key)};`;
      }
      return '';
    }).filter(Boolean).join('\n  ')}
}

export class Update${entityName}Model {
  ${Object.entries(table.properties).map(([key, prop]) => {
      if (prop.type === 'enum') {
        return `${key}?: ${enums[key].name};`;
      } else {
        return `${key}?: ${this.getTypeScriptType(prop.type)};`;
      }
    }).join('\n  ')}
  
  ${Object.entries(table.relations || {}).map(([key, rel]) => {
      if (rel.type === 'ManyToOne') {
        return `${this.toSnakeCase(key)}?: number;`;
      }
      return '';
    }).filter(Boolean).join('\n  ')}
}`;

    return this.formatCode(template);
  }

  // Generate repository interface with proper imports
  generateRepositoryInterface(table) {
    const entityName = this.getPascalCase(table.name);

    const template = `
import { ${entityName}Model, Fetch${entityName}Model, Update${entityName}Model } from 'src/domain/models/${(table.name).toLowerCase()}.model';
import { PaginatedResponse } from 'src/domain/common/interfaces/paginated-response.interface';
import { Query${entityName}Dto } from 'src/infrastructure/controllers/${(table.name).toLowerCase()}/${(table.name).toLowerCase()}.dto';

export interface I${entityName} {
  create${entityName}(${this.getCamelCase(table.name)}Model: ${entityName}Model): Promise<Fetch${entityName}Model>;
  get${entityName}ById(id: ${this.schema.char_primary_key ? 'string' : 'number'}): Promise<Fetch${entityName}Model>;
  get${this.getPlural(entityName)}(query: Query${entityName}Dto): Promise<PaginatedResponse<Fetch${entityName}Model>>;
  update${entityName}(id: ${this.schema.char_primary_key ? 'string' : 'number'}, update${entityName}Model: Update${entityName}Model): Promise<Fetch${entityName}Model>;
  delete${entityName}(id: ${this.schema.char_primary_key ? 'string' : 'number'}): Promise<void>;
  
  ${Object.entries(table.relations || {}).map(([key, rel]) =>
      rel.type === 'OneToMany' ?
        `get${this.getCamelCase(this.getPlural(key.replace("_id", "")))}Of${entityName}(id: ${this.schema.char_primary_key ? 'string' : 'number'}): Promise<any[]>;` : ''
    ).join('\n  ')}
}`;

    return this.formatCode(template);
  }

  // Generate repository implementation with proper imports
  generateRepository(table) {
    const entityName = this.getPascalCase(table.name);
    const pluralEntityName = this.getPlural(entityName);

    const template = `
import { Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { ${entityName}Model, Fetch${entityName}Model, Update${entityName}Model } from 'src/domain/models/${(table.name).toLowerCase()}.model';
import { I${entityName} } from 'src/domain/repositories/${(table.name).toLowerCase()}.repository.interface';
import { ${pluralEntityName} } from 'src/infrastructure/entities/${(entityName).toLowerCase()}.entity';
import { PaginatedResponse } from 'src/domain/common/interfaces/paginated-response.interface';
import { Query${entityName}Dto } from 'src/infrastructure/controllers/${(table.name).toLowerCase()}/${(table.name).toLowerCase()}.dto';

@Injectable()
export class ${entityName}Repository implements I${entityName} {
  constructor(
    @InjectRepository(${pluralEntityName})
    private ${this.getCamelCase(table.name)}Repository: Repository<${pluralEntityName}>,
  ) {}

  async create${entityName}(${this.getCamelCase(table.name)}Model: ${entityName}Model): Promise<Fetch${entityName}Model> {
    const ${this.getCamelCase(table.name)} = await this.${this.getCamelCase(table.name)}Repository.save(${this.getCamelCase(table.name)}Model);
    return ${this.getCamelCase(table.name)};
  }

  async get${entityName}ById(id: ${this.schema.char_primary_key ? 'string' : 'number'}): Promise<Fetch${entityName}Model> {
    const ${this.getCamelCase(table.name)} = await this.${this.getCamelCase(table.name)}Repository.findOne({ where: { id } });
    if (!${this.getCamelCase(table.name)}) {
      throw new NotFoundException('${entityName} not found');
    }
    return ${this.getCamelCase(table.name)};
  }

  async get${this.getPlural(entityName)}(query: Query${entityName}Dto): Promise<PaginatedResponse<Fetch${entityName}Model>> {
    const page = query.page || 1;
    const limit = query.limit || 10;
    const skip = (page - 1) * limit;
    
    const order = query.sort ? this.buildSortObject(query.sort) : {};
    
    const [data, total] = await this.${this.getCamelCase(table.name)}Repository.findAndCount({
      skip,
      take: limit,
      order,
    });

    return {
      data,
      meta: {
        total,
        page,
        limit
      }
    };
  }

  async update${entityName}(id: ${this.schema.char_primary_key ? 'string' : 'number'}, updateModel: Update${entityName}Model): Promise<Fetch${entityName}Model> {
    const ${this.getCamelCase(table.name)} = await this.get${entityName}ById(id);
    Object.assign(${this.getCamelCase(table.name)}, updateModel);
    return await this.${this.getCamelCase(table.name)}Repository.save(${this.getCamelCase(table.name)});
  }

  async delete${entityName}(id: ${this.schema.char_primary_key ? 'string' : 'number'}): Promise<void> {
    const result = await this.${this.getCamelCase(table.name)}Repository.delete(id);
    if (result.affected === 0) {
      throw new NotFoundException('${entityName} Not Found');
    }
    return;
  }

  ${Object.entries(table.relations || {}).map(([key, rel]) => {
      if (rel.type === 'OneToMany') {
        return `
  async get${this.getCamelCase(this.getPlural(key.replace("_id", "")))}Of${entityName}(id: ${this.schema.char_primary_key ? 'string' : 'number'}): Promise<any[]> {
    const ${this.getCamelCase(table.name)} = await this.${this.getCamelCase(table.name)}Repository.findOne({
      where: { id },
      relations: ['${this.toSnakeCase(key)}'],
    });
    return ${this.getCamelCase(table.name)}?.${this.toSnakeCase(key)} || [];
  }`;
      }
      return '';
    }).join('\n')}

  private buildSortObject(sort: string) {
    const order: Record<string, 'ASC' | 'DESC'> = {};
    const fields = sort.split(',');
    
    fields.forEach(field => {
      if (field.startsWith('-')) {
        order[field.substring(1)] = 'DESC';
      } else {
        order[field] = 'ASC';
      }
    });
    
    return order;
  }
}`;

    return this.formatCode(template);
  }

  // Generate usecase with proper imports
  generateUseCase(table) {
    const entityName = this.getPascalCase(table.name);

    const template = `
import { Injectable } from '@nestjs/common';
import { ${entityName}Model, Update${entityName}Model } from 'src/domain/models/${(table.name).toLowerCase()}.model';
import { ${entityName}Repository } from 'src/infrastructure/repository/${(table.name).toLowerCase()}.repository';
import { Query${entityName}Dto } from 'src/infrastructure/controllers/${(table.name).toLowerCase()}/${(table.name).toLowerCase()}.dto';

@Injectable()
export class ${entityName}UseCases {
  constructor(private readonly ${this.getCamelCase(table.name)}Repository: ${entityName}Repository) {}

  async create${entityName}(${this.getCamelCase(table.name)}Model: ${entityName}Model) {
    return await this.${this.getCamelCase(table.name)}Repository.create${entityName}(${this.getCamelCase(table.name)}Model);
  }

  async get${entityName}ById(id: ${this.schema.char_primary_key ? 'string' : 'number'}) {
    return await this.${this.getCamelCase(table.name)}Repository.get${entityName}ById(id);
  }

  async get${this.getPlural(entityName)}(query: Query${entityName}Dto) {
    return await this.${this.getCamelCase(table.name)}Repository.get${this.getPlural(entityName)}(query);
  }

  async update${entityName}(id: ${this.schema.char_primary_key ? 'string' : 'number'}, ${this.getCamelCase(table.name)}UpdateModel: Update${entityName}Model) {
    return await this.${this.getCamelCase(table.name)}Repository.update${entityName}(id, ${this.getCamelCase(table.name)}UpdateModel);
  }

  async delete${entityName}(id: ${this.schema.char_primary_key ? 'string' : 'number'}) {
    return await this.${this.getCamelCase(table.name)}Repository.delete${entityName}(id);
  }

  ${Object.entries(table.relations || {}).map(([key, rel]) =>
      rel.type === "OneToMany" ? `
  async get${this.getCamelCase(this.getPlural(key.replace("_id", "")))}Of${entityName}(id: ${this.schema.char_primary_key ? 'string' : 'number'}) {
    return await this.${this.getCamelCase(table.name)}Repository.get${this.getCamelCase(this.getPlural(key.replace("_id", "")))}Of${entityName}(id);
  }` : ""
    ).join('\n')}
}`;

    return this.formatCode(template);
  }

  // Generate controller with proper imports
  generateController(table) {
    const entityName = this.getPascalCase(table.name);
    // Example success response for POST
    const postExample = {
      id: 1,
      ...Object.fromEntries(Object.entries(table.properties).map(([key, prop]) => [key, prop.example || (prop.type === 'varchar' || prop.type === 'text' ? `${key}_example` : prop.type === 'int' || prop.type === 'int4' ? 1 : prop.type === 'boolean' ? true : null)])),
      created_on: '2025-10-31T10:00:00Z',
      updated_on: '2025-10-31T10:00:00Z',
    };
    // Example error responses
    const validationErrorExample = {
      statusCode: 400,
      message: 'Validation failed',
    };
    const unauthorizedExample = {
      statusCode: 401,
      message: 'Unauthorized',
      error: 'Unauthorized',
    };
    // Example GET response
    const getExample = {
      data: [postExample],
      meta: {
        total: 1,
        page: 1,
        limit: 10,
      },
    };
    const template = `
import {
  Controller,
  Get,
  Post,
  Put,
  Delete,
  Body,
  Param,
  Query,
  UseGuards,
  ParseIntPipe,
} from '@nestjs/common';
import { JwtAuthGuard } from 'src/infrastructure/common/guards/jwtAuth.guard';
import { ${entityName}UseCases } from 'src/usecases/${(table.name).toLowerCase()}/${(table.name).toLowerCase()}.usecases';
import { Create${entityName}Dto, Update${entityName}Dto, Query${entityName}Dto } from './${(table.name).toLowerCase()}.dto';
import { ApiTags, ApiOperation, ApiResponse, ApiQuery } from '@nestjs/swagger';

@ApiTags('${(this.getPascalSpaceCase(this.getPlural(table.name)))}')
@Controller('${this.toSnakeCase(this.getCamelCase(this.getPlural(table.name)))}')
@UseGuards(JwtAuthGuard)
export class ${entityName}Controller {
  constructor(private readonly ${this.getCamelCase(table.name)}UseCases: ${entityName}UseCases) {}

  @Post()
  @ApiOperation({ summary: 'Create ${table.name}' })
  @ApiResponse({
    status: 201,
    description: '${table.name} created successfully',
    content: {
      'application/json': {
        example: ${JSON.stringify(postExample, null, 2)}
      }
    }
  })
  @ApiResponse({
    status: 400,
    description: 'Validation failed',
    content: {
      'application/json': {
        example: ${JSON.stringify(validationErrorExample, null, 2)}
      }
    }
  })
  @ApiResponse({
    status: 401,
    description: 'Unauthorized',
    content: {
      'application/json': {
        example: ${JSON.stringify(unauthorizedExample, null, 2)}
      }
    }
  })
  create${entityName}(@Body() ${this.getCamelCase(table.name)}: Create${entityName}Dto) {
    return this.${this.getCamelCase(table.name)}UseCases.create${entityName}(${this.getCamelCase(table.name)});
  }

  @Get(':id')
  @ApiOperation({ summary: 'Get ${table.name} by id' })
  @ApiResponse({
    status: 200,
    description: '${table.name} retrieved successfully',
    content: {
      'application/json': {
        example: ${JSON.stringify(postExample, null, 2)}
      }
    }
  })
  @ApiResponse({
    status: 401,
    description: 'Unauthorized',
    content: {
      'application/json': {
        example: ${JSON.stringify(unauthorizedExample, null, 2)}
      }
    }
  })
  get${entityName}ById(@Param('id', ParseIntPipe) id: ${this.schema.char_primary_key ? 'string' : 'number'}) {
    return this.${this.getCamelCase(table.name)}UseCases.get${entityName}ById(id);
  }

  @Get()
  @ApiOperation({ summary: 'Get all ${this.getPlural(table.name)}' })
  @ApiQuery({ name: 'page', type: Number, example: 1, required: false })
  @ApiQuery({ name: 'limit', type: Number, example: 10, required: false })
  @ApiQuery({ name: 'sort', type: String, example: '-id', required: false })
  @ApiResponse({
    status: 200,
    description: '${this.getPlural(table.name)} retrieved successfully',
    content: {
      'application/json': {
        example: ${JSON.stringify(getExample, null, 2)}
      }
    }
  })
  @ApiResponse({
    status: 401,
    description: 'Unauthorized',
    content: {
      'application/json': {
        example: ${JSON.stringify(unauthorizedExample, null, 2)}
      }
    }
  })
  get${this.getPlural(entityName)}(@Query() query: Query${entityName}Dto) {
    return this.${this.getCamelCase(table.name)}UseCases.get${this.getPlural(entityName)}(query);
  }

  @Put(':id')
  @ApiOperation({ summary: 'Update ${table.name}' })
  @ApiResponse({
    status: 200,
    description: '${table.name} updated successfully',
    content: {
      'application/json': {
        example: ${JSON.stringify(postExample, null, 2)}
      }
    }
  })
  @ApiResponse({
    status: 400,
    description: 'Validation failed',
    content: {
      'application/json': {
        example: ${JSON.stringify(validationErrorExample, null, 2)}
      }
    }
  })
  @ApiResponse({
    status: 401,
    description: 'Unauthorized',
    content: {
      'application/json': {
        example: ${JSON.stringify(unauthorizedExample, null, 2)}
      }
    }
  })
  update${entityName}(
    @Param('id', ParseIntPipe) id: ${this.schema.char_primary_key ? 'string' : 'number'},
    @Body() ${this.getCamelCase(table.name)}: Update${entityName}Dto,
  ) {
    return this.${this.getCamelCase(table.name)}UseCases.update${entityName}(id, ${this.getCamelCase(table.name)});
  }

  @Delete(':id')
  @ApiOperation({ summary: 'Delete ${table.name}' })
  @ApiResponse({
    status: 200,
    description: '${table.name} deleted successfully',
    content: {
      'application/json': {
        example: { success: true }
      }
    }
  })
  @ApiResponse({
    status: 401,
    description: 'Unauthorized',
    content: {
      'application/json': {
        example: ${JSON.stringify(unauthorizedExample, null, 2)}
      }
    }
  })
  delete${entityName}(@Param('id', ParseIntPipe) id: ${this.schema.char_primary_key ? 'string' : 'number'}) {
    return this.${this.getCamelCase(table.name)}UseCases.delete${entityName}(id);
  }

  ${table.create_relation_get_route ? Object.entries(table.relations || {}).map(([key, rel]) => {
      if (rel.type === "OneToMany") {
        const relationName = this.getCamelCase(this.getPlural(key.replace("_id", "")));
        return `
  @Get(':id/${this.toSnakeCase(this.getCamelCase(this.getPlural(key)))}')
  @ApiOperation({ summary: 'Get ${this.getPlural(key)} of ${table.name}' })
  @ApiResponse({
    status: 200,
    description: '${this.getPlural(key)} retrieved successfully',
    content: {
      'application/json': {
        example: ${JSON.stringify(getExample, null, 2)}
      }
    }
  })
  @ApiResponse({
    status: 401,
    description: 'Unauthorized',
    content: {
      'application/json': {
        example: ${JSON.stringify(unauthorizedExample, null, 2)}
      }
    }
  })
  get${relationName}Of${entityName}(@Param('id', ParseIntPipe) id: ${this.schema.char_primary_key ? 'string' : 'number'}) {
    return this.${this.getCamelCase(table.name)}UseCases.get${relationName}Of${entityName}(id);
  }`;
      }
      return '';
    }).join('\n') : ''}
}`;

    return this.formatCode(template);
  }

  // Generate migration with enum support
  generateMigration(table) {
    const timestamp = Date.now();
    const tableName = this.toSnakeCase(this.getCamelCase(this.getPlural(table.name))).toLowerCase();
    const enums = this.getEnumsFromTable(table);
    const indexes = this.getIndexesFromTable(table);
    const checkConstraints = this.getCheckConstraintsFromTable(table);
    const uniqueConstraints = this.getUniqueConstraintsFromTable(table);

    // Check if any enum properties have default values or use DB enums
    const enumsWithDefaults = {};
    const dbEnums = {};
    Object.entries(table.properties).forEach(([key, prop]) => {
      if (prop.type === 'enum' && enums[key]) {
        if (prop.default) {
          enumsWithDefaults[key] = enums[key];
        }
        if (enums[key].useDbEnum) {
          dbEnums[key] = enums[key];
        }
      }
    });

    // Generate enum imports if needed
    const enumImports = Object.keys(enumsWithDefaults).length > 0
      ? `import { ${Object.values(enumsWithDefaults).map(e => e.name).join(', ')} } from 'src/infrastructure/enums/${table.name.toLowerCase()}-enums.enum';\n`
      : '';

    const template = `
import { MigrationInterface, QueryRunner, Table, TableForeignKey, TableColumn, TableIndex } from 'typeorm';
${enumImports}
export class create${this.getPlural(this.getPascalCase(table.name))}Table${timestamp} implements MigrationInterface {
  public async up(queryRunner: QueryRunner): Promise<void> {
    ${Object.keys(dbEnums).length > 0 ? `
    // Create database-level enums
    ${Object.entries(dbEnums).map(([key, enumData]) => `
    await queryRunner.query(\`
      CREATE TYPE ${enumData.dbEnumName} AS ENUM (${enumData.values.map(v => `'${v}'`).join(', ')})
    \`);`).join('\n')}
    ` : ''}

    await queryRunner.createTable(
      new Table({
        name: '${tableName}',
        columns: [
          {
            name: 'id',
            type: '${this.schema.char_primary_key ? 'uuid' : 'int4'}',
            isPrimary: true,
            ${this.schema.char_primary_key ?
        "default: 'uuid_generate_v4()'" :
        'isGenerated: true, generationStrategy: "increment"'
      },
          },
          ${Object.entries(table.properties).map(([key, prop]) => {
        let columnType = prop.type;
        let defaultValue = '';

        if (prop.type === 'enum' && enums[key]) {
          columnType = enums[key].useDbEnum ? enums[key].dbEnumName : 'varchar';
        }

        if (prop.default !== undefined) {
          if (prop.type === 'enum' && enums[key]) {
            const enumName = enums[key].name;
            const enumKey = prop.default.toUpperCase().replace(/[^A-Z0-9]/g, '_');
            defaultValue = `default: \`'\${${enumName}.${enumKey}}'\`,`;
          } else if (prop.type === 'jsonb' || prop.type === 'json') {
            // For jsonb/json, pass the raw SQL expression
            defaultValue = `default: \`${prop.default}\`,`;
          } else if (prop.type === 'varchar' || prop.type === 'text') {
            defaultValue = `default: "'${prop.default}'",`;
          } else if (prop.type === 'boolean') {
            defaultValue = `default: ${prop.default},`;
          } else if (typeof prop.default === 'number') {
            defaultValue = `default: ${prop.default},`;
          }
        }

        return `{
              name: '${key}',
              type: '${columnType}',
              ${prop.required === false ? 'isNullable: true,' : ''}
              ${defaultValue}
            },`;
      }).join('\n          ')}
          ${Object.entries(table.relations || {}).map(([key, rel]) => {
        if (rel.type === 'ManyToOne' || (rel.type === 'OneToOne' && rel.isOwner === false)) {
          return `{
                name: '${key}',
                type: '${this.schema.char_primary_key ? 'uuid' : 'int4'}',
                ${rel.required === false ? 'isNullable: true,' : ''}
              },`;
        }
        return '';
      }).filter(Boolean).join('\n          ')}
          {
            name: 'created_on',
            type: 'timestamp',
            default: 'now()',
          },
          {
            name: 'updated_on',
            type: 'timestamp',
            default: 'now()',
          },
        ],
      }),
      true,
    );

    ${Object.entries(table.relations || {}).map(([key, rel]) => {
        if (rel.type === 'ManyToOne' || (rel.type === 'OneToOne' && rel.isOwner === false)) {
          const onDelete = rel.onDelete || 'CASCADE';
          const onUpdate = rel.onUpdate || 'CASCADE';
          return `
    await queryRunner.createForeignKey(
      '${tableName}',
      new TableForeignKey({
        columnNames: ['${key}'],
        referencedTableName: '${this.toSnakeCase(this.getCamelCase(this.getPlural(rel.entity)))}',
        referencedColumnNames: ['id'],
        onDelete: '${onDelete}',
        onUpdate: '${onUpdate}',
      }),
    );`;
        }
        return '';
      }).filter(Boolean).join('\n')}

    ${uniqueConstraints.length > 0 ? `
    // Create unique constraints
    ${uniqueConstraints.map(constraint => `
    await queryRunner.query(\`
      ALTER TABLE ${tableName}
      ADD CONSTRAINT ${constraint.name}
      UNIQUE (${constraint.columns.join(', ')})
    \`);`).join('\n')}
    ` : ''}

    ${checkConstraints.length > 0 ? `
    // Create check constraints
    ${checkConstraints.map(constraint => `
    await queryRunner.query(\`
      ALTER TABLE ${tableName}
      ADD CONSTRAINT ${constraint.name}
      CHECK (${constraint.expression})
    \`);`).join('\n')}
    ` : ''}

    ${indexes.length > 0 ? `
    // Create indexes
    ${indexes.map(index => `
    await queryRunner.createIndex(
      '${tableName}',
      new TableIndex({
        name: '${index.name}',
        columnNames: [${index.columns.map(col => `'${col}'`).join(', ')}],
        ${index.unique ? 'isUnique: true,' : ''}
      }),
    );`).join('\n')}
    ` : ''}
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    ${indexes.length > 0 ? `
    // Drop indexes
    ${indexes.map(index => `
    await queryRunner.dropIndex('${tableName}', '${index.name}');`).join('\n')}
    ` : ''}

    ${checkConstraints.length > 0 ? `
    // Drop check constraints
    ${checkConstraints.map(constraint => `
    await queryRunner.query(\`ALTER TABLE ${tableName} DROP CONSTRAINT ${constraint.name}\`);`).join('\n')}
    ` : ''}

    ${uniqueConstraints.length > 0 ? `
    // Drop unique constraints
    ${uniqueConstraints.map(constraint => `
    await queryRunner.query(\`ALTER TABLE ${tableName} DROP CONSTRAINT ${constraint.name}\`);`).join('\n')}
    ` : ''}

    await queryRunner.dropTable('${tableName}');

    ${Object.keys(dbEnums).length > 0 ? `
    // Drop database-level enums
    ${Object.entries(dbEnums).map(([key, enumData]) => `
    await queryRunner.query(\`DROP TYPE ${enumData.dbEnumName}\`);`).join('\n')}
    ` : ''}
  }
}`;

    return this.formatCode(template);
  }

  // Enhanced module update with proper imports
  async updateModuleFile(filePath, entityName, type) {
    this.log.process(`Updating ${type} module: ${path.basename(filePath)}`);

    if (!fs.existsSync(filePath)) {
      this.log.warning(`Module file not found: ${filePath}`);
      return;
    }

    const sourceFile = this.project.addSourceFileAtPath(filePath);
    // Get relative paths for imports based on module type
    let importPath, className, additionalImports = [];

    switch (type) {
      case 'entity':
        importPath = `./${(entityName).toLowerCase()}.entity`;
        className = this.getEntityClassName(entityName);

        // Add TypeORM import if not present
        const typeOrmImport = sourceFile.getImportDeclaration(d =>
          d.getModuleSpecifierValue() === '@nestjs/typeorm'
        );
        if (!typeOrmImport) {
          sourceFile.addImportDeclaration({
            moduleSpecifier: '@nestjs/typeorm',
            namedImports: ['TypeOrmModule']
          });
        }

        // Now adding to export defaults array
        // Handle export default array for entity modules
        const exportDefault = sourceFile.getExportAssignment(ea => ea.isExportEquals() === false);
        if (exportDefault) {
          const exportExpression = exportDefault.getExpression();
          if (exportExpression && exportExpression.getKind() === 208) { // ArrayLiteralExpression
            const elements = exportExpression.getElements();
            const existingClasses = elements.map(e => e.getText().trim());

            console.log('existingClasses', existingClasses)
            if (!existingClasses.includes(className)) {
              exportExpression.addElement(className);
              this.log.success(`Added ${className} to export default array`);
            }
          }
        } else {
          // Create export default if it doesn't exist
          sourceFile.addExportAssignment({
            isExportEquals: false,
            expression: `[${className}]`
          });
          this.log.success(`Created export default array with ${className}`);
        }
        break;

      case 'repository':
        const repoEntityName = this.getEntityClassName(entityName);
        importPath = `./${(entityName).toLowerCase()}.repository`;
        className = `${entityName}Repository`;


        // Add TypeORM import if not present
        const repoTypeOrmImport = sourceFile.getImportDeclaration(d =>
          d.getModuleSpecifierValue() === '@nestjs/typeorm'
        );
        if (!repoTypeOrmImport) {
          sourceFile.addImportDeclaration({
            moduleSpecifier: '@nestjs/typeorm',
            namedImports: ['TypeOrmModule']
          });
        }
        break;

      case 'usecase':
        importPath = `./${(entityName).toLowerCase()}/${(entityName).toLowerCase()}.usecases`;
        className = `${entityName}UseCases`;
        break;


      case 'controller':
        importPath = `./${(entityName).toLowerCase()}/${(entityName).toLowerCase()}.controller`;
        className = `${entityName}Controller`;


        break;
    }

    // Add main import
    const existingImport = sourceFile.getImportDeclaration(d =>
      d.getModuleSpecifierValue() === importPath
    );
    if (!existingImport) {
      sourceFile.addImportDeclaration({
        moduleSpecifier: importPath,
        namedImports: [className]
      });
      this.log.success(`Added import: ${className}`);
    }

    // Add additional imports
    additionalImports.forEach(({ path, className }) => {
      const existing = sourceFile.getImportDeclaration(d =>
        d.getModuleSpecifierValue() === path
      );
      if (!existing) {
        sourceFile.addImportDeclaration({
          moduleSpecifier: path,
          namedImports: [className]
        });
        this.log.success(`Added import: ${className}`);
      }
    });

    // Update module decorator
    const moduleClass = sourceFile.getClasses()[0];
    if (moduleClass) {
      const decorator = moduleClass.getDecorator('Module');
      if (decorator) {
        const decoratorArg = decorator.getArguments()[0];
        if (decoratorArg) {
          const text = decoratorArg.getText();

          switch (type) {
            case 'entity':
              // Add to TypeOrmModule.forFeature imports
              if (!text.includes(`TypeOrmModule.forFeature`)) {
                // Need to add TypeOrmModule.forFeature to imports
                const updatedText = text.replace(
                  /imports:\s*\[/,
                  `imports: [TypeOrmModule.forFeature([${className}]),`
                );
                decoratorArg.replaceWithText(updatedText);
              } else {
                // Add to existing forFeature array
                const updatedText = text.replace(
                  /TypeOrmModule\.forFeature\(\[([^\]]*)\]/,
                  (match, entities) => {
                    if (!entities.includes(className)) {
                      const entitiesList = entities.trim() ?
                        `${entities.trim()}, ${className}` : className;
                      return `TypeOrmModule.forFeature([${entitiesList}]`;
                    }
                    return match;
                  }
                );
                decoratorArg.replaceWithText(updatedText);
              }
              break;

            case 'repository':
              // Add to providers and exports
              this.addToModuleArray(decoratorArg, 'providers', [className]);
              this.addToModuleArray(decoratorArg, 'exports', [className]);
              break;

            case 'usecase':
              // Add usecase to providers and exports (repository comes from RepositoryModule)
              this.addToModuleArray(decoratorArg, 'providers', [className]);
              this.addToModuleArray(decoratorArg, 'exports', [className]);
              break;

            case 'controller':
              // Add controller to controllers array, usecase to providers
              this.addToModuleArray(decoratorArg, 'controllers', [className]);
              break;
          }
        }
      }
    }

    await sourceFile.save();
    this.log.success(`Updated ${type} module`);
  }

  // Helper to add items to module arrays
  addToModuleArray(decoratorArg, arrayName, items) {
    items.forEach((item, index) => {
      // CRITICAL: Get fresh text on each iteration after replaceWithText updates it
      const text = decoratorArg.getText();

      // Check if item already exists ONLY in the specific array (not anywhere in the decorator)
      const arrayContentPattern = new RegExp(`${arrayName}:\\s*\\[([\\s\\S]*?)\\]`, 'g');
      const arrayMatch = arrayContentPattern.exec(text);
      let itemExists = false;

      if (arrayMatch) {
        const arrayContent = arrayMatch[1];
        const itemPattern = new RegExp(`\\b${item.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}\\b`);
        itemExists = itemPattern.test(arrayContent);
      }

      if (itemExists) {
        return; // Skip if already exists
      }

      let updatedText;

      // Check if the array property exists
      const arrayPattern = new RegExp(`${arrayName}:\\s*\\[`, 's');

      if (!arrayPattern.test(text)) {
        updatedText = text.replace(/\{/, `{\n  ${arrayName}: [${item}],`);
      } else {
        // Find the array content by matching balanced brackets
        const arrayStartPattern = new RegExp(`${arrayName}:\\s*\\[`);
        const arrayStartMatch = arrayStartPattern.exec(text);

        if (!arrayStartMatch) {
          return;
        }

        const startIndex = arrayStartMatch.index + arrayStartMatch[0].length;
        let bracketCount = 1;
        let endIndex = startIndex;

        // Find the matching closing bracket by counting nested brackets
        for (let i = startIndex; i < text.length && bracketCount > 0; i++) {
          if (text[i] === '[') bracketCount++;
          else if (text[i] === ']') bracketCount--;
          endIndex = i;
        }

        const opening = text.substring(arrayStartMatch.index, startIndex);
        const existing = text.substring(startIndex, endIndex);
        const closing = ']';

        // Clean up existing content and check if it's empty
        const trimmedExisting = existing.trim();

        if (!trimmedExisting) {
          updatedText = text.substring(0, arrayStartMatch.index) +
            `${opening}${item}${closing}` +
            text.substring(endIndex + 1);
        } else {
          // Add comma if the last item doesn't have one
          const needsComma = !trimmedExisting.endsWith(',');
          const separator = needsComma ? ',' : '';

          // Preserve indentation by checking the existing format
          const lines = existing.split('\n');
          // Find the last non-empty line to get proper indentation
          let indent = '    '; // default 4 spaces
          for (let i = lines.length - 2; i >= 0; i--) {
            const line = lines[i].trim();
            if (line && line !== '') {
              indent = lines[i].match(/^\s*/)?.[0] || '    ';
              break;
            }
          }

          // Remove trailing whitespace from existing and add item with proper formatting
          const cleanExisting = existing.replace(/\s+$/, '');
          const replacement = `${opening}${cleanExisting}${separator}\n${indent}${item},\n  ${closing}`;

          updatedText = text.substring(0, arrayStartMatch.index) +
            replacement +
            text.substring(endIndex + 1);
        }
      }

      decoratorArg.replaceWithText(updatedText);
    });
  }  // Helper for relation generation
  generateRelation(relationName, relation, entityName) {
    const { type, entity: relatedEntity, required, isOwner } = relation;
    const relatedClassName = this.getEntityClassName(relatedEntity || relationName);
    const relation_field_name = this.getCamelCase(relatedEntity || relationName);

    switch (type) {
      case 'OneToMany':
        return `
  @OneToMany(() => ${relatedClassName}, (${relation_field_name}) => ${relation_field_name}.${this.toSnakeCase(this.toSingle(entityName))}_id)
  ${this.toSnakeCase(this.getPlural(relationName))}: ${relatedClassName}[];`;

      case 'ManyToOne':
        return `
  @ManyToOne(() => ${relatedClassName}, (${relation_field_name}) => ${relation_field_name}.${this.toSnakeCase(this.getPlural(entityName))})
  @JoinColumn({ name: '${relationName}' })
  ${relationName}${required === false ? "?" : ""}: number;
  
   @ManyToOne(() => ${relatedClassName}, (${relation_field_name}) => ${relation_field_name}.${this.toSnakeCase(this.getPlural(entityName))})
  @JoinColumn({ name: '${relationName}' })
  ${relationName.replace("_id", "_data")}${required === false ? "?" : ""}: ${relatedClassName};
  `;

      case 'OneToOne':
        if (isOwner === false) {
          return `
  @OneToOne(() => ${relatedClassName}, (${relation_field_name}) => ${relation_field_name}.${this.toSnakeCase(entityName)}_id )
  @JoinColumn({ name: '${relationName}' })
  ${this.toSnakeCase(relationName)}${required === false ? "?" : ""}: number;
  
  @OneToOne(() => ${relatedClassName}, (${relation_field_name}) => ${relation_field_name}.${this.toSnakeCase(entityName)}_id )
  @JoinColumn({ name: '${relationName}' })
  ${this.toSnakeCase(relationName).replace('_id', '_data')}${required === false ? "?" : ""}: ${relatedClassName};`;
        } else {
          return `
  @OneToOne(() => ${relatedClassName}, (${relation_field_name}) => ${relation_field_name}.${this.toSnakeCase(entityName)}_id )
  ${this.toSnakeCase(relationName)}${required === false ? "?" : ""}: number ;
  
  @OneToOne(() => ${relatedClassName}, (${relation_field_name}) => ${relation_field_name}.${this.toSnakeCase(entityName)}_id )
  ${this.toSnakeCase(relationName).replace("_id", "_data")}${required === false ? "?" : ""}: ${relatedClassName};`;
        }

      case 'ManyToMany':
        const jointTableName = isOwner ?
          `${this.getPascalCase(this.toSnakeCase(entityName))}${this.getPascalCase(this.toSnakeCase(relationName))}` :
          `${this.toSingle(this.getPascalCase(this.toSnakeCase(relationName)))}${this.getPlural(this.getPascalCase(this.toSnakeCase(entityName)))}`;
        const propertyname = this.toSnakeCase(jointTableName);

        return `
  @ManyToMany(() => ${relatedClassName}, (${relation_field_name}) => ${relation_field_name}.${propertyname})
  ${isOwner ? `@JoinTable({
    name: '${jointTableName}',
    joinColumn: {
      name: '${this.toSnakeCase(this.toSingle(entityName))}_id',
      referencedColumnName: 'id',
    },
    inverseJoinColumn: {
      name: '${this.toSnakeCase(this.toSingle(relationName))}_id',
      referencedColumnName: 'id',
    },
  })` : ''}
  ${propertyname}: ${relatedClassName}[];`;

      default:
        return '';
    }
  }

  // Helper to get TypeScript type
  getTypeScriptType(dbType) {
    const typeMapping = {
      'varchar': 'string',
      'text': 'string',
      'int': 'number',
      'int4': 'number',
      'integer': 'number',
      'decimal': 'number',
      'boolean': 'boolean',
      'timestamp': 'Date',
      'timestamptz': 'Date',
      'double precision': 'number',
      'json': 'Record<string, any>',
      'jsonb': 'Record<string, any>',
      'enum': 'string' // This will be overridden with actual enum type
    };
    return typeMapping[dbType] || 'any';
  }

  // Helper to get validator decorator
  getPropTypeValidator(propType) {
    const typeMapping = {
      'varchar': '@IsString()',
      'text': '@IsString()',
      'int': '@IsNumber()',
      'int4': '@IsNumber()',
      'integer': '@IsNumber()',
      'decimal': '@IsNumber()',
      'boolean': '@IsBoolean()',
      'timestamp': '@IsDate()',
      'timestamptz': '@IsDate()',
      'double precision': '@IsNumber()',
      'json': '',
      'jsonb': '',
      'enum': '@IsEnum()'
    };
    return typeMapping[propType] || '';
  }

  // Create pagination interface
  async createPaginationInterface() {
    const interfacePath = path.join(this.schema.url, 'domain/common/interfaces');
    const filePath = path.join(interfacePath, 'paginated-response.interface.ts');

    if (!fs.existsSync(interfacePath)) {
      fs.mkdirSync(interfacePath, { recursive: true });
    }

    const content = `
export interface PaginationMeta {
  total: number;
  page: number;
  limit: number;
}

export interface PaginatedResponse<T> {
  data: T[];
  meta: PaginationMeta;
}`;

    const formattedContent = await this.formatCode(content);
    fs.writeFileSync(filePath, formattedContent);
    this.log.file(`Created: paginated-response.interface.ts`);
  }

  // Create directories
  createDirectoriesIfNeeded(tableName) {
    const directories = [
      path.join(this.schema.url, 'infrastructure/entities'),
      path.join(this.schema.url, 'infrastructure/repository'),
      path.join(this.schema.url, 'infrastructure/controllers', tableName.toLowerCase()),
      path.join(this.schema.url, 'infrastructure/enums'),
      path.join(this.schema.url, 'domain/models'),
      path.join(this.schema.url, 'domain/repositories'),
      path.join(this.schema.url, 'usecases', tableName.toLowerCase()),
      path.join(this.schema.url, '../database/migrations'),
    ];

    directories.forEach(dir => {
      if (!fs.existsSync(dir)) {
        fs.mkdirSync(dir, { recursive: true });
      }
    });
  }

  // Format code using prettier
  async formatCode(code) {
    try {
      return prettier.format(code, {
        parser: 'typescript',
        singleQuote: true,
        trailingComma: 'all',
        printWidth: 80,
        tabWidth: 2,
      });
    } catch (error) {
      this.log.error('Error formatting code: ' + error.message);
      return code;
    }
  }

  // Validate schema before generation
  validateSchema() {
    const errors = [];
    const tableMap = new Map(this.schema.tables.map(t => [t.name.toLowerCase(), t]));

    this.schema.tables.forEach(table => {
      // Check if table has relations
      if (!table.relations) return;

      Object.entries(table.relations).forEach(([relationName, relation]) => {
        const relatedEntityName = (relation.entity || relationName).toLowerCase();

        // Validation 1: OneToOne MUST have isOwner field
        if (relation.type === 'OneToOne') {
          if (relation.isOwner === undefined || relation.isOwner === null) {
            errors.push(
              `❌ Table "${table.name}" -> Relation "${relationName}": OneToOne relation MUST have "isOwner" field (true or false)`
            );
          }
        }

        // Validation 2: ManyToOne must have corresponding OneToMany
        if (relation.type === 'ManyToOne') {
          const relatedTable = tableMap.get(relatedEntityName);

          if (relatedTable) {
            // Check if related table has OneToMany back to this table
            const hasCorrespondingOneToMany = relatedTable.relations &&
              Object.values(relatedTable.relations).some(rel => {
                const targetEntity = (rel.entity || '').toLowerCase();
                return rel.type === 'OneToMany' &&
                  (targetEntity === table.name.toLowerCase() || targetEntity === '');
              });

            if (!hasCorrespondingOneToMany) {
              errors.push(
                `❌ Table "${table.name}" -> Relation "${relationName}": Has ManyToOne to "${relation.entity}", ` +
                `but table "${relation.entity}" does NOT have corresponding OneToMany relation back to "${table.name}"`
              );
            }
          }
        }

        // Validation 3: OneToMany must have corresponding ManyToOne
        if (relation.type === 'OneToMany') {
          const relatedTable = tableMap.get(relatedEntityName);

          if (relatedTable) {
            // Check if related table has ManyToOne back to this table
            const hasCorrespondingManyToOne = relatedTable.relations &&
              Object.values(relatedTable.relations).some(rel => {
                const targetEntity = (rel.entity || '').toLowerCase();
                return rel.type === 'ManyToOne' &&
                  (targetEntity === table.name.toLowerCase() || targetEntity === '');
              });

            if (!hasCorrespondingManyToOne) {
              errors.push(
                `❌ Table "${table.name}" -> Relation "${relationName}": Has OneToMany to "${relation.entity}", ` +
                `but table "${relation.entity}" does NOT have corresponding ManyToOne relation back to "${table.name}"`
              );
            }
          }
        }
      });
    });

    if (errors.length > 0) {
      console.log(chalk.bold.red('\n⚠️  SCHEMA VALIDATION ERRORS:\n'));
      errors.forEach(error => console.log(chalk.red(error)));
      console.log(chalk.bold.red('\n❌ Please fix the schema validation errors before proceeding.\n'));
      throw new Error('Schema validation failed');
    }

    this.log.success('Schema validation passed ✓');
  }

  // Main generate method
  async generate() {
    try {
      console.log(chalk.bold.cyan('\n🚀 NestJS Clean Architecture Generator\n'));
      console.log(chalk.gray('═'.repeat(50)));

      this.log.info(`Schema loaded with ${this.schema.tables.length} tables`);
      this.log.info(`Root directory: ${chalk.yellow(this.schema.root || this.schema.url)}`);
      console.log(chalk.gray('═'.repeat(50)) + '\n');

      // Validate schema before proceeding
      this.log.process('Validating schema...');
      this.validateSchema();
      console.log('');

      // Create pagination interface first
      this.log.process('Creating pagination interface...');
      await this.createPaginationInterface();

      // Process each table
      for (const table of this.schema.tables) {
        console.log(chalk.bold.magenta(`\n📦 Generating resources for: ${table.name}`));
        console.log(chalk.gray('─'.repeat(40)));

        // Create necessary directories
        this.createDirectoriesIfNeeded(table.name);

        // Generate enum file if table has enums
        const enumFile = await this.generateEnumFile(table);
        if (enumFile) {
          const enumPath = path.join(this.schema.url, 'infrastructure/enums', enumFile.fileName);
          fs.writeFileSync(enumPath, enumFile.content);
          this.log.file(`Created: ${enumFile.fileName}`);
        }

        // Generate all files
        const files = {
          entity: {
            content: await this.generateEntity(table),
            path: path.join(this.schema.url, 'infrastructure/entities', this.getEntityFileName(table.name))
          },
          dto: {
            content: await this.generateDto(table),
            path: path.join(this.schema.url, 'infrastructure/controllers', table.name.toLowerCase(), `${table.name.toLowerCase()}.dto.ts`)
          },
          model: {
            content: await this.generateModel(table),
            path: path.join(this.schema.url, 'domain/models', `${table.name.toLowerCase()}.model.ts`)
          },
          repositoryInterface: {
            content: await this.generateRepositoryInterface(table),
            path: path.join(this.schema.url, 'domain/repositories', `${table.name.toLowerCase()}.repository.interface.ts`)
          },
          repository: {
            content: await this.generateRepository(table),
            path: path.join(this.schema.url, 'infrastructure/repository', `${table.name.toLowerCase()}.repository.ts`)
          },
          usecase: {
            content: await this.generateUseCase(table),
            path: path.join(this.schema.url, 'usecases', table.name.toLowerCase(), `${table.name.toLowerCase()}.usecases.ts`)
          },
          controller: {
            content: await this.generateController(table),
            path: path.join(this.schema.url, 'infrastructure/controllers', table.name.toLowerCase(), `${table.name.toLowerCase()}.controller.ts`)
          },
          migration: {
            content: await this.generateMigration(table),
            path: path.join(this.schema.url, '../database/migrations', `${Date.now()}-create-${this.getPlural(table.name).toLowerCase()}-table.ts`)
          }
        };

        // Write files
        for (const [type, { content, path: filePath }] of Object.entries(files)) {
          fs.writeFileSync(filePath, content);
          this.log.file(`Created: ${path.basename(filePath)}`);
        }

        // Update module files if configured
        if (this.schema.insert_to_modules) {
          console.log(chalk.gray('\n' + '─'.repeat(40)));
          this.log.process('Updating module files...');

          if (this.schema.entity_module_file) {
            await this.updateModuleFile(this.schema.entity_module_file, table.name, 'entity');
          }
          if (this.schema.repository_module_file) {
            await this.updateModuleFile(this.schema.repository_module_file, table.name, 'repository');
          }
          if (this.schema.usecase_module_file) {
            await this.updateModuleFile(this.schema.usecase_module_file, table.name, 'usecase');
          }
          if (this.schema.controller_module_file) {
            await this.updateModuleFile(this.schema.controller_module_file, table.name, 'controller');
          }
        }

        console.log(chalk.green(`\n✅ Successfully generated all files for ${table.name}!\n`));
      }

      console.log(chalk.gray('═'.repeat(50)));
      console.log(chalk.bold.green('\n🎉 Generation completed successfully!'));
      console.log(chalk.cyan(`   Generated resources for ${this.schema.tables.length} table(s)\n`));

    } catch (error) {
      this.log.error('Error during generation: ' + error.message);
      console.error(error.stack);
      throw error;
    }
  }
}

module.exports = NestjsResourceGenerator;