/**
 * Test script for B17R2010_query.json
 * Tests all MCP tools with realistic queries
 */

import { MCPCacheServer } from './dist/index.js';

async function testB17R2010() {
  console.log('='.repeat(60));
  console.log('B17R2010 Query Cache - Test Suite');
  console.log('='.repeat(60));
  console.log();

  // Create server instance
  const server = new MCPCacheServer();

  // Override config to use B17R2010_query.json
  process.env.JSON_FILE = 'B17R2010_query.json';
  process.env.WEB_ENABLED = 'false';

  try {
    // Start server (this will load the cache)
    console.log('=æ Starting MCP Cache Server...');
    await server.start();
    console.log(' Server started successfully\n');

    // Wait a moment for initialization
    await new Promise(resolve => setTimeout(resolve, 1000));

    // Get server status
    const status = server.getStatus();
    console.log('=Ê Server Status:');
    console.log(`   Sources loaded: ${status.cache.loadedSources}`);
    console.log(`   Total keys: ${status.cache.totalKeys}`);
    console.log(`   Cache size: ${(status.cache.totalSize / 1024).toFixed(2)} KB`);
    console.log();

    // Test 1: Query for B17R2010.select
    console.log('Test 1: Query for "B17R2010.select"');
    console.log('-'.repeat(60));
    try {
      const cacheManager = server['cacheManager'];
      const result1 = cacheManager.query('B17R2010.select');

      if (result1.found) {
        console.log(' Query successful');
        console.log(`   Source: ${result1.source}`);
        console.log(`   Key: ${result1.key}`);
        console.log(`   Has data: ${result1.value ? 'Yes' : 'No'}`);

        if (result1.value) {
          console.log(`   Query ID: ${result1.value.id || 'N/A'}`);
          console.log(`   Description: ${result1.value.desc || 'N/A'}`);
          console.log(`   File: ${result1.value.file_name || 'N/A'}`);

          // Show first 200 chars of query
          if (result1.value.query) {
            const queryPreview = result1.value.query.substring(0, 200).replace(/\n/g, ' ');
            console.log(`   Query preview: ${queryPreview}...`);
          }
        }
      } else {
        console.log('L Query failed - key not found');
      }
    } catch (error) {
      console.log(`L Query failed: ${error.message}`);
    }
    console.log();

    // Test 2: Query with b17. prefix
    console.log('Test 2: Query for "b17.B17R2010.select.1row"');
    console.log('-'.repeat(60));
    try {
      const cacheManager = server['cacheManager'];
      const result2 = cacheManager.query('b17.B17R2010.select.1row');

      if (result2.found) {
        console.log(' Query successful');
        console.log(`   Source: ${result2.source}`);
        console.log(`   Query ID: ${result2.value.id || 'N/A'}`);
      } else {
        console.log('L Query failed - key not found');
      }
    } catch (error) {
      console.log(`L Query failed: ${error.message}`);
    }
    console.log();

    // Test 3: Query for B47 query
    console.log('Test 3: Query for "b47.B47SA508_1.select"');
    console.log('-'.repeat(60));
    try {
      const cacheManager = server['cacheManager'];
      const result3 = cacheManager.query('b47.B47SA508_1.select');

      if (result3.found) {
        console.log(' Query successful');
        console.log(`   Source: ${result3.source}`);
        console.log(`   Query ID: ${result3.value.id || 'N/A'}`);
        console.log(`   Description: ${result3.value.desc || 'N/A'}`);
      } else {
        console.log('L Query failed - key not found');
      }
    } catch (error) {
      console.log(`L Query failed: ${error.message}`);
    }
    console.log();

    // Test 4: List all keys
    console.log('Test 4: List all available keys');
    console.log('-'.repeat(60));
    try {
      const cacheManager = server['cacheManager'];
      const keys = cacheManager.listKeys();

      console.log(` Found ${keys.length} keys`);
      console.log('   First 10 keys:');
      keys.slice(0, 10).forEach((key, idx) => {
        console.log(`   ${idx + 1}. ${key}`);
      });

      if (keys.length > 10) {
        console.log(`   ... and ${keys.length - 10} more`);
      }
    } catch (error) {
      console.log(`L List keys failed: ${error.message}`);
    }
    console.log();

    // Test 5: List keys with prefix filter
    console.log('Test 5: List keys with "b17.B17R2010" prefix');
    console.log('-'.repeat(60));
    try {
      const cacheManager = server['cacheManager'];
      const filteredKeys = cacheManager.listKeys(undefined, 'b17.B17R2010');

      console.log(` Found ${filteredKeys.length} keys matching prefix`);
      filteredKeys.forEach((key, idx) => {
        console.log(`   ${idx + 1}. ${key}`);
      });
    } catch (error) {
      console.log(`L List filtered keys failed: ${error.message}`);
    }
    console.log();

    // Test 6: List sources
    console.log('Test 6: List all loaded sources');
    console.log('-'.repeat(60));
    try {
      const cacheManager = server['cacheManager'];
      const sources = cacheManager.listSources();

      console.log(` Found ${sources.length} source(s)`);
      sources.forEach((source, idx) => {
        console.log(`   ${idx + 1}. ${source.name}`);
        console.log(`      Path: ${source.path}`);
        console.log(`      Keys: ${source.keys}`);
        console.log(`      Size: ${(source.size / 1024).toFixed(2)} KB`);
        console.log(`      Loaded: ${source.loadedAt.toLocaleString()}`);
      });
    } catch (error) {
      console.log(`L List sources failed: ${error.message}`);
    }
    console.log();

    // Test 7: Global statistics
    console.log('Test 7: Global cache statistics');
    console.log('-'.repeat(60));
    try {
      const cacheManager = server['cacheManager'];
      const stats = cacheManager.getGlobalStats();

      console.log(' Global Statistics:');
      console.log(`   Total sources: ${stats.totalSources}`);
      console.log(`   Loaded sources: ${stats.loadedSources}`);
      console.log(`   Total keys: ${stats.totalKeys}`);
      console.log(`   Total size: ${(stats.totalSize / 1024).toFixed(2)} KB`);
      console.log(`   Total hits: ${stats.totalHits}`);
      console.log(`   Cache hit rate: ${stats.cacheHitRate.toFixed(2)}%`);
      console.log(`   Uptime: ${stats.uptime.toFixed(2)}s`);
    } catch (error) {
      console.log(`L Get statistics failed: ${error.message}`);
    }
    console.log();

    // Test 8: Case-insensitive query
    console.log('Test 8: Case-insensitive query for "b17r2010.select"');
    console.log('-'.repeat(60));
    try {
      const cacheManager = server['cacheManager'];
      const result8 = cacheManager.query('b17r2010.select');

      if (result8.found) {
        console.log(' Case-insensitive query successful');
        console.log(`   Matched key: ${result8.key}`);
        console.log(`   Query ID: ${result8.value.id || 'N/A'}`);
      } else {
        console.log('L Query failed - key not found');
      }
    } catch (error) {
      console.log(`L Query failed: ${error.message}`);
    }
    console.log();

    console.log('='.repeat(60));
    console.log(' All tests completed!');
    console.log('='.repeat(60));

  } catch (error) {
    console.error('L Test suite failed:', error);
    process.exit(1);
  } finally {
    // Shutdown server
    await server.shutdown();
    process.exit(0);
  }
}

// Run tests
testB17R2010().catch(error => {
  console.error('Fatal error:', error);
  process.exit(1);
});
