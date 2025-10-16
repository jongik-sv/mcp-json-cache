/**
 * Debug test for key resolution with dots in key names
 */

import { readFileSync } from 'fs';
import { JsonCache } from './dist/cache/JsonCache.js';

console.log('='.repeat(60));
console.log('Debug: Key Resolution Test');
console.log('='.repeat(60));
console.log();

// Read the actual JSON structure
const jsonData = JSON.parse(readFileSync('B17R2010_query.json', 'utf-8'));

console.log('1. JSON Structure Analysis:');
console.log('-'.repeat(60));
console.log('Top-level keys:', Object.keys(jsonData));
console.log();

if (jsonData.b17) {
  console.log('b17 namespace keys (first 5):');
  const b17Keys = Object.keys(jsonData.b17);
  b17Keys.slice(0, 5).forEach((key, idx) => {
    console.log(`   ${idx + 1}. "${key}"`);
  });
  console.log(`   ... total ${b17Keys.length} keys in b17 namespace`);
  console.log();

  // Check if B17R2010.select exists
  const targetKey = 'B17R2010.select';
  if (jsonData.b17[targetKey]) {
    console.log(`✅ Found "${targetKey}" in b17 namespace`);
    console.log('   Value type:', typeof jsonData.b17[targetKey]);
    console.log('   Value keys:', Object.keys(jsonData.b17[targetKey]));
    console.log('   Sample data:', JSON.stringify(jsonData.b17[targetKey], null, 2).substring(0, 300));
  } else {
    console.log(`❌ "${targetKey}" not found in b17 namespace`);
  }
}
console.log();

// Test with JsonCache
console.log('2. JsonCache Test:');
console.log('-'.repeat(60));

const cache = new JsonCache('test', 'B17R2010_query.json');
await cache.load();

const allKeys = cache.keys();
console.log(`Total keys extracted: ${allKeys.length}`);
console.log();

// Find keys matching B17R2010.select
console.log('Keys matching "B17R2010.select":');
const matchingKeys = allKeys.filter(k => k.includes('B17R2010.select'));
matchingKeys.slice(0, 10).forEach((key, idx) => {
  console.log(`   ${idx + 1}. "${key}"`);
});
console.log();

// Test direct access patterns
console.log('3. Direct Access Tests:');
console.log('-'.repeat(60));

const testCases = [
  'B17R2010.select',
  'b17.B17R2010.select',
  'b17r2010.select',
  'B17R2010.SELECT',
  'b47.B47SA508_1.select'
];

for (const testKey of testCases) {
  console.log(`Testing key: "${testKey}"`);
  const result = cache.get(testKey);

  if (result) {
    console.log(`   ✅ Found! Type: ${typeof result}`);
    if (typeof result === 'object') {
      console.log(`   Object keys: ${Object.keys(result).join(', ')}`);
      if (result.id) console.log(`   ID: ${result.id}`);
    }
  } else {
    console.log(`   ❌ Not found`);
  }
  console.log();
}

console.log('4. Manual Resolution Test:');
console.log('-'.repeat(60));

// Manually test the exact path
console.log('Direct access: jsonData.b17["B17R2010.select"]');
const directValue = jsonData.b17['B17R2010.select'];
if (directValue) {
  console.log('✅ Direct access works!');
  console.log('   Type:', typeof directValue);
  console.log('   Keys:', Object.keys(directValue));
  console.log('   ID:', directValue.id);
} else {
  console.log('❌ Direct access failed');
}

console.log();
console.log('='.repeat(60));
