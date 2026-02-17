const schema = require('./schema.json');

const userBadgesTable = schema.tables.find(t => t.name === 'UserBadges');

console.log('Validating UserBadges constraints:');
console.log(JSON.stringify(userBadgesTable.constraints, null, 2));
console.log('\n--- Validation Results ---');

const issues = [];

userBadgesTable.constraints.forEach((c, idx) => {
  console.log(`\nConstraint ${idx + 1}:`);
  console.log('  Type:', c.type);
  console.log('  Name:', c.name);
  console.log('  Expression/Columns:', c.expression || c.columns);

  if (c.type === 'unique' || c.type === 'UNIQUE') {
    if (c.expression && !c.columns) {
      issues.push(`❌ Constraint '${c.name}': UNIQUE constraint should use 'columns' field, not 'expression'`);
      console.log('  ❌ ERROR: Should use "columns" instead of "expression"');
    } else if (!c.columns || !Array.isArray(c.columns) || c.columns.length === 0) {
      issues.push(`❌ Constraint '${c.name}': Missing or invalid 'columns' array`);
      console.log('  ❌ ERROR: Missing "columns" field');
    } else {
      console.log('  ✅ Valid columns array');
    }
  } else if (c.type === 'CHECK') {
    if (!c.expression || typeof c.expression !== 'string') {
      issues.push(`❌ Constraint '${c.name}': CHECK constraint needs string 'expression' field`);
      console.log('  ❌ ERROR: Missing or invalid "expression" field');
    } else {
      console.log('  ✅ Valid expression');
    }
  }
});

if (issues.length > 0) {
  console.log('\n❌ VALIDATION ERRORS:');
  issues.forEach(i => console.log(i));
  console.log('\nExpected format for UNIQUE constraint:');
  console.log(JSON.stringify({
    type: "UNIQUE",
    name: "user_badges_user_id_badge_id_unique",
    columns: ["user_id", "badge_id"]
  }, null, 2));
  process.exit(1);
} else {
  console.log('\n✅ All constraints validated successfully');
}
