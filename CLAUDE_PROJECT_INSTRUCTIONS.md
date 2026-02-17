# NestJS Resource Generator - Schema Instructions

## Table Definition Format

```json
{
  "name": "EntityName",
  "create_pagination_route": true,
  "create_relation_get_route": true,
  "properties": {
    "field_name": {
      "type": "varchar|text|int|int4|integer|decimal|boolean|timestamp|timestamptz|double precision|date|json|jsonb|enum",
      "nullable": boolean,
      "required": boolean,
      "unique": boolean,
      "default": any,
      "length": number, // for varchar
      "comment": "string", // for documentation
      "enum": ["value1", "value2"], // only for enum type
      "dbEnumName": "enum_name", // required for enum if useDbEnum is true (default)
      "useDbEnum": boolean // default: true, set false to use varchar instead
    }
  },
  "relations": {
    "relation_name": {
      "type": "OneToMany|ManyToOne|OneToOne|ManyToMany",
      "entity": "TargetEntityName",
      "required": boolean,
      "isOwner": boolean, // REQUIRED for OneToOne, for ManyToMany
      "onDelete": "CASCADE|RESTRICT|SET NULL|NO ACTION|SET DEFAULT", // default: CASCADE
      "onUpdate": "CASCADE|RESTRICT|SET NULL|NO ACTION|SET DEFAULT" // default: CASCADE
    }
  },
  "indexes": [
    {
      "columns": ["column1", "column2"],
      "unique": boolean, // default: false
      "name": "idx_table_columns" // optional, auto-generated if not provided
    }
  ],
  "constraints": [
    {
      "type": "CHECK|UNIQUE",
      "name": "constraint_name", // optional, auto-generated if not provided
      "expression": "sql_expression", // for CHECK constraints
      "columns": ["column1", "column2"] // for UNIQUE constraints
    }
  ]
}
```

## Important Rules

### 1. Entity Names

- Always use **PascalCase plural** (e.g., `Users`, `Posts`, not `user` or `post`)

### 2. Property Names

- Use **snake_case** for properties (e.g., `first_name`, `created_at`)
- Don't mention pre-generated columns here (`id`, `created_on`, `updated_on`) - they're added automatically

### 3. Relation Naming

- **ManyToOne**: Use `{entity}_id` format (e.g., `user_id`)
- **OneToMany**: Use plural entity name (e.g., `posts`)
- **OneToOne**: Use singular entity name (e.g., `profile`)
- **ManyToMany**: Use plural entity name (e.g., `tags`)

### 4. OneToOne Relations

- **MUST** have `isOwner` field (true or false)
- Owner side creates the foreign key

```json
"profile_id": {
  "type": "OneToOne",
  "entity": "Profiles",
  "required": true,
  "isOwner": false  // REQUIRED!
}
```

### 5. Enum Properties

Enums have **two modes**:

#### Database-level Enum (Default, Recommended)

```json
"status": {
  "type": "enum",
  "enum": ["active", "inactive", "pending"],
  "nullable": false,
  "default": "active",
  "dbEnumName": "user_status_enum"  // REQUIRED when useDbEnum is true (default)
}
```

#### TypeScript-only Enum (varchar column)

```json
"status": {
  "type": "enum",
  "enum": ["active", "inactive", "pending"],
  "nullable": false,
  "default": "active",
  "useDbEnum": false  // No dbEnumName needed
}
```

**Naming Convention:** `{table}_{column}_enum` (e.g., `users_status_enum`, `orders_payment_status_enum`)

### 6. JSONB/JSON Default Values

Use PostgreSQL casting syntax:

```json
"scores": {
  "type": "jsonb",
  "required": true,
  "default": "'{}'::jsonb"  // Empty object
}
```

```json
"tags": {
  "type": "jsonb",
  "required": false,
  "default": "'[]'::jsonb"  // Empty array
}
```

```json
"config": {
  "type": "jsonb",
  "required": false,
  "default": "'{\"theme\":\"dark\",\"lang\":\"en\"}'::jsonb"  // Object with values
}
```

**Rules:**

- Wrap JSON in single quotes: `'<json>'`
- Escape inner double quotes: `\"`
- Add type cast: `::jsonb` or `::json`

### 7. Indexes

Single column index:

```json
"indexes": [
  {
    "columns": ["email"],
    "unique": true,
    "name": "idx_users_email_unique"
  }
]
```

Composite index:

```json
"indexes": [
  {
    "columns": ["user_id", "created_on"],
    "unique": false,
    "name": "idx_posts_user_created"
  }
]
```

Auto-named index:

```json
"indexes": [
  {
    "columns": ["status", "priority"]
  }
]
// Generated name: idx_tablename_status_priority
```

### 8. Constraints

#### CHECK Constraints

```json
"constraints": [
  {
    "type": "CHECK",
    "name": "users_age_range",
    "expression": "age >= 18 AND age <= 120"
  }
]
```

Common patterns:

```json
// Range check
"expression": "price > 0"

// Conditional NULL
"expression": "confidence IS NULL OR (confidence >= 0 AND confidence <= 1)"

// Status logic
"expression": "(status = 'pending' AND paid_at IS NULL) OR (status = 'completed' AND paid_at IS NOT NULL)"
```

#### UNIQUE Constraints

```json
"constraints": [
  {
    "type": "UNIQUE",
    "name": "user_badges_user_id_badge_id_unique",
    "columns": ["user_id", "badge_id"]
  }
]
```

### 9. Foreign Key Options

```json
"user_id": {
  "type": "ManyToOne",
  "entity": "Users",
  "required": true,
  "onDelete": "CASCADE",  // Options: CASCADE, RESTRICT, SET NULL, NO ACTION
  "onUpdate": "CASCADE"
}
```

| Option            | Behavior                                           |
| ----------------- | -------------------------------------------------- |
| CASCADE (default) | Deletes/updates cascade to related records         |
| RESTRICT          | Prevents deletion if related records exist         |
| SET NULL          | Sets foreign key to NULL (requires nullable: true) |
| NO ACTION         | Similar to RESTRICT                                |

### 10. Common Property Types

| Type                          | Use For                       | Example                         |
| ----------------------------- | ----------------------------- | ------------------------------- |
| `varchar`                     | String fields, limited length | `email`, `name`, `slug`         |
| `text`                        | Long text, unlimited          | `content`, `description`        |
| `int`, `int4`, `integer`      | Whole numbers                 | `count`, `age`, `quantity`      |
| `decimal`, `double precision` | Decimal numbers               | `price`, `rating`, `confidence` |
| `boolean`                     | True/false                    | `is_active`, `is_verified`      |
| `timestamp`, `timestamptz`    | Date/time                     | `started_at`, `expires_at`      |
| `date`                        | Date only                     | `birth_date`, `event_date`      |
| `json`, `jsonb`               | JSON data                     | `metadata`, `settings`          |
| `enum`                        | Predefined values             | `status`, `role`, `category`    |

**Prefer `jsonb` over `json`** - it's faster and supports indexing.

## Complete Example Schema

```json
{
  "root": "/path/to/project",
  "paths": {
    "src": "/src",
    "entity_module": "/src/infrastructure/entities/db.ts",
    "repository_module": "/src/infrastructure/repository/repository.module.ts",
    "usecase_module": "/src/usecases/usecase.module.ts",
    "controller_module": "/src/infrastructure/controllers/controller.module.ts"
  },
  "char_primary_key": false,
  "insert_to_modules": true,
  "tables": [
    {
      "name": "Users",
      "create_pagination_route": true,
      "create_relation_get_route": true,
      "properties": {
        "email": {
          "type": "varchar",
          "length": 255,
          "nullable": false,
          "unique": true
        },
        "full_name": {
          "type": "varchar",
          "length": 100,
          "nullable": false
        },
        "age": {
          "type": "int4",
          "nullable": false
        },
        "status": {
          "type": "enum",
          "enum": ["active", "inactive", "suspended"],
          "nullable": false,
          "default": "active",
          "dbEnumName": "users_status_enum"
        },
        "preferences": {
          "type": "jsonb",
          "nullable": false,
          "default": "'{}'::jsonb"
        }
      },
      "relations": {
        "posts": {
          "type": "OneToMany",
          "entity": "Posts",
          "required": false
        },
        "profile_id": {
          "type": "OneToOne",
          "entity": "Profiles",
          "required": false,
          "isOwner": false
        }
      },
      "indexes": [
        {
          "columns": ["email"],
          "unique": true
        },
        {
          "columns": ["status", "created_on"]
        }
      ],
      "constraints": [
        {
          "type": "CHECK",
          "name": "users_age_valid",
          "expression": "age >= 18 AND age <= 120"
        }
      ]
    },
    {
      "name": "Posts",
      "create_pagination_route": true,
      "create_relation_get_route": true,
      "properties": {
        "title": {
          "type": "varchar",
          "length": 200,
          "nullable": false
        },
        "content": {
          "type": "text",
          "nullable": false
        },
        "view_count": {
          "type": "int4",
          "nullable": false,
          "default": 0
        },
        "status": {
          "type": "enum",
          "enum": ["draft", "published", "archived"],
          "nullable": false,
          "default": "draft",
          "dbEnumName": "posts_status_enum"
        },
        "tags": {
          "type": "jsonb",
          "nullable": false,
          "default": "'[]'::jsonb"
        }
      },
      "relations": {
        "user_id": {
          "type": "ManyToOne",
          "entity": "Users",
          "required": true,
          "onDelete": "CASCADE"
        },
        "comments": {
          "type": "OneToMany",
          "entity": "Comments",
          "required": false
        }
      },
      "indexes": [
        {
          "columns": ["user_id", "created_on"]
        },
        {
          "columns": ["status"]
        }
      ],
      "constraints": [
        {
          "type": "CHECK",
          "name": "posts_view_count_positive",
          "expression": "view_count >= 0"
        }
      ]
    },
    {
      "name": "UserBadges",
      "create_pagination_route": true,
      "create_relation_get_route": false,
      "properties": {
        "earned_at": {
          "type": "timestamptz",
          "default": "NOW()"
        },
        "progress_value": {
          "type": "int4",
          "default": 0
        }
      },
      "relations": {
        "user_id": {
          "type": "ManyToOne",
          "entity": "Users",
          "required": true
        },
        "badge_id": {
          "type": "ManyToOne",
          "entity": "Badges",
          "required": true
        }
      },
      "constraints": [
        {
          "type": "UNIQUE",
          "name": "user_badges_user_id_badge_id_unique",
          "columns": ["user_id", "badge_id"]
        }
      ]
    }
  ]
}
```

## Validation Rules

The generator validates:

1. **OneToOne relations** must have `isOwner` field
2. **ManyToOne** relations must have corresponding **OneToMany** in target entity
3. **OneToMany** relations must have corresponding **ManyToOne** in target entity
4. **Enum with useDbEnum=true** (default) must have `dbEnumName`
5. **UNIQUE constraints** must use `columns` array (not `expression`)
6. **CHECK constraints** must use `expression` string (not `columns`)

## Best Practices

### Indexes

- ✅ Always index foreign keys
- ✅ Index frequently queried columns
- ✅ Use composite indexes for multi-column queries
- ✅ Use unique indexes for uniqueness with performance
- ❌ Don't over-index (slows INSERT/UPDATE)

### Constraints

- ✅ Use CHECK for business rule validation
- ✅ Use UNIQUE for composite uniqueness
- ✅ Name constraints clearly: `{table}_{description}`
- ✅ Keep expressions simple
- ❌ Don't replace application validation

### Enums

- ✅ Use database enums (default) for type safety
- ✅ Use varchar enums when values change frequently
- ✅ Name: `{table}_{column}_enum`
- ❌ Don't use enums for frequently changing values

### Relations

- ✅ Use CASCADE carefully (can delete data)
- ✅ Use RESTRICT for important relations
- ✅ Always validate bidirectional relations
- ❌ Don't forget `isOwner` on OneToOne

### JSONB

- ✅ Use for flexible data structures
- ✅ Prefer `jsonb` over `json`
- ✅ Provide sensible defaults (`{}` or `[]`)
- ✅ Validate structure in application
- ❌ Don't store large binary data

## Common Patterns

### User Authentication

```json
{
  "email": { "type": "varchar", "nullable": false, "unique": true },
  "password_hash": { "type": "varchar", "nullable": false },
  "is_verified": { "type": "boolean", "default": false },
  "last_login": { "type": "timestamptz", "nullable": true }
}
```

### Soft Delete

```json
{
  "deleted_at": { "type": "timestamptz", "nullable": true },
  "is_deleted": { "type": "boolean", "default": false }
}
```

### Timestamps

```json
{
  "started_at": { "type": "timestamptz", "nullable": true },
  "completed_at": { "type": "timestamptz", "nullable": true }
}
```

### Status Tracking

```json
{
  "status": {
    "type": "enum",
    "enum": ["pending", "processing", "completed", "failed"],
    "default": "pending",
    "dbEnumName": "job_status_enum"
  }
}
```

### Metadata/Settings

```json
{
  "metadata": {
    "type": "jsonb",
    "nullable": true,
    "default": "'{}'::jsonb"
  }
}
```

### Progress Tracking

```json
{
  "progress_percentage": { "type": "int4", "default": 0 },
  "current_stage": { "type": "varchar", "nullable": true }
}
```

## Generated Files

For each table, the generator creates:

```
infrastructure/
  entities/
    {table}.entity.ts
  enums/
    {table}-enums.enum.ts (if enums exist)
  controllers/
    {table}/
      {table}.controller.ts
      {table}.dto.ts
  repository/
    {table}.repository.ts

domain/
  models/
    {table}.model.ts
  repositories/
    {table}.repository.interface.ts

usecases/
  {table}/
    {table}.usecases.ts

database/
  migrations/
    {timestamp}-create-{tables}-table.ts
```

## Usage

1. Create `schema.json` in project root
2. Run: `clean-nest-generator`
3. Review generated files
4. Run migrations: `npm run migration:run`

## Resources

- [ENUM_VALIDATION.md](./ENUM_VALIDATION.md) - Enum validation rules
- [INDEXES_AND_CONSTRAINTS.md](./INDEXES_AND_CONSTRAINTS.md) - Complete indexes & constraints guide
- [JSONB_DEFAULT_VALUES.md](./JSONB_DEFAULT_VALUES.md) - JSONB default values guide
- [Readme.md](./Readme.md) - Installation and basic usage
