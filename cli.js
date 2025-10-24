#!/usr/bin/env node

const fs = require('fs');
const path = require('path');
const NestjsResourceGenerator = require('./generator-new');

// Check if schema.json exists in current directory
const schemaPath = path.join(process.cwd(), 'schema.json');

if (!fs.existsSync(schemaPath)) {
  console.error('Error: schema.json not found in current directory');
  console.log('Please create a schema.json file with your resource configuration');
  process.exit(1);
}

try {
  console.log('🚀 Starting NestJS resource generation...');
  const generator = new NestjsResourceGenerator(schemaPath);
  generator.generate().then(() => {
    console.log('✨ Resources generated successfully!');
  }).catch(error => {
    console.error('Error generating resources:', error);
    process.exit(1);
  });
} catch (error) {
  console.error('Failed to initialize generator:', error);
  process.exit(1);
}