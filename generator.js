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

  // Generate entity file
  generateEntity(table) {
    const entityName = this.getPascalCase(this.getPlural(table.name));
    const template = `
      import {
        Entity,
        PrimaryGeneratedColumn,
        CreateDateColumn,
        UpdateDateColumn,
        Column,
        ${Object.keys(table.relations).map(rel => rel.type).join(',\n')}
      } from 'typeorm';

      @Entity('${this.getCamelCase(this.getPlural(table.name))}')
      export class ${entityName} {
        @PrimaryGeneratedColumn({ type: '${this.schema.char_primary_key ? 'uuid' : 'int4'}' })
        id: ${this.schema.char_primary_key ? 'string' : 'number'};

        ${Object.entries(table.properties).map(([key, prop]) => `
          @Column({ type: '${prop.type}'${prop.nullable ? ', nullable: true' : ''} })
          ${key}: ${this.getTypeScriptType(prop.type)};
        `).join('\n')}

        ${Object.entries(table.relations).map(([key, rel]) => this.generateRelation(key, rel)).join('\n')}

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
      }

      export class Update${entityName}Dto {
        ${Object.entries(table.properties).map(([key, prop]) => `
          @IsOptional()
          @ApiProperty({ required: false })
          ${key}?: ${this.getTypeScriptType(prop.type)};
        `).join('\n')}
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
      import { ${entityName}Model, Fetch${entityName}Model, Update${entityName}Model } from 'src/domain/models/${this.getCamelCase(table.name)}';
      import { PaginatedResponse } from 'src/domain/common/interfaces/paginated-response.interface';
      import { Query${entityName}Dto } from 'src/infrastructure/controllers/${this.getCamelCase(table.name)}/${this.getCamelCase(table.name)}.dto';

      export interface I${entityName} {
        create${entityName}(${this.getCamelCase(table.name)}Model: ${entityName}Model): Promise<Fetch${entityName}Model>;
        get${entityName}(id: ${this.schema.char_primary_key ? 'string' : 'number'}): Promise<Fetch${entityName}Model>;
        get${this.getPlural(entityName)}(query: Query${entityName}Dto): Promise<PaginatedResponse<Fetch${entityName}Model>>;
        update${entityName}(id: ${this.schema.char_primary_key ? 'string' : 'number'}, update${entityName}Model: Update${entityName}Model): Promise<Fetch${entityName}Model>;
        delete${entityName}(id: ${this.schema.char_primary_key ? 'string' : 'number'}): Promise<void>;
        ${Object.entries(table.relations).map(([key, rel]) => `
          get${this.getPlural(key)}Of${entityName}(id: ${this.schema.char_primary_key ? 'string' : 'number'}): Promise<any[]>;
        `).join('\n')}
      }
    `;

    return this.formatCode(template);
  }

  // Generate repository implementation
  generateRepository(table) {
    const entityName = this.getPascalCase(table.name);
    const template = `
      import { Injectable, NotFoundException } from '@nestjs/common';
      import { InjectRepository } from '@nestjs/typeorm';
      import { Repository } from 'typeorm';
      import { ${entityName}Model, Fetch${entityName}Model, Update${entityName}Model } from 'src/domain/models/${this.getCamelCase(table.name)}';
      import { I${entityName} } from 'src/domain/repositories/${this.getCamelCase(table.name)}.repository.interface';
      import { ${entityName} } from 'src/infrastructure/entities/${this.getCamelCase(table.name)}.entity';
      import { PaginatedResponse } from 'src/domain/common/interfaces/paginated-response.interface';
      import { Query${entityName}Dto } from 'infrastructure/controllers/${this.getCamelCase(table.name)}/${this.getCamelCase(table.name)}.dto';

      @Injectable()
      export class ${entityName}Repository implements I${entityName} {
        constructor(
          @InjectRepository(${entityName})
          private ${this.getCamelCase(table.name)}Repository: Repository<${entityName}>,
        ) {}

        async create${entityName}(${this.getCamelCase(table.name)}Model: ${entityName}Model): Promise<Fetch${entityName}Model> {
          const ${this.getCamelCase(table.name)} = await this.${this.getCamelCase(table.name)}Repository.save(${this.getCamelCase(table.name)}Model);
          return ${this.getCamelCase(table.name)};
        }

        async get${entityName}(id: ${this.schema.char_primary_key ? 'string' : 'number'}): Promise<Fetch${entityName}Model> {
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
            data,
            meta: {
              total,
              page: Number(page),
              limit: Number(limit),
            },
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

        ${Object.entries(table.relations).map(([key, rel]) => `
          async get${this.getPlural(key)}Of${entityName}(id: ${this.schema.char_primary_key ? 'string' : 'number'}): Promise<any[]> {
            const ${this.getCamelCase(table.name)} = await this.${this.getCamelCase(table.name)}Repository.findOne({
              where: { id },
              relations: ['${this.getCamelCase(key)}'],
            });
            return ${this.getCamelCase(table.name)}?.${this.getCamelCase(key)} || [];
          }
        `).join('\n')}

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
      import { ${entityName}Model, Update${entityName}Model } from 'src/domain/models/${this.getCamelCase(table.name)}';
      import { ${entityName}Repository } from 'src/infrastructure/repository/${this.getCamelCase(table.name)}.repository';
      import { Query${entityName}Dto } from 'src/infrastructure/controllers/${this.getCamelCase(table.name)}/${this.getCamelCase(table.name)}.dto';

      @Injectable()
      export class ${entityName}UseCases {
        constructor(private readonly ${this.getCamelCase(table.name)}Repository: ${entityName}Repository) {}

        async create${entityName}(${this.getCamelCase(table.name)}Model: ${entityName}Model) {
          return await this.${this.getCamelCase(table.name)}Repository.create${entityName}(${this.getCamelCase(table.name)}Model);
        }

        async get${entityName}(id: ${this.schema.char_primary_key ? 'string' : 'number'}) {
          return await this.${this.getCamelCase(table.name)}Repository.get${entityName}(id);
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

        ${Object.entries(table.relations).map(([key, rel]) => `
          async get${this.getPlural(key)}Of${entityName}(id: ${this.schema.char_primary_key ? 'string' : 'number'}) {
            return await this.${this.getCamelCase(table.name)}Repository.get${this.getPlural(key)}Of${entityName}(id);
          }
        `).join('\n')}
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
      get${entityName}(@Param('id', ParseIntPipe) id: ${this.schema.char_primary_key ? 'string' : 'number'}) {
        return this.${this.getCamelCase(table.name)}UseCases.get${entityName}(id);
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

      ${Object.entries(table.relations).map(([key, rel]) => `
        @Get(':id/${this.getCamelCase(this.getPlural(key))}')
        @ApiOperation({ summary: 'Get ${this.getPlural(key)} of ${table.name}' })
        get${this.getPlural(key)}Of${entityName}(@Param('id', ParseIntPipe) id: ${this.schema.char_primary_key ? 'string' : 'number'}) {
          return this.${this.getCamelCase(table.name)}UseCases.get${this.getPlural(key)}Of${entityName}(id);
        }
      `).join('\n')}
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
        sourceFile.addImportDeclaration({
          moduleSpecifier: `./${this.getCamelCase(entityName)}.entity`,
          namedImports: [{ name: this.getPascalCase(this.getPlural(entityName)) }]
        });

        // Add to export array
        const exportArr = sourceFile.getVariableDeclaration('default');
        if (exportArr) {
          const arrayLiteral = exportArr.getInitializer();
          if (arrayLiteral) {
            arrayLiteral.addElement(this.getPascalCase(this.getPlural(entityName)));
          }
        }
        break;

      case 'repository':
        // Update repository.module.ts
        sourceFile.addImportDeclaration({
          moduleSpecifier: `./${this.getCamelCase(entityName)}.repository`,
          namedImports: [{ name: `${this.getPascalCase(entityName)}Repository` }]
        });

        // Add to providers and exports arrays
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
                  initializer.addElement(`${this.getPascalCase(entityName)}Repository`);
                }
              }
            });
          }
        }
        break;

      case 'usecase':
        // Update usecase.module.ts
        sourceFile.addImportDeclaration({
          moduleSpecifier: `./${this.getCamelCase(entityName)}/${this.getCamelCase(entityName)}.usecases`,
          namedImports: [{ name: `${this.getPascalCase(entityName)}UseCases` }]
        });

        // Add to providers and exports arrays
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
                  initializer.addElement(`${this.getPascalCase(entityName)}UseCases`);
                }
              }
            });
          }
        }
        break;

      case 'controller':
        // Update controller.module.ts
        sourceFile.addImportDeclaration({
          moduleSpecifier: `./${this.getCamelCase(entityName)}/${this.getCamelCase(entityName)}.controller`,
          namedImports: [{ name: `${this.getPascalCase(entityName)}Controller` }]
        });

        // Add to controllers array
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
                  initializer.addElement(`${this.getPascalCase(entityName)}Controller`);
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
            path: path.join(this.schema.url, 'infrastructure/entities', `${this.getCamelCase(table.name)}.entity.ts`)
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
            path: path.join(this.schema.url, 'infrastructure/migrations', `${Date.now()}-create-${this.getCamelCase(this.getPlural(table.name))}-table.ts`)
          }
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