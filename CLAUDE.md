# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

**mcp-json-cache** is an MCP (Model Context Protocol) server that caches JSON files in memory for fast key-based lookups by Claude. It enables efficient querying of large JSON datasets without repeated file I/O operations.

**Core Purpose**: Cache multiple JSON sources in memory and provide fast key-value lookups through MCP tools, designed specifically for legacy system analysis and repetitive JSON data access patterns.

## Build and Development Commands

```bash
# Development
npm run dev              # Run with ts-node (development mode)
npm run watch            # Watch mode with TypeScript compiler

# Build
npm run build            # Compile TypeScript to dist/

# Run
npm start                # Run compiled JavaScript from dist/
```

## Architecture Overview

### Component Structure

```
┌─────────────────┐
│  Claude Code    │ (MCP client via stdio)
└────────┬────────┘
         │ MCP Protocol
┌────────▼────────┐
│  MCP Server     │ (src/index.ts - stdio transport)
│  (stdio)        │
└────────┬────────┘
         │
┌────────▼──────────┐
│  CacheManager     │ (Manages multiple JsonCache instances)
│                   │
└────────┬──────────┘
         │
    ┌────┴─────┬─────────┬─────────┐
    │          │         │         │
┌───▼───┐  ┌───▼──┐  ┌───▼──┐  ┌──▼──┐
│Cache1 │  │Cache2│  │Cache3│  │...  │ (Individual JSON source caches)
└───────┘  └──────┘  └──────┘  └─────┘
```

### Key Architectural Concepts

**Multi-Source Design**: The server manages multiple JSON files simultaneously, each identified by a source name. This allows organizing different JSON datasets (queries, procedures, codes, etc.) while querying across them.

**CacheManager Pattern**: Central manager coordinates multiple `JsonCache` instances. Each cache handles one JSON file. The manager implements:
- Source routing (direct to named source or search all)
- Primary source prioritization for unspecified source queries
- Individual source reload without affecting others
- Aggregated statistics across all caches

**Nested Key Access**: Supports dot notation for nested objects (`user.profile.name`). This is implemented at the `JsonCache` level using recursive key resolution.

**stdio Transport**: Uses MCP's stdio transport, meaning:
- All tool responses go to stdout (JSON-formatted)
- Logging must use stderr to avoid corrupting MCP protocol
- Server runs as a child process managed by Claude Code

## Configuration

### Environment Variables (Priority Order)

1. `JSON_SOURCES` - Multiple sources with names: `name1:path1;name2:path2`
2. `JSON_FILES` - Multiple paths (auto-named): `path1;path2;path3`
3. `JSON_FILE` - Single file (backward compatibility)
4. `config/default.json` - Configuration file fallback

### Configuration Schema

```json
{
  "sources": {
    "source_name": {
      "path": "./path/to/file.json",
      "watch": true,        // Auto-reload on file change
      "primary": true       // Search first when source unspecified
    }
  },
  "options": {
    "autoReload": true,
    "cacheSize": 1000,
    "logLevel": "info"
  }
}
```

## MCP Tools

### query_json
Query cached JSON data by key with optional source specification.

**Parameters**:
- `key` (required): Key to lookup, supports dot notation for nested access
- `source` (optional): Specific JSON source name. If omitted, searches all sources (primary first)

**Behavior**:
- Specified source: Direct lookup in that source only
- Unspecified source: Searches all sources, returns first match (primary source has priority)
- Returns formatted JSON value or error with available sources

### list_json_keys
List available keys from cached JSON sources.

**Parameters**:
- `source` (optional): Filter to specific source
- `prefix` (optional): Filter keys by prefix

**Returns**: Sorted array of keys (limited to 500 for performance)

### list_sources
Display all loaded JSON sources with statistics.

**Returns**: Array of source metadata (name, path, key count, size, load time, hit count)

## Implementation Phases (from tasks.md)

**Phase 1 (P0)**: Core functionality
- Project setup, TypeScript configuration
- JsonCache and CacheManager classes
- Basic MCP tools (query, list-keys, list-sources)

**Phase 2 (P1)**: Enhanced features
- File change detection and auto-reload
- Structured logging system (stderr only)
- Web management UI (optional, port 6315)

**Phase 3 (P2)**: Advanced
- JSONPath query support
- Performance monitoring and statistics

## Development Notes

### stdio and Logging
Since this is an MCP server using stdio transport:
- **Never write non-protocol data to stdout** - it will break the MCP client
- **All logging must go to stderr** - use the Logger utility in `src/utils/logger.ts`
- The web UI (if implemented) runs on a separate HTTP server

### Error Handling
- Invalid JSON files should be logged but not crash the server
- Other sources must remain operational if one fails to load
- Failed reloads should preserve existing cache data

### Testing with Real Data
The primary use case is legacy system analysis with files like:
- `complete_query_index.json` - Database queries indexed by ID
- `aps_procedure.json` - Stored procedures
- Similar large JSON dictionaries

Test with actual data files to ensure performance (<10ms query response time).

## Integration with Claude Code

Add to `.claude/settings.local.json`:

```json
{
  "mcpServers": {
    "json-cache": {
      "command": "node",
      "args": ["C:/project/mcp-json-cache/dist/index.js"],
      "env": {
        "JSON_SOURCES": "queries:C:/path/to/queries.json;procedures:C:/path/to/procedures.json"
      }
    }
  }
}
```

After configuration:
1. Rebuild: `npm run build`
2. Restart Claude Code
3. Verify: Use `list_sources` tool to confirm connection
