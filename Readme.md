# NestJS Resource Generator

Automatically generate NestJS resource files following clean architecture pattern. This generator creates Entity, DTO, Repository Interface, Repository Implementation, UseCase, Controller, and Migration files following NestJS clean architecture structure.

## Installation

```bash
npm install -g nestjs-resource-generator
```

## Usage

1. Create a file named exactly `schema.json` in your project root (the filename must be schema.json):

2. Add your configuration to schema.json. Example:

```json
{
  "url": "D:/Projects/NodeJs/my-nest-project",
  "char_primary_key": false,
  "insert_to_modules": true,
  "entity_module_file": "D:/Projects/NodeJs/my-nest-project/infrastructure/entities/db.ts",
  "repository_module_file": "D:/Projects/NodeJs/my-nest-project/infrastructure/repository/repository.module.ts",
  "usecase_module_file": "D:/Projects/NodeJs/my-nest-project/usecases/usecase.module.ts",
  "controller_module_file": "D:/Projects/NodeJs/my-nest-project/infrastructure/controllers/controller.module.ts",
  "tables": [
    {
      "name": "Support",
      "create_pagination_route": true,
      "create_relation_get_route": true,
      "properties": {
        "email": {
          "type": "varchar",
          "nullable": false
        },
        "first_name": {
          "type": "varchar",
          "nullable": false
        },
        "last_name": {
          "type": "varchar",
          "nullable": false
        },
        "message": {
          "type": "varchar",
          "nullable": false
        }
      },
      "relations": {}
    }
  ]
}
```

3. Run the generator in your project directory:

```bash
nestjs-resource-generate
```

## Schema Configuration

### Root Level Options

- `url`: Absolute path to your project root
- `char_primary_key`: Use UUID instead of numeric IDs (default: false)
- `insert_to_modules`: Automatically update module files (default: true)
- `entity_module_file`: Path to db.ts
- `repository_module_file`: Path to repository.module.ts
- `usecase_module_file`: Path to usecase.module.ts
- `controller_module_file`: Path to controller.module.ts

### Table Configuration

- `name`: Resource name in PascalCase (e.g., "User", "Product")
- `create_pagination_route`: Generate pagination endpoints (default: true)
- `create_relation_get_route`: Generate relation GET routes (default: true)
- `properties`: Object containing field definitions
- `relations`: Object containing relation definitions

### Property Types

Available types for properties:

- `varchar`
- `text`
- `int`
- `int4`
- `integer`
- `decimal`
- `boolean`
- `timestamp`
- `timestamptz`
- `json`
- `jsonb`

### Example with Relations

```json
{
  "url": "D:/Projects/NodeJs/my-nest-project",
  "char_primary_key": false,
  "insert_to_modules": true,
  "entity_module_file": "D:/Projects/NodeJs/my-nest-project/infrastructure/entities/db.ts",
  "repository_module_file": "D:/Projects/NodeJs/my-nest-project/infrastructure/repository/repository.module.ts",
  "usecase_module_file": "D:/Projects/NodeJs/my-nest-project/usecases/usecase.module.ts",
  "controller_module_file": "D:/Projects/NodeJs/my-nest-project/infrastructure/controllers/controller.module.ts",
  "tables": [
    {
      "name": "User",
      "create_pagination_route": true,
      "create_relation_get_route": true,
      "properties": {
        "email": {
          "type": "varchar",
          "nullable": false
        },
        "password": {
          "type": "varchar",
          "nullable": false
        },
        "is_active": {
          "type": "boolean",
          "nullable": false
        }
      },
      "relations": {
        "posts": {
          "type": "OneToMany"
        },
        "profile": {
          "type": "OneToOne"
        },
        "roles": {
          "type": "ManyToMany"
        }
      }
    }
  ]
}
```

## Generated Files Structure

For each resource, the generator creates:

```
project/
├── infrastructure/
│   ├── entities/
│   │   └── resource.entity.ts
│   ├── controllers/
│   │   └── resource/
│   │       ├── resource.controller.ts
│   │       └── resource.dto.ts
│   ├── repository/
│   │   └── resource.repository.ts
│   └── migrations/
│       └── timestamp-create-resources-table.ts
├── domain/
│   ├── models/
│   │   └── resource.model.ts
│   └── repositories/
│       └── resource.repository.interface.ts
└── usecases/
    └── resource/
        └── resource.usecases.ts
```

## Important Notes

- The schema file must be named exactly `schema.json`
- All paths in schema.json must be absolute paths
- The generator will create directories if they don't exist
- Existing files will be overwritten

```

This README provides:
1. Clear instructions about the schema.json requirement
2. Detailed examples of both simple and complex configurations
3. Complete documentation of available options
4. File structure visualization
5. Important notes and warnings
```
