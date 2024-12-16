const fs = require('fs');
const path = require('path');
const pluralize = require('pluralize');
const prettier = require('prettier');
const { Project } = require('ts-morph');
const ts = require('typescript');

class NestjsResourceGenerator {
  constructor(schemaPath) {
    this.schema = JSON.parse(fs.readFileSync(schemaPath, 'utf8'));
    this.project = new Project();
  }

  // Utility functions for naming conventions
  getPascalCase(str) {
    return str.charAt(0).toUpperCase() + str.slice(1);
  }

  getCamelCase(str) {
    return str.charAt(0).toLowerCase() + str.slice(1);
  }

  getPlural(str) {
    return pluralize(str);
  }

  getEntityFileName(name) {
    // Always singular: product.entity.ts
    return `${this.getCamelCase(name)}.entity.ts`;
  }

  getEntityClassName(name) {
    // Always plural for entity class: Products
    return this.getPascalCase(this.getPlural(name));
  }

  getRelationPropertyName(name, type) {
    // For OneToMany: products
    // For ManyToOne: seller
    return type.includes('Many') ?
      this.getCamelCase(this.getPlural(name)) :
      this.getCamelCase(name);
  }

  getInversePropertyName(relationName, entityName, type) {
    // Return the property name on the inverse side of the relation
    switch (type) {
      case 'OneToMany':
        return this.getCamelCase(entityName); // products -> seller
      case 'ManyToOne':
        return this.getCamelCase(this.getPlural(relationName)); // seller -> products
      case 'OneToOne':
        return this.getCamelCase(entityName);
      case 'ManyToMany':
        return this.getCamelCase(this.getPlural(entityName));
      default:
        return '';
    }
  }

  // Updated generate relation function
  generateRelation(relationName, relation, entityName) {
    const relatedClassName = this.getEntityClassName(relation.entity || relationName);
    const propertyName = this.getRelationPropertyName(relationName, relation.type);

    switch (relation.type) {
      case 'OneToMany':
        return `
          @OneToMany(() => ${relatedClassName}, (${this.getCamelCase(relationName)}) => ${this.getCamelCase(relationName)}.${this.getCamelCase(entityName)}_id, {
            onDelete: 'NO ACTION',
            onUpdate: 'NO ACTION',
          })
          ${propertyName}?: ${relatedClassName}[];
        `;

      case 'ManyToOne':
        return `
          @ManyToOne(() => ${relatedClassName}, (${this.getCamelCase(relationName)}) => ${this.getCamelCase(relationName)}.products, {
            onDelete: 'NO ACTION',
            onUpdate: 'NO ACTION',
          })
          @JoinColumn({ name: '${this.getCamelCase(relationName)}_id' })
          ${this.getCamelCase(relationName)}_id${relation.required ? "" : "?"}: number;
          
          @ManyToOne(() => ${relatedClassName}, (${this.getCamelCase(relationName)}) => ${this.getCamelCase(relationName)}.products, {
            onDelete: 'NO ACTION',
            onUpdate: 'NO ACTION',
          })
          @JoinColumn({ name: '${this.getCamelCase(relationName)}_id' })
          ${this.getCamelCase(relationName)}Data${relation.required ? "" : "?"}: ${relatedClassName};
        `;

      case 'OneToOne':
        return `
          @OneToOne(() => ${relatedClassName}, (${this.getCamelCase(relationName)}) => ${this.getCamelCase(relationName)}.${inverseProp}, {
            onDelete: 'NO ACTION',
            onUpdate: 'NO ACTION',
          })
          @JoinColumn({ name: '${this.getCamelCase(relationName)}_id' })
          ${propertyName}_id?: number;
          
          @OneToOne(() => ${relatedClassName}, (${this.getCamelCase(relationName)}) => ${this.getCamelCase(relationName)}.${inverseProp}, {
            onDelete: 'NO ACTION',
            onUpdate: 'NO ACTION',
          })
          @JoinColumn({ name: '${this.getCamelCase(relationName)}_id' })
          ${propertyName}Data?: ${relatedClassName};
        `;

      case 'ManyToMany':
        return `
          @ManyToMany(() => ${relatedClassName}, (${this.getCamelCase(relationName)}) => ${this.getCamelCase(relationName)}.${inverseProp}, {
            onDelete: 'NO ACTION',
            onUpdate: 'NO ACTION',
          })
          @JoinTable({
            name: '${this.getCamelCase(entityName)}_${this.getCamelCase(this.getPlural(relationName))}',
            joinColumn: {
              name: '${this.getCamelCase(entityName)}_id',
              referencedColumnName: 'id',
            },
            inverseJoinColumn: {
              name: '${this.getCamelCase(relationName)}_id',
              referencedColumnName: 'id',
            },
          })
          ${propertyName}?: ${relatedClassName}[];
        `;

      default:
        return '';
    }
  }

  // Updated generate entity function
  generateEntity(table) {
    const entityClassName = this.getEntityClassName(table.name);

    const template = `
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
        JoinColumn
      } from 'typeorm';

      ${Object.entries(table.relations).map(([key, rel]) => `
        import { ${this.getEntityClassName(rel.entity || key)} } from './${this.getEntityFileName(rel.entity || key).replace('.ts', '')}';
      `).join('\n')}

      @Entity('${this.getCamelCase(this.getPlural(table.name))}')
      export class ${entityClassName} {
        @PrimaryGeneratedColumn({ type: '${this.schema.char_primary_key ? 'uuid' : 'int4'}' })
        id: ${this.schema.char_primary_key ? 'string' : 'number'};

        ${Object.entries(table.properties).map(([key, prop]) => `
          @Column({ type: '${prop.type}'${prop.nullable ? ', nullable: true' : ''} })
          ${key}: ${this.getTypeScriptType(prop.type)};
        `).join('\n')}

        ${Object.entries(table.relations).map(([key, rel]) =>
      this.generateRelation(key, rel, table.name)
    ).join('\n')}

        @CreateDateColumn({ type: 'timestamp' })
        created_on: Date;

        @UpdateDateColumn({ type: 'timestamp' })
        updated_on: Date;
      }
    `;

    return this.formatCode(template);
  }

  // Generate DTO files
  generateDto(table) {
    const entityName = this.getPascalCase(table.name);
    const template = `
      import { IsString, IsNotEmpty, IsOptional } from 'class-validator';
      import { ApiProperty } from '@nestjs/swagger';

      export class Create${entityName}Dto {
        ${Object.entries(table.properties).map(([key, prop]) => `
          ${prop.nullable ? '@IsOptional()' : '@IsNotEmpty()'}
          @ApiProperty({ required: ${!prop.nullable} })
          ${key}: ${this.getTypeScriptType(prop.type)};
        `).join('\n')}
        ${Object.entries(table.relations).map(([key, prop]) => prop.type === 'ManyToOne' ? `
          ${prop.required ? '@IsOptional()' : '@IsNotEmpty()'}
          @ApiProperty({ required: ${!prop.required} })
          ${key}_id${prop.required ? "" : "?"}: number;
        `: "").join('\n')}
      }

      export class Update${entityName}Dto {
        ${Object.entries(table.properties).map(([key, prop]) => `
          @IsOptional()
          @ApiProperty({ required: false })
          ${key}?: ${this.getTypeScriptType(prop.type)};
        `).join('\n')}
         ${Object.entries(table.relations).map(([key, prop]) => prop.type === 'ManyToOne' ? `
          ${'@IsOptional()'}
          @ApiProperty({ required: false })
          ${key}_id?: number;
        `: "").join('\n')}
      }

      export class Query${entityName}Dto {
        @IsOptional()
        @ApiProperty({ required: false })
        page?: number;

        @IsOptional()
        @ApiProperty({ required: false })
        limit?: number;

        @IsOptional()
        @ApiProperty({ required: false })
        sort?: string;
      }
    `;

    return this.formatCode(template);
  }

  // Generate repository interface
  generateRepositoryInterface(table) {
    const entityName = this.getPascalCase(table.name);
    const template = `
      import { ${entityName}Model, Fetch${entityName}Model, Update${entityName}Model } from 'src/domain/models/${this.getCamelCase(table.name)}.model';
      import { PaginatedResponse } from 'src/domain/common/interfaces/paginated-response.interface';
      import { Query${entityName}Dto } from 'src/infrastructure/controllers/${this.getCamelCase(table.name)}/${this.getCamelCase(table.name)}.dto';

      export interface I${entityName} {
        create${entityName}(${this.getCamelCase(table.name)}Model: ${entityName}Model): Promise<Fetch${entityName}Model>;
        get${entityName}ById(id: ${this.schema.char_primary_key ? 'string' : 'number'}): Promise<Fetch${entityName}Model>;
        get${this.getPlural(entityName)}(query: Query${entityName}Dto): Promise<PaginatedResponse<Fetch${entityName}Model>>;
        update${entityName}(id: ${this.schema.char_primary_key ? 'string' : 'number'}, update${entityName}Model: Update${entityName}Model): Promise<Fetch${entityName}Model>;
        delete${entityName}(id: ${this.schema.char_primary_key ? 'string' : 'number'}): Promise<void>;
        ${Object.entries(table.relations).map(([key, rel]) => rel.type === 'OneToMany' ? `
          get${this.getPlural(key)}Of${entityName}(id: ${this.schema.char_primary_key ? 'string' : 'number'}): Promise<any[]>;
        ` : '').join('\n')}
      }
    `;

    return this.formatCode(template);
  }

  // Generate repository implementation
  generateRepository(table) {
    const entityName = this.getPascalCase(table.name);
    const pluralEntityName = this.getPlural(entityName);
    const template = `
      import { Injectable, NotFoundException } from '@nestjs/common';
      import { InjectRepository } from '@nestjs/typeorm';
      import { Repository } from 'typeorm';
      import { ${entityName}Model, Fetch${entityName}Model, Update${entityName}Model } from 'src/domain/models/${this.getCamelCase(table.name)}.model';
      import { I${entityName} } from 'src/domain/repositories/${this.getCamelCase(table.name)}.repository.interface';
      import { ${(pluralEntityName)} } from 'src/infrastructure/entities/${this.getCamelCase(entityName)}.entity';
      import { PaginatedResponse } from 'src/domain/common/interfaces/paginated-response.interface';
      import { Query${entityName}Dto } from 'src/infrastructure/controllers/${this.getCamelCase(table.name)}/${this.getCamelCase(table.name)}.dto';

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
          return await this.${this.getCamelCase(table.name)}Repository.findOne({ where: { id } });
        }

        async get${this.getPlural(entityName)}(query: Query${entityName}Dto): Promise<PaginatedResponse<Fetch${entityName}Model>> {
          const { page = 1, limit = 10, sort = '-id' } = query;
          const skip = (page - 1) * limit;
          
          const [data, total] = await this.${this.getCamelCase(table.name)}Repository.findAndCount({
            skip,
            take: limit,
            order: this.buildSortObject(sort),
          });

          return {
            meta: {
              total,
              page: Number(page),
              limit: Number(limit),
            },
            data
          };
        }

        async update${entityName}(
          id: ${this.schema.char_primary_key ? 'string' : 'number'},
          update${entityName}Model: Update${entityName}Model,
        ): Promise<Fetch${entityName}Model> {
          const ${this.getCamelCase(table.name)} = await this.${this.getCamelCase(table.name)}Repository.findOne({ where: { id } });
          if (${this.getCamelCase(table.name)}) {
            const updated${entityName}Body = { ...${this.getCamelCase(table.name)}, ...update${entityName}Model };
            return await this.${this.getCamelCase(table.name)}Repository.save(updated${entityName}Body);
          }
          return;
        }

        async delete${entityName}(id: ${this.schema.char_primary_key ? 'string' : 'number'}): Promise<void> {
          const result = await this.${this.getCamelCase(table.name)}Repository.delete(id);
          if (result.affected === 0) {
            throw new NotFoundException('${entityName} Not Found');
          }
          return;
        }

        ${Object.entries(table.relations).map(([key, rel]) => {
      if (rel.type === 'ManyToOne') {
        return ``
      }
      return `
          async get${this.getPlural(key)}Of${entityName}(id: ${this.schema.char_primary_key ? 'string' : 'number'}): Promise<any[]> {
            const ${this.getCamelCase(table.name)} = await this.${this.getCamelCase(table.name)}Repository.findOne({
              where: { id },
              relations: ['${this.getCamelCase(key)}'],
            });
            return ${this.getCamelCase(table.name)}?.${this.getCamelCase(key)} || [];
          }
        `
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
      }
    `;

    return this.formatCode(template);
  }

  async createPaginationInterface() {
    const interfacePath = path.join(this.schema.url, 'domain/common/interfaces');
    const filePath = path.join(interfacePath, 'paginated-response.interface.ts');

    // Create directory if it doesn't exist
    if (!fs.existsSync(interfacePath)) {
      fs.mkdirSync(interfacePath, { recursive: true });
    }

    let content = `
    export interface PaginationMeta {
      total: number;
      page: number;
      limit: number;
    }

    export interface PaginatedResponse<T> {
      data: T[];
      meta: PaginationMeta;
    }
  `;

    content = await this.formatCode(content);

    fs.writeFileSync(filePath, content);
  }

  // Generate usecase
  generateUseCase(table) {
    const entityName = this.getPascalCase(table.name);
    const template = `
      import { Injectable } from '@nestjs/common';
      import { ${entityName}Model, Update${entityName}Model } from 'src/domain/models/${this.getCamelCase(table.name)}.model';
      import { ${entityName}Repository } from 'src/infrastructure/repository/${this.getCamelCase(table.name)}.repository';
      import { Query${entityName}Dto } from 'src/infrastructure/controllers/${this.getCamelCase(table.name)}/${this.getCamelCase(table.name)}.dto';

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

        ${Object.entries(table.relations).map(([key, rel]) => rel.type === "OneToMany" ? `
          async get${this.getPlural(key)}Of${entityName}(id: ${this.schema.char_primary_key ? 'string' : 'number'}) {
            return await this.${this.getCamelCase(table.name)}Repository.get${this.getPlural(key)}Of${entityName}(id);
          }
        `: "").join('\n')}
      }
    `;

    return this.formatCode(template);
  }

  // Generate controller
  generateController(table) {
    const entityName = this.getPascalCase(table.name);
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
    import { ${entityName}UseCases } from 'src/usecases/${this.getCamelCase(table.name)}/${this.getCamelCase(table.name)}.usecases';
    import { Create${entityName}Dto, Update${entityName}Dto, Query${entityName}Dto } from './${this.getCamelCase(table.name)}.dto';
    import { ApiTags, ApiOperation } from '@nestjs/swagger';

    @ApiTags('${this.getPlural(table.name)}')
    @Controller('${this.getCamelCase(this.getPlural(table.name))}')
    @UseGuards(JwtAuthGuard)
    export class ${entityName}Controller {
      constructor(private readonly ${this.getCamelCase(table.name)}UseCases: ${entityName}UseCases) {}

      @Post()
      @ApiOperation({ summary: 'Create ${table.name}' })
      create${entityName}(@Body() ${this.getCamelCase(table.name)}: Create${entityName}Dto) {
        return this.${this.getCamelCase(table.name)}UseCases.create${entityName}(${this.getCamelCase(table.name)});
      }

      @Get(':id')
      @ApiOperation({ summary: 'Get ${table.name} by id' })
      get${entityName}ById(@Param('id', ParseIntPipe) id: ${this.schema.char_primary_key ? 'string' : 'number'}) {
        return this.${this.getCamelCase(table.name)}UseCases.get${entityName}ById(id);
      }

      @Get()
      @ApiOperation({ summary: 'Get all ${this.getPlural(table.name)}' })
      get${this.getPlural(entityName)}(@Query() query: Query${entityName}Dto) {
        return this.${this.getCamelCase(table.name)}UseCases.get${this.getPlural(entityName)}(query);
      }

      @Put(':id')
      @ApiOperation({ summary: 'Update ${table.name}' })
      update${entityName}(
        @Param('id', ParseIntPipe) id: ${this.schema.char_primary_key ? 'string' : 'number'},
        @Body() ${this.getCamelCase(table.name)}: Update${entityName}Dto,
      ) {
        return this.${this.getCamelCase(table.name)}UseCases.update${entityName}(id, ${this.getCamelCase(table.name)});
      }

      @Delete(':id')
      @ApiOperation({ summary: 'Delete ${table.name}' })
      delete${entityName}(@Param('id', ParseIntPipe) id: ${this.schema.char_primary_key ? 'string' : 'number'}) {
        return this.${this.getCamelCase(table.name)}UseCases.delete${entityName}(id);
      }

      ${Object.entries(table.relations).map(([key, rel]) => rel.type === 'OneToMany' ? `
        @Get(':id/${this.getCamelCase(this.getPlural(key))}')
        @ApiOperation({ summary: 'Get ${this.getPlural(key)} of ${table.name}' })
        get${this.getPlural(key)}Of${entityName}(@Param('id', ParseIntPipe) id: ${this.schema.char_primary_key ? 'string' : 'number'}) {
          return this.${this.getCamelCase(table.name)}UseCases.get${this.getPlural(key)}Of${entityName}(id);
        }
      `: "").join('\n')}
    }
  `;

    return this.formatCode(template);
  }

  generateModel(table) {
    const entityName = this.getPascalCase(table.name);
    const template = `
    ${Object.entries(table.relations).map(([key, rel]) => `
      import { ${this.getEntityClassName(rel.entity || key)} } from '../../infrastructure/entities/${this.getCamelCase(rel.entity || key)}.entity';
    `).join('\n')}

    // Base model for creating a ${entityName}
    export class ${entityName}Model {
      ${Object.entries(table.properties).map(([key, prop]) => `
        ${key}${prop.nullable ? "?" : ""}: ${this.getTypeScriptType(prop.type)};`).join('')}
      ${Object.entries(table.relations).map(([key, rel]) => {
      if (rel.type === 'ManyToOne') {
        return `${this.getCamelCase(key)}_id: number;`;
      }
      return '';
    }).filter(Boolean).join('\n')}
    }

    // Model returned when fetching ${entityName}
    export class Fetch${entityName}Model extends ${entityName}Model {
      id: ${this.schema.char_primary_key ? 'string' : 'number'};
      created_on: Date;
      updated_on: Date;
      ${Object.entries(table.relations).map(([key, rel]) => {
      if (rel.type === 'ManyToOne') {
        return `${this.getCamelCase(key)}_id${rel.required === true ? "" : "?"}: number` +
          `\n${this.getCamelCase(key)}Data${rel.required === true ? "" : "?"}: ${this.getEntityClassName(rel.entity || key)};
        `;
      } else if (rel.type === 'OneToMany') {
        return `${this.getCamelCase(this.getPlural(key))}?: ${this.getEntityClassName(rel.entity || key)}[];`;
      }
      return '';
    }).filter(Boolean).join('')}
    }

    // Model for updating ${entityName}
    export class Update${entityName}Model {
      ${Object.entries(table.properties).map(([key, prop]) => `
        ${key}?: ${this.getTypeScriptType(prop.type)};`).join('')}
      ${Object.entries(table.relations).map(([key, rel]) => {
      if (rel.type === 'ManyToOne') {
        return `${this.getCamelCase(key)}_id?: number;`;
      }
      return '';
    }).filter(Boolean).join('')}
    }
  `;

    return this.formatCode(template);
  }

  // Generate migration
  generateMigration(table) {
    const timestamp = Date.now();
    const template = `
    import { MigrationInterface, QueryRunner, Table } from 'typeorm';

    export class create${this.getPlural(this.getPascalCase(table.name))}Table${timestamp} implements MigrationInterface {
      public async up(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.createTable(
          new Table({
            name: '${this.getCamelCase(this.getPlural(table.name))}',
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
              ${Object.entries(table.properties).map(([key, prop]) => `
                {
                  name: '${key}',
                  type: '${prop.type}',
                  ${prop.nullable ? 'isNullable: true,' : ''}
                },
              `).join('\n')}
              ${Object.entries(table.relations).length > 0 ? Object.entries(table.relations).map(([key, prop]) => prop.type === 'ManyToOne' ? `
                {
                  name: '${key}',
                  type: 'number',
                  ${prop.nullable ? 'isNullable: true,' : ''}
                },
              ` : '').join('\n').concat(",") : ""}
              {
                name: 'created_on',
                type: 'timestamptz',
                default: 'now()',
              },
              {
                name: 'updated_on',
                type: 'timestamptz',
                default: 'now()',
              },
            ],
          }),
        );

        ${Object.entries(table.relations).map(([key, rel]) => {
        if (rel.type === 'ManyToMany') {
          return `
              await queryRunner.createTable(
                new Table({
                  name: '${this.getCamelCase(table.name)}_${this.getCamelCase(key)}',
                  columns: [
                    {
                      name: '${this.getCamelCase(table.name)}_id',
                      type: '${this.schema.char_primary_key ? 'uuid' : 'int4'}',
                    },
                    {
                      name: '${this.getCamelCase(key)}_id',
                      type: '${this.schema.char_primary_key ? 'uuid' : 'int4'}',
                    },
                  ],
                  foreignKeys: [
                    {
                      columnNames: ['${this.getCamelCase(table.name)}_id'],
                      referencedTableName: '${this.getCamelCase(this.getPlural(table.name))}',
                      referencedColumnNames: ['id'],
                      onDelete: 'CASCADE',
                    },
                    {
                      columnNames: ['${this.getCamelCase(key)}_id'],
                      referencedTableName: '${this.getCamelCase(this.getPlural(key))}',
                      referencedColumnNames: ['id'],
                      onDelete: 'CASCADE',
                    },
                  ],
                }),
              );
            `;
        }
        return '';
      }).join('\n')}
      }

      public async down(queryRunner: QueryRunner): Promise<void> {
        ${Object.entries(table.relations).map(([key, rel]) => {
        if (rel.type === 'ManyToMany') {
          return `await queryRunner.dropTable('${this.getCamelCase(table.name)}_${this.getCamelCase(key)}');`;
        }
        return '';
      }).join('\n')}
        await queryRunner.dropTable('${this.getCamelCase(this.getPlural(table.name))}');
      }
    }
  `;

    return this.formatCode(template);
  }

  // Methods for updating module files
  async updateModuleFile(filePath, entityName, type) {
    const sourceFile = this.project.addSourceFileAtPath(filePath);

    switch (type) {
      case 'entity':
        // Update db.ts
        // Add import if it doesn't exist
        if (!sourceFile.getImportDeclaration(
          (imp) => imp.getModuleSpecifierValue() === `./${this.getCamelCase(entityName)}.entity`
        )) {
          sourceFile.addImportDeclaration({
            moduleSpecifier: `./${this.getCamelCase(entityName)}.entity`,
            namedImports: [{ name: this.getEntityClassName(entityName) }]
          });
        }

        // Update the default export array
        const exportArr = sourceFile.getFirstDescendant(
          node => node.isKind(ts.SyntaxKind.ArrayLiteralExpression)
        );

        if (exportArr) {
          // Check if the entity is already in the array
          const elements = exportArr.getElements();
          const entityExists = elements.some(
            el => el.getText() === this.getEntityClassName(entityName)
          );

          if (!entityExists) {
            exportArr.addElement(this.getEntityClassName(entityName));
          }
        }
        break;
      case 'repository':
        // Check if import already exists
        if (!sourceFile.getImportDeclaration(
          (imp) => imp.getModuleSpecifierValue() === `./${this.getCamelCase(entityName)}.repository`
        )) {
          sourceFile.addImportDeclaration({
            moduleSpecifier: `./${this.getCamelCase(entityName)}.repository`,
            namedImports: [{ name: `${this.getPascalCase(entityName)}Repository` }]
          });
        }

        // Add to providers and exports arrays if not already present
        const repoModule = sourceFile.getClass('RepositoryModule');
        if (repoModule) {
          const decorator = repoModule.getDecorator('Module');
          if (decorator) {
            const [argument] = decorator.getArguments();
            const properties = argument.getProperties();

            properties.forEach(prop => {
              const propName = prop.getName();
              if (['providers', 'exports'].includes(propName)) {
                const initializer = prop.getInitializer();
                if (initializer.getKind() === ts.SyntaxKind.ArrayLiteralExpression) {
                  const elements = initializer.getElements();
                  const elementExists = elements.some(
                    el => el.getText() === `${this.getPascalCase(entityName)}Repository`
                  );
                  if (!elementExists) {
                    initializer.addElement(`${this.getPascalCase(entityName)}Repository`);
                  }
                }
              }
            });
          }
        }
        break;

      case 'usecase':
        if (!sourceFile.getImportDeclaration(
          (imp) => imp.getModuleSpecifierValue() === `./${this.getCamelCase(entityName)}/${this.getCamelCase(entityName)}.usecases`
        )) {
          sourceFile.addImportDeclaration({
            moduleSpecifier: `./${this.getCamelCase(entityName)}/${this.getCamelCase(entityName)}.usecases`,
            namedImports: [{ name: `${this.getPascalCase(entityName)}UseCases` }]
          });
        }

        const usecaseModule = sourceFile.getClass('UseCaseModule');
        if (usecaseModule) {
          const decorator = usecaseModule.getDecorator('Module');
          if (decorator) {
            const [argument] = decorator.getArguments();
            const properties = argument.getProperties();

            properties.forEach(prop => {
              const propName = prop.getName();
              if (['providers', 'exports'].includes(propName)) {
                const initializer = prop.getInitializer();
                if (initializer.getKind() === ts.SyntaxKind.ArrayLiteralExpression) {
                  const elements = initializer.getElements();
                  const elementExists = elements.some(
                    el => el.getText() === `${this.getPascalCase(entityName)}UseCases`
                  );
                  if (!elementExists) {
                    initializer.addElement(`${this.getPascalCase(entityName)}UseCases`);
                  }
                }
              }
            });
          }
        }
        break;

      case 'controller':
        if (!sourceFile.getImportDeclaration(
          (imp) => imp.getModuleSpecifierValue() === `./${this.getCamelCase(entityName)}/${this.getCamelCase(entityName)}.controller`
        )) {
          sourceFile.addImportDeclaration({
            moduleSpecifier: `./${this.getCamelCase(entityName)}/${this.getCamelCase(entityName)}.controller`,
            namedImports: [{ name: `${this.getPascalCase(entityName)}Controller` }]
          });
        }

        const controllerModule = sourceFile.getClass('ControllerModule');
        if (controllerModule) {
          const decorator = controllerModule.getDecorator('Module');
          if (decorator) {
            const [argument] = decorator.getArguments();
            const properties = argument.getProperties();

            properties.forEach(prop => {
              const propName = prop.getName();
              if (propName === 'controllers') {
                const initializer = prop.getInitializer();
                if (initializer.getKind() === ts.SyntaxKind.ArrayLiteralExpression) {
                  const elements = initializer.getElements();
                  const elementExists = elements.some(
                    el => el.getText() === `${this.getPascalCase(entityName)}Controller`
                  );
                  if (!elementExists) {
                    initializer.addElement(`${this.getPascalCase(entityName)}Controller`);
                  }
                }
              }
            });
          }
        }
        break;
    }

    await sourceFile.save();
  }

  // Create directories if they don't exist
  createDirectoriesIfNeeded(tableName) {
    const directories = [
      path.join(this.schema.url, 'infrastructure/entities'),
      path.join(this.schema.url, 'infrastructure/repository'),
      path.join(this.schema.url, 'infrastructure/controllers', this.getCamelCase(tableName)),
      path.join(this.schema.url, 'domain/models'),
      path.join(this.schema.url, 'domain/repositories'),
      path.join(this.schema.url, 'usecases', this.getCamelCase(tableName)),
      path.join(this.schema.url, 'infrastructure/migrations'),
    ];

    directories.forEach(dir => {
      if (!fs.existsSync(dir)) {
        fs.mkdirSync(dir, { recursive: true });
      }
    });
  }

  // Main generate method
  async generate() {
    try {
      // Create pagination interface first
      this.createPaginationInterface();

      for (const table of this.schema.tables) {
        console.log(`Generating files for ${table.name}...`);

        // Create necessary directories
        this.createDirectoriesIfNeeded(table.name);

        // Generate all files
        const files = {
          entity: {
            content: await (this.generateEntity(table)),
            path: path.join(this.schema.url, 'infrastructure/entities', this.getEntityFileName(table.name))
          },
          dto: {
            content: await (this.generateDto(table)),
            path: path.join(this.schema.url, 'infrastructure/controllers', this.getCamelCase(table.name), `${this.getCamelCase(table.name)}.dto.ts`)
          },
          repositoryInterface: {
            content: await (this.generateRepositoryInterface(table)),
            path: path.join(this.schema.url, 'domain/repositories', `${this.getCamelCase(table.name)}.repository.interface.ts`)
          },
          repository: {
            content: await (this.generateRepository(table)),
            path: path.join(this.schema.url, 'infrastructure/repository', `${this.getCamelCase(table.name)}.repository.ts`)
          },
          useCase: {
            content: await (this.generateUseCase(table)),
            path: path.join(this.schema.url, 'usecases', this.getCamelCase(table.name), `${this.getCamelCase(table.name)}.usecases.ts`)
          },
          controller: {
            content: await (this.generateController(table)),
            path: path.join(this.schema.url, 'infrastructure/controllers', this.getCamelCase(table.name), `${this.getCamelCase(table.name)}.controller.ts`)
          },
          migration: {
            content: await (this.generateMigration(table)),
            path: path.join(this.schema.url, '../database/migrations', `${Date.now()}-create-${this.getCamelCase(this.getPlural(table.name))}-table.ts`)
          },
          model: {
            content: await (this.generateModel(table)),
            path: path.join(this.schema.url, 'domain/models', `${this.getCamelCase(table.name)}.model.ts`)
          },
        };

        // Write all files
        for (const [key, file] of Object.entries(files)) {
          fs.writeFileSync(file.path, file.content);
          console.log(`Generated ${key} file at ${file.path}`);
        }

        // Update module files if needed
        if (this.schema.insert_to_modules) {
          await this.updateModuleFile(this.schema.entity_module_file, table.name, 'entity');
          await this.updateModuleFile(this.schema.repository_module_file, table.name, 'repository');
          await this.updateModuleFile(this.schema.usecase_module_file, table.name, 'usecase');
          await this.updateModuleFile(this.schema.controller_module_file, table.name, 'controller');
        }
      }

      console.log('Generation completed successfully!');
    } catch (error) {
      console.error('Error during generation:', error);
      throw error;
    }
  }

  // Utility method for code formatting
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
      console.error('Error formatting code:', error);
      return code;
    }
  }

  // Helper method to convert database types to TypeScript types
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
      'json': 'Record<string, any>',
      'jsonb': 'Record<string, any>'
    };
    return typeMapping[dbType] || 'any';
  }
}

// // Simple execution
// try {
//   const generator = new NestjsResourceGenerator('./schema.json');

//   generator.generate().then(() => {
//     console.log('✨ Resources generated successfully!');
//   }).catch(error => {
//     console.error('Error generating resources:', error);
//     process.exit(1);
//   });
// } catch (error) {
//   console.error('Failed to initialize generator:', error);
//   process.exit(1);
// }

module.exports = NestjsResourceGenerator;