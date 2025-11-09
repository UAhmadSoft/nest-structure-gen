# Indexes and Constraints Support

The generator fully supports PostgreSQL indexes and constraints including CHECK constraints, UNIQUE constraints, and configurable foreign key options.

## Overview

- ✅ **Indexes** - Single and composite indexes with unique option
- ✅ **CHECK Constraints** - Custom validation rules at database level
- ✅ **UNIQUE Constraints** - Composite unique constraints
- ✅ **Foreign Key Options** - Configurable CASCADE, RESTRICT, SET NULL, etc.

## Indexes

### Schema Syntax

```json
{
  "indexes": [
    {
      "columns": ["column1", "column2"],
      "unique": false,
      "name": "idx_table_columns"
    }
  ]
}
```

### Properties

| Property  | Type    | Required | Description                                        |
| --------- | ------- | -------- | -------------------------------------------------- |
| `columns` | array   | Yes      | Array of column names to index                     |
| `unique`  | boolean | No       | Whether index should be unique (default: false)    |
| `name`    | string  | No       | Custom index name (auto-generated if not provided) |

### Examples

#### Single Column Index

```json
{
  "indexes": [
    {
      "columns": ["email"],
      "unique": true,
      "name": "idx_users_email_unique"
    }
  ]
}
```

#### Composite Index

```json
{
  "indexes": [
    {
      "columns": ["user_id", "created_on"],
      "unique": false,
      "name": "idx_posts_user_created"
    }
  ]
}
```

#### Auto-named Index

```json
{
  "indexes": [
    {
      "columns": ["status", "priority"]
    }
  ]
}
// Generated name: idx_tablename_status_priority
```

### Generated Code

**Entity:**

```typescript
@Index('idx_users_email_unique', ['email'], { unique: true })
@Entity('users')
export class Users {
  // ...
}
```

**Migration:**

```typescript
await queryRunner.createIndex(
  'users',
  new TableIndex({
    name: 'idx_users_email_unique',
    columnNames: ['email'],
    isUnique: true
  })
);
```

## CHECK Constraints

CHECK constraints enforce custom validation rules at the database level.

### Schema Syntax

```json
{
  "constraints": [
    {
      "type": "CHECK",
      "name": "constraint_name",
      "expression": "column_name >= 0"
    }
  ]
}
```

### Properties

| Property     | Type   | Required | Description                                      |
| ------------ | ------ | -------- | ------------------------------------------------ |
| `type`       | string | Yes      | Must be "CHECK"                                  |
| `name`       | string | No       | Constraint name (auto-generated if not provided) |
| `expression` | string | Yes      | SQL boolean expression                           |

### Examples

#### Range Check

```json
{
  "constraints": [
    {
      "type": "CHECK",
      "name": "users_age_range",
      "expression": "age >= 0 AND age <= 150"
    }
  ]
}
```

#### NULL Check with Condition

```json
{
  "constraints": [
    {
      "type": "CHECK",
      "name": "insights_confidence_range",
      "expression": "confidence IS NULL OR (confidence >= 0 AND confidence <= 1)"
    }
  ]
}
```

#### Minimum Value

```json
{
  "constraints": [
    {
      "type": "CHECK",
      "name": "products_price_positive",
      "expression": "price > 0"
    }
  ]
}
```

#### Complex Logic

```json
{
  "constraints": [
    {
      "type": "CHECK",
      "name": "orders_status_logic",
      "expression": "(status = 'pending' AND paid_at IS NULL) OR (status = 'completed' AND paid_at IS NOT NULL)"
    }
  ]
}
```

### Generated Migration

```typescript
// Create check constraints
await queryRunner.query(`
  ALTER TABLE users
  ADD CONSTRAINT users_age_range
  CHECK (age >= 0 AND age <= 150)
`);
```

**Note:** TypeORM entities don't have decorators for CHECK constraints. They are only created in migrations, which is the recommended approach.

## UNIQUE Constraints

Composite unique constraints ensure uniqueness across multiple columns.

### Schema Syntax

```json
{
  "constraints": [
    {
      "type": "UNIQUE",
      "name": "constraint_name",
      "columns": ["column1", "column2"]
    }
  ]
}
```

### Properties

| Property  | Type   | Required | Description                                      |
| --------- | ------ | -------- | ------------------------------------------------ |
| `type`    | string | Yes      | Must be "UNIQUE"                                 |
| `name`    | string | No       | Constraint name (auto-generated if not provided) |
| `columns` | array  | Yes      | Array of column names                            |

### Examples

#### Composite Unique

```json
{
  "constraints": [
    {
      "type": "UNIQUE",
      "name": "users_email_phone_unique",
      "columns": ["email", "phone"]
    }
  ]
}
```

#### Unique Per Parent

```json
{
  "constraints": [
    {
      "type": "UNIQUE",
      "name": "insights_unique_per_ayah",
      "columns": ["ayah_tafsir_id", "insight_number"]
    }
  ]
}
```

### Generated Migration

```typescript
// Create unique constraints
await queryRunner.query(`
  ALTER TABLE tafsir_insights
  ADD CONSTRAINT insights_unique_per_ayah
  UNIQUE (ayah_tafsir_id, insight_number)
`);
```

### UNIQUE Constraint vs UNIQUE Index

| Feature                 | UNIQUE Constraint   | UNIQUE Index                        |
| ----------------------- | ------------------- | ----------------------------------- |
| Enforces uniqueness     | ✓                   | ✓                                   |
| Can be referenced by FK | ✓                   | ✗                                   |
| Part of table schema    | ✓                   | ✗                                   |
| Composite columns       | ✓                   | ✓                                   |
| Use in schema           | `constraints` array | `indexes` array with `unique: true` |

**Recommendation:** Use UNIQUE constraints for business logic uniqueness, use UNIQUE indexes for performance optimization.

## Foreign Key Options

Configure CASCADE behavior for foreign key relationships.

### Schema Syntax

```json
{
  "relations": {
    "user_id": {
      "type": "ManyToOne",
      "entity": "User",
      "required": true,
      "onDelete": "CASCADE",
      "onUpdate": "CASCADE"
    }
  }
}
```

### Properties

| Property   | Type   | Default | Options                                             |
| ---------- | ------ | ------- | --------------------------------------------------- |
| `onDelete` | string | CASCADE | CASCADE, RESTRICT, SET NULL, NO ACTION, SET DEFAULT |
| `onUpdate` | string | CASCADE | CASCADE, RESTRICT, SET NULL, NO ACTION, SET DEFAULT |

### Examples

#### Cascade Delete (Default)

```json
{
  "user_id": {
    "type": "ManyToOne",
    "entity": "User",
    "onDelete": "CASCADE"
  }
}
// Deleting user deletes all related records
```

#### Restrict Delete

```json
{
  "user_id": {
    "type": "ManyToOne",
    "entity": "User",
    "onDelete": "RESTRICT"
  }
}
// Cannot delete user if related records exist
```

#### Set NULL on Delete

```json
{
  "user_id": {
    "type": "ManyToOne",
    "entity": "User",
    "required": false,
    "onDelete": "SET NULL"
  }
}
// Sets user_id to NULL when user is deleted
```

### Generated Migration

```typescript
await queryRunner.createForeignKey(
  'posts',
  new TableForeignKey({
    columnNames: ['user_id'],
    referencedTableName: 'users',
    referencedColumnNames: ['id'],
    onDelete: 'CASCADE',
    onUpdate: 'CASCADE'
  })
);
```

## Complete Example: Translating Your SQL

### Your SQL

```sql
CREATE TABLE public.tafsir_insights (
  id               BIGSERIAL PRIMARY KEY,
  ayah_tafsir_id   BIGINT NOT NULL
                   REFERENCES public.ayah_tafsirs(id)
                   ON UPDATE CASCADE
                   ON DELETE CASCADE,
  insight_number   INTEGER,
  insight_text     TEXT NOT NULL,
  category         TEXT,
  confidence       DOUBLE PRECISION,
  scores           JSONB NOT NULL DEFAULT '{}'::jsonb,
  created_at       TIMESTAMPTZ NOT NULL DEFAULT NOW(),

  -- Guardrails
  CONSTRAINT tafsir_insights_insight_number_min CHECK (insight_number IS NULL OR insight_number >= 1),
  CONSTRAINT tafsir_insights_confidence_range CHECK (confidence IS NULL OR (confidence >= 0 AND confidence <= 1)),
  CONSTRAINT tafsir_insights_unique_per_ayah UNIQUE (ayah_tafsir_id, insight_number)
);

CREATE INDEX idx_tafsir_insights_ayah_tafsir_id
  ON public.tafsir_insights (ayah_tafsir_id);
```

### Generator Schema

```json
{
  "root": "D:/projects/authar-quran-api",
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
      "name": "TafsirInsight",
      "create_pagination_route": true,
      "create_relation_get_route": false,
      "properties": {
        "insight_number": {
          "type": "int",
          "required": false
        },
        "insight_text": {
          "type": "text",
          "required": true
        },
        "category": {
          "type": "text",
          "required": false
        },
        "confidence": {
          "type": "double precision",
          "required": false
        },
        "scores": {
          "type": "jsonb",
          "required": true,
          "default": "'{}'::jsonb"
        }
      },
      "relations": {
        "ayah_tafsir_id": {
          "type": "ManyToOne",
          "entity": "AyahTafsir",
          "required": true,
          "onDelete": "CASCADE",
          "onUpdate": "CASCADE"
        }
      },
      "constraints": [
        {
          "type": "CHECK",
          "name": "tafsir_insights_insight_number_min",
          "expression": "insight_number IS NULL OR insight_number >= 1"
        },
        {
          "type": "CHECK",
          "name": "tafsir_insights_confidence_range",
          "expression": "confidence IS NULL OR (confidence >= 0 AND confidence <= 1)"
        },
        {
          "type": "UNIQUE",
          "name": "tafsir_insights_unique_per_ayah",
          "columns": ["ayah_tafsir_id", "insight_number"]
        }
      ],
      "indexes": [
        {
          "columns": ["ayah_tafsir_id"],
          "unique": false,
          "name": "idx_tafsir_insights_ayah_tafsir_id"
        }
      ]
    }
  ]
}
```

### Generated Migration

```typescript
import { MigrationInterface, QueryRunner, Table, TableForeignKey, TableIndex } from 'typeorm';

export class createTafsirInsightsTable1762710845766 implements MigrationInterface {
  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.createTable(
      new Table({
        name: 'tafsir_insights',
        columns: [
          {
            name: 'id',
            type: 'int4',
            isPrimary: true,
            isGenerated: true,
            generationStrategy: 'increment'
          },
          {
            name: 'insight_number',
            type: 'int',
            isNullable: true
          },
          {
            name: 'insight_text',
            type: 'text'
          },
          {
            name: 'category',
            type: 'text',
            isNullable: true
          },
          {
            name: 'confidence',
            type: 'double precision',
            isNullable: true
          },
          {
            name: 'scores',
            type: 'jsonb',
            default: `'{}'::jsonb`
          },
          {
            name: 'ayah_tafsir_id',
            type: 'int4'
          },
          {
            name: 'created_on',
            type: 'timestamp',
            default: 'now()'
          },
          {
            name: 'updated_on',
            type: 'timestamp',
            default: 'now()'
          }
        ]
      }),
      true
    );

    // Foreign key with CASCADE
    await queryRunner.createForeignKey(
      'tafsir_insights',
      new TableForeignKey({
        columnNames: ['ayah_tafsir_id'],
        referencedTableName: 'ayah_tafsirs',
        referencedColumnNames: ['id'],
        onDelete: 'CASCADE',
        onUpdate: 'CASCADE'
      })
    );

    // Unique constraint
    await queryRunner.query(`
      ALTER TABLE tafsir_insights
      ADD CONSTRAINT tafsir_insights_unique_per_ayah
      UNIQUE (ayah_tafsir_id, insight_number)
    `);

    // Check constraints
    await queryRunner.query(`
      ALTER TABLE tafsir_insights
      ADD CONSTRAINT tafsir_insights_insight_number_min
      CHECK (insight_number IS NULL OR insight_number >= 1)
    `);

    await queryRunner.query(`
      ALTER TABLE tafsir_insights
      ADD CONSTRAINT tafsir_insights_confidence_range
      CHECK (confidence IS NULL OR (confidence >= 0 AND confidence <= 1))
    `);

    // Regular index
    await queryRunner.createIndex(
      'tafsir_insights',
      new TableIndex({
        name: 'idx_tafsir_insights_ayah_tafsir_id',
        columnNames: ['ayah_tafsir_id']
      })
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.dropIndex('tafsir_insights', 'idx_tafsir_insights_ayah_tafsir_id');

    await queryRunner.query(
      `ALTER TABLE tafsir_insights DROP CONSTRAINT tafsir_insights_insight_number_min`
    );

    await queryRunner.query(
      `ALTER TABLE tafsir_insights DROP CONSTRAINT tafsir_insights_confidence_range`
    );

    await queryRunner.query(
      `ALTER TABLE tafsir_insights DROP CONSTRAINT tafsir_insights_unique_per_ayah`
    );

    await queryRunner.dropTable('tafsir_insights');
  }
}
```

## Common Constraint Patterns

### Age Validation

```json
{
  "type": "CHECK",
  "name": "users_age_valid",
  "expression": "age >= 18 AND age <= 120"
}
```

### Percentage Range

```json
{
  "type": "CHECK",
  "name": "scores_percentage_range",
  "expression": "score >= 0 AND score <= 100"
}
```

### Positive Values

```json
{
  "type": "CHECK",
  "name": "products_price_positive",
  "expression": "price > 0"
}
```

### Status Dependent Fields

```json
{
  "type": "CHECK",
  "name": "orders_completed_date_required",
  "expression": "(status != 'completed') OR (status = 'completed' AND completed_at IS NOT NULL)"
}
```

### Mutual Exclusivity

```json
{
  "type": "CHECK",
  "name": "payment_method_exclusive",
  "expression": "(card_id IS NOT NULL AND bank_id IS NULL) OR (card_id IS NULL AND bank_id IS NOT NULL)"
}
```

### Email Format (Basic)

```json
{
  "type": "CHECK",
  "name": "users_email_format",
  "expression": "email ~* '^[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\\.[A-Za-z]{2,}$'"
}
```

## Best Practices

### Indexes

1. **Index foreign keys** - Always create indexes on foreign key columns
2. **Composite indexes order** - Put most selective columns first
3. **Avoid over-indexing** - Too many indexes slow down INSERT/UPDATE
4. **Use UNIQUE indexes** for uniqueness with performance benefits
5. **Name indexes clearly** - Use pattern: `idx_tablename_columns`

### CHECK Constraints

1. **Keep expressions simple** - Complex logic belongs in application
2. **Allow NULL gracefully** - Use `IS NULL OR condition` when applicable
3. **Name constraints descriptively** - Pattern: `tablename_column_description`
4. **Document business rules** - Add comments explaining the constraint
5. **Test edge cases** - Verify NULL, boundary values, and valid ranges

### UNIQUE Constraints

1. **Use for business logic** - Enforce uniqueness rules at DB level
2. **Composite keys** - Order columns by cardinality (high to low)
3. **Consider partial indexes** - For conditional uniqueness
4. **Name clearly** - Pattern: `tablename_columns_unique`

### Foreign Keys

1. **Choose CASCADE wisely** - CASCADE deletes can be dangerous
2. **RESTRICT for safety** - Prevents accidental data loss
3. **SET NULL when optional** - Allows parent deletion without losing child
4. **Document behavior** - Comment on cascade effects
5. **Match application logic** - FK rules should match business rules

## Summary

✅ **Full support** for PostgreSQL indexes and constraints  
✅ **CHECK constraints** for database-level validation  
✅ **UNIQUE constraints** for composite uniqueness  
✅ **Configurable foreign keys** with CASCADE options  
✅ **Migration rollback** support for all constraints  
✅ **Clean separation** - Constraints in migrations, decorators in entities
