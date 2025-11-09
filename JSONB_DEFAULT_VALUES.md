# JSONB/JSON Default Values

The generator now properly supports default values for `jsonb` and `json` column types in PostgreSQL.

## Overview

When you specify default values for JSONB or JSON columns in your schema, the generator will:

- Create proper TypeORM entity decorators with raw SQL expressions
- Generate migrations with correct PostgreSQL syntax
- Handle escaped quotes in JSON objects automatically

## Syntax

Use PostgreSQL's casting syntax for default values:

```json
{
  "properties": {
    "scores": {
      "type": "jsonb",
      "required": true,
      "default": "'{}'::jsonb"
    },
    "metadata": {
      "type": "jsonb",
      "required": false,
      "default": "'[]'::jsonb"
    },
    "settings": {
      "type": "json",
      "required": false,
      "default": "'{\"theme\":\"dark\"}'::json"
    }
  }
}
```

## Generated Code

### Entity Output

```typescript
import { Entity, Column, PrimaryGeneratedColumn } from 'typeorm';

@Entity('your_table')
export class YourTable {
  @Column({ type: 'jsonb', default: () => "'{}'::jsonb" })
  scores: Record<string, any>;

  @Column({ type: 'jsonb', nullable: true, default: () => "'[]'::jsonb" })
  metadata: Record<string, any>;

  @Column({
    type: 'json',
    nullable: true,
    default: () => '\'{"theme":"dark"}\'::json'
  })
  settings: Record<string, any>;
}
```

### Migration Output

```typescript
import { MigrationInterface, QueryRunner, Table } from 'typeorm';

export class CreateYourTable1234567890 implements MigrationInterface {
  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.createTable(
      new Table({
        name: 'your_table',
        columns: [
          {
            name: 'scores',
            type: 'jsonb',
            default: `'{}'::jsonb`
          },
          {
            name: 'metadata',
            type: 'jsonb',
            isNullable: true,
            default: `'[]'::jsonb`
          },
          {
            name: 'settings',
            type: 'json',
            isNullable: true,
            default: `'{"theme":"dark"}'::json`
          }
        ]
      }),
      true
    );
  }
}
```

## Common Default Values

### Empty Object

```json
{
  "type": "jsonb",
  "default": "'{}'::jsonb"
}
```

**Result in DB:**

```sql
ALTER TABLE table_name ADD COLUMN data jsonb DEFAULT '{}'::jsonb;
```

### Empty Array

```json
{
  "type": "jsonb",
  "default": "'[]'::jsonb"
}
```

**Result in DB:**

```sql
ALTER TABLE table_name ADD COLUMN items jsonb DEFAULT '[]'::jsonb;
```

### Object with String Values

```json
{
  "type": "json",
  "default": "'{\"status\":\"pending\",\"priority\":\"low\"}'::json"
}
```

**Result in DB:**

```sql
ALTER TABLE table_name ADD COLUMN config json DEFAULT '{"status":"pending","priority":"low"}'::json;
```

### Object with Mixed Types

```json
{
  "type": "jsonb",
  "default": "'{\"count\":0,\"enabled\":true,\"tags\":[]}'::jsonb"
}
```

**Result in DB:**

```sql
ALTER TABLE table_name ADD COLUMN settings jsonb DEFAULT '{"count":0,"enabled":true,"tags":[]}'::jsonb;
```

### Array with Values

```json
{
  "type": "jsonb",
  "default": "'[\"admin\",\"user\"]'::jsonb"
}
```

**Result in DB:**

```sql
ALTER TABLE table_name ADD COLUMN roles jsonb DEFAULT '["admin","user"]'::jsonb;
```

### Nested Objects

```json
{
  "type": "jsonb",
  "default": "'{\"user\":{\"name\":\"guest\",\"active\":false},\"preferences\":{\"theme\":\"light\"}}'::jsonb"
}
```

**Result in DB:**

```sql
ALTER TABLE table_name ADD COLUMN data jsonb DEFAULT '{"user":{"name":"guest","active":false},"preferences":{"theme":"light"}}'::jsonb;
```

## Important Rules

### 1. Escape Double Quotes

Inside your JSON values, escape double quotes with backslashes:

```json
"default": "'{\"key\":\"value\"}'::jsonb"
             ↑↑    ↑↑     ↑↑ ← Escaped quotes
```

### 2. Use PostgreSQL Casting Syntax

Always include the type cast at the end:

```json
"default": "'<json_value>'::<type>"
                         ↑↑↑↑↑↑↑ ← ::jsonb or ::json
```

### 3. Single Quotes Wrap the JSON

The entire JSON string must be wrapped in single quotes:

```json
"default": "'{ ... }'::jsonb"
           ↑       ↑ ← Single quotes
```

### 4. Match Column Type

The cast must match your column type:

- If `"type": "jsonb"` → use `::jsonb`
- If `"type": "json"` → use `::json`

## Examples from Real Schema

### Example 1: Empty Object (Your Current Case)

```json
{
  "name": "TafsirInsights",
  "properties": {
    "scores": {
      "type": "jsonb",
      "required": true,
      "default": "'{}'::jsonb"
    }
  }
}
```

**Generated Entity:**

```typescript
@Column({ type: 'jsonb', default: () => "'{}'::jsonb" })
scores: Record<string, any>;
```

**Generated Migration:**

```typescript
{
  name: 'scores',
  type: 'jsonb',
  default: `'{}'::jsonb`,
}
```

**SQL Result:**

```sql
CREATE TABLE tafsir_insights (
  id INT PRIMARY KEY,
  scores JSONB NOT NULL DEFAULT '{}'::jsonb
);
```

### Example 2: Configuration Object

```json
{
  "name": "UserSettings",
  "properties": {
    "preferences": {
      "type": "jsonb",
      "required": false,
      "default": "'{\"notifications\":true,\"language\":\"en\",\"theme\":\"system\"}'::jsonb"
    }
  }
}
```

**Generated Entity:**

```typescript
@Column({
  type: 'jsonb',
  nullable: true,
  default: () => '\'{"notifications":true,"language":"en","theme":"system"}\'::jsonb'
})
preferences: Record<string, any>;
```

### Example 3: Empty Array for Collections

```json
{
  "name": "Posts",
  "properties": {
    "tags": {
      "type": "jsonb",
      "required": true,
      "default": "'[]'::jsonb"
    }
  }
}
```

**Generated Entity:**

```typescript
@Column({ type: 'jsonb', default: () => "'[]'::jsonb" })
tags: Record<string, any>;
```

## TypeORM Behavior

### The `default: () => "..."` Syntax

TypeORM uses a function wrapper for raw SQL expressions:

```typescript
default: () => "'{}'::jsonb"
         ↑↑ ← Arrow function tells TypeORM to use raw SQL
```

This ensures:

- ✓ The default value is set at the **database level**
- ✓ Migrations include the proper SQL syntax
- ✓ New rows automatically get the default value
- ✓ The database enforces the constraint

### Without the Arrow Function

If you wrote `default: "'{}'::jsonb"` (without `() =>`), TypeORM would treat it as a string literal, not SQL, causing errors.

## Comparison: JSONB vs JSON

| Feature     | JSONB                | JSON             |
| ----------- | -------------------- | ---------------- |
| Storage     | Binary, indexed      | Text             |
| Performance | Faster queries       | Slower queries   |
| Size        | Slightly larger      | Slightly smaller |
| Indexing    | Supports GIN indexes | No indexing      |
| Recommended | ✓ For querying       | For storage only |

**Recommendation:** Use `jsonb` for better performance and querying capabilities.

## Troubleshooting

### Error: "Invalid default value"

**Problem:** Forgot to escape quotes

```json
❌ "default": "'{"key":"value"}'::jsonb"
```

**Solution:** Escape inner quotes

```json
✓ "default": "'{\"key\":\"value\"}'::jsonb"
```

### Error: "Syntax error near ':'"

**Problem:** Missing single quotes around JSON

```json
❌ "default": "{}::jsonb"
```

**Solution:** Wrap JSON in single quotes

```json
✓ "default": "'{}'::jsonb"
```

### Error: "Cannot cast type text to jsonb"

**Problem:** Missing type cast

```json
❌ "default": "'{}'"
```

**Solution:** Add `::jsonb` or `::json`

```json
✓ "default": "'{}'::jsonb"
```

## Best Practices

1. **Use JSONB over JSON** unless you have specific reasons not to
2. **Keep default values simple** - complex defaults can be hard to maintain
3. **Document your JSON structure** in comments or README
4. **Consider empty object `{}` or array `[]`** as sensible defaults
5. **Validate JSON structure in application code** since database won't validate structure

## Testing Your Defaults

After generating and running migrations, you can test in PostgreSQL:

```sql
-- Insert a row without specifying the jsonb column
INSERT INTO your_table (id) VALUES (1);

-- Check that the default was applied
SELECT scores FROM your_table WHERE id = 1;
-- Result: {}

-- Verify the column definition
SELECT column_name, column_default
FROM information_schema.columns
WHERE table_name = 'your_table' AND column_name = 'scores';
-- Result: scores | '{}'::jsonb
```

## Summary

✓ The generator now **fully supports** JSONB/JSON default values  
✓ Use PostgreSQL casting syntax: `'<json>'::<type>`  
✓ Entity uses `default: () => "..."` for raw SQL  
✓ Migration includes proper PostgreSQL syntax  
✓ Escape quotes inside JSON with backslashes  
✓ Prefer `jsonb` over `json` for better performance
