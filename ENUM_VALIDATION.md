# Enum Validation Documentation

## Overview

When using enum types in your schema, the generator now enforces validation rules for database-level enums.

## Default Behavior

By default, `useDbEnum` is set to `true` if not explicitly specified. This means:

- Enums will be created as PostgreSQL enum types in the database
- Better type safety at the database level
- More efficient storage

## Validation Rules

### Rule 1: dbEnumName is Required (Default Case)

When `useDbEnum` is `true` (or not specified), you **MUST** provide a `dbEnumName`:

```json
{
  "properties": {
    "status": {
      "type": "enum",
      "enum": ["ACTIVE", "INACTIVE"],
      "nullable": false,
      "dbEnumName": "user_status_enum" // ✓ Required!
    }
  }
}
```

**Error if missing dbEnumName:**

```
❌ Table "Users" -> Property "status":
When enum type is used with useDbEnum=true (or not explicitly set to false),
"dbEnumName" must be provided.
Either provide "dbEnumName" or set "useDbEnum: false" to use varchar column.
```

### Rule 2: dbEnumName is Optional with useDbEnum: false

If you explicitly set `useDbEnum: false`, the enum will be stored as a `varchar` column:

```json
{
  "properties": {
    "status": {
      "type": "enum",
      "enum": ["ACTIVE", "INACTIVE"],
      "nullable": false,
      "useDbEnum": false // ✓ No dbEnumName needed
    }
  }
}
```

## Examples

### ✓ Valid Examples

#### Example 1: Database-level enum (Recommended)

```json
{
  "name": "Notifications",
  "properties": {
    "category": {
      "type": "enum",
      "enum": ["HABIT", "INSIGHT", "SOCIAL"],
      "nullable": false,
      "dbEnumName": "notification_category_enum"
    }
  }
}
```

#### Example 2: TypeScript-only enum (varchar column)

```json
{
  "name": "Notifications",
  "properties": {
    "category": {
      "type": "enum",
      "enum": ["HABIT", "INSIGHT", "SOCIAL"],
      "nullable": false,
      "useDbEnum": false
    }
  }
}
```

#### Example 3: Explicit useDbEnum: true

```json
{
  "name": "Notifications",
  "properties": {
    "category": {
      "type": "enum",
      "enum": ["HABIT", "INSIGHT", "SOCIAL"],
      "nullable": false,
      "useDbEnum": true,
      "dbEnumName": "notification_category_enum"
    }
  }
}
```

### ✗ Invalid Examples

#### Example 1: Missing dbEnumName (when useDbEnum defaults to true)

```json
{
  "name": "Notifications",
  "properties": {
    "category": {
      "type": "enum",
      "enum": ["HABIT", "INSIGHT", "SOCIAL"],
      "nullable": false
      // ❌ Error: dbEnumName is required!
    }
  }
}
```

#### Example 2: Missing dbEnumName with explicit useDbEnum: true

```json
{
  "name": "Notifications",
  "properties": {
    "category": {
      "type": "enum",
      "enum": ["HABIT", "INSIGHT", "SOCIAL"],
      "nullable": false,
      "useDbEnum": true
      // ❌ Error: dbEnumName is required when useDbEnum is true!
    }
  }
}
```

## Migration Impact

When using database-level enums (`useDbEnum: true`), the migration will:

1. **Create the enum type:**

```sql
CREATE TYPE notification_category_enum AS ENUM ('HABIT', 'INSIGHT', 'SOCIAL')
```

2. **Use it in the table:**

```sql
CREATE TABLE notifications (
  id INT PRIMARY KEY,
  category notification_category_enum NOT NULL
)
```

3. **Drop on rollback:**

```sql
DROP TYPE notification_category_enum
```

## When to Use Each Option

### Use Database Enum (useDbEnum: true, default)

✓ Better type safety at database level  
✓ Prevents invalid values in DB  
✓ More efficient storage  
✓ Database-enforced constraints

### Use VARCHAR (useDbEnum: false)

✓ More flexible (easier to add values)  
✓ No database migrations for enum changes  
✓ Works with databases that don't support enums  
✗ Less type safety at DB level  
✗ Application must validate enum values

## Best Practices

1. **Always provide descriptive `dbEnumName`** following the pattern: `{table}_{column}_enum`

   ```json
   "dbEnumName": "users_status_enum"
   "dbEnumName": "orders_payment_status_enum"
   ```

2. **Use snake_case for database enum names** (PostgreSQL convention)

3. **Document enum changes** as they require database migrations

4. **Consider future changes** - if enum values change frequently, consider `useDbEnum: false`

## Troubleshooting

### Error: "dbEnumName must be provided"

**Solution 1:** Add dbEnumName

```json
{
  "type": "enum",
  "enum": ["VALUE1", "VALUE2"],
  "dbEnumName": "table_column_enum" // Add this
}
```

**Solution 2:** Set useDbEnum to false

```json
{
  "type": "enum",
  "enum": ["VALUE1", "VALUE2"],
  "useDbEnum": false // Add this
}
```

## Summary

| Scenario           | useDbEnum        | dbEnumName | Result               |
| ------------------ | ---------------- | ---------- | -------------------- |
| Not specified      | `true` (default) | Required   | PostgreSQL ENUM type |
| `useDbEnum: true`  | `true`           | Required   | PostgreSQL ENUM type |
| `useDbEnum: false` | `false`          | Not needed | VARCHAR column       |
