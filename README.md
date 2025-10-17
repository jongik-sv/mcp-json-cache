# MCP JSON Cache Server

A high-performance MCP (Model Context Protocol) server that caches JSON files in memory for fast key-based lookups. Designed specifically for legacy system analysis and repetitive JSON data access patterns.

## Features

- ⚡ **Fast In-Memory Caching**: Millisecond response times for key lookups
- 🔑 **Nested Key Access**: Support for dot notation (`user.profile.name`)
- 📁 **Multi-Source Support**: Cache multiple JSON files simultaneously
- 🔄 **Auto-Reload**: Automatic cache refresh on file changes
- 🌐 **Web Management UI**: Built-in dashboard for monitoring and management
- 🛡️ **Error Tolerance**: Failed sources don't affect other cached data
- 📊 **Statistics**: Performance metrics and cache hit tracking

## Quick Start

### 1. Installation

```bash
git clone <repository-url>
cd mcp-json-cache
npm install
```

### 2. Build

```bash
npm run build
```

### 3. Basic Usage

```bash
# Create a test JSON file
echo {"test": "value", "foo": "bar"} > test.json

# Set environment variable and run
set JSON_FILE=test.json
npm start
```

### 4. Web UI Access

Open your browser and navigate to:
```
http://localhost:6315
```

## Installation & Setup

### Prerequisites

- Node.js 16+
- npm or yarn

### Development Setup

```bash
# Clone repository
git clone <repository-url>
cd mcp-json-cache

# Install dependencies
npm install

# Development mode (with TypeScript)
npm run dev

# Watch mode (auto-recompile on changes)
npm run watch
```

### Production Build

```bash
# Compile TypeScript to JavaScript
npm run build

# Run the compiled version
npm start
```

## Configuration

### Environment Variables

Configure using environment variables (in priority order):

#### Single JSON File
```bash
set JSON_FILE=./path/to/your/file.json
```

#### Multiple JSON Files (auto-named)
```bash
set JSON_FILES=./queries.json;./procedures.json;./codes.json
```

#### Multiple Named Sources (recommended)
```bash
set JSON_SOURCES=queries:C:/data/queries.json;procedures:C:/data/procedures.json;codes:C:/data/codes.json
```

#### Web Server Options
```bash
# Disable web server
set WEB_ENABLED=false

# Change port (default: 6315, auto-tries next port if busy)
set WEB_PORT=3000

# Change host (default: localhost)
set WEB_HOST=0.0.0.0

# Log level (debug, info, warn, error)
set LOG_LEVEL=info
```

### Configuration File

Create `config/default.json` for persistent configuration:

```json
{
  "sources": {
    "queries": {
      "path": "./data/queries.json",
      "watch": true,
      "primary": true
    },
    "procedures": {
      "path": "./data/procedures.json",
      "watch": true,
      "primary": false
    }
  },
  "options": {
    "autoReload": true,
    "cacheSize": 1000,
    "logLevel": "info"
  },
  "web": {
    "enabled": true,
    "port": 6315,
    "host": "localhost"
  }
}
```

## Usage Examples

### Example 1: Legacy Database Analysis

```bash
# Setup for legacy system analysis
set JSON_SOURCES=queries:C:/legacy/complete_query_index.json;procedures:C:/legacy/aps_procedure.json;codes:C:/legacy/error_codes.json
npm start
```

### Example 2: Multiple Environment Configuration

```json
{
  "sources": {
    "dev_queries": {
      "path": "./data/dev/queries.json",
      "watch": true,
      "primary": true
    },
    "prod_queries": {
      "path": "./data/prod/queries.json",
      "watch": false,
      "primary": false
    },
    "error_codes": {
      "path": "./data/error_codes.json",
      "watch": true
    }
  }
}
```

### Example 3: Development Setup

```bash
# For development with hot reload
set JSON_SOURCES=test_data:./test-data/sample.json
set LOG_LEVEL=debug
set WEB_PORT=3000
npm run dev
```

## MCP Tools

### `query_json`

Query cached JSON data by key with optional source specification.

**Parameters:**
- `key` (required): Key to lookup, supports dot notation for nested access
- `source` (optional): Specific JSON source name

**Examples:**
```javascript
// Basic lookup
await query_json({ key: "user.name" })

// From specific source
await query_json({ key: "procedure.get_user", source: "procedures" })

// Nested access
await query_json({ key: "database.connection.pool.max_connections" })
```

### `list_json_keys`

List available keys from cached JSON sources.

**Parameters:**
- `source` (optional): Filter to specific source
- `prefix` (optional): Filter keys by prefix

**Examples:**
```javascript
// List all keys
await list_json_keys()

// Keys from specific source
await list_json_keys({ source: "queries" })

// Keys with prefix
await list_json_keys({ prefix: "user." })
```

### `list_sources`

Display all loaded JSON sources with statistics.

**Returns:** Array of source metadata including:
- Source name and file path
- Key count and file size
- Load time and hit count
- Watch status

## Web Management UI

Access the web interface at `http://localhost:6315`

### Dashboard Tab

- **Overall Statistics**: Total sources, keys, memory usage, cache hit rate
- **Source Cards**: Individual source status with reload controls
- **Quick Actions**: Reload all sources, clear cache, view logs

### Sources Tab

- **Source Selector**: Switch between different JSON sources
- **Key Search**: Find keys by name or prefix
- **Results Table**: Paginated key listings with search
- **Value Viewer**: Click any key to view its JSON value in a modal

### Logs Tab

- **Real-time Logs**: WebSocket streaming of server logs
- **Log Filtering**: Filter by level (Debug, Info, Warn, Error)
- **Auto-scroll**: Follow new logs automatically
- **Clear Logs**: Clean the log display

## Integration with Claude Code

Add to your `.claude/settings.local.json`:

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

### Verification Steps

1. **Build the project:**
   ```bash
   npm run build
   ```

2. **Restart Claude Code** to load the MCP server

3. **Verify connection:**
   - Use the `list_sources` tool in Claude Code
   - Check that your JSON sources are listed
   - Test with `query_json` to confirm data access

## Architecture

### Component Overview

```
┌─────────────────┐
│  Claude Code    │ (MCP client via stdio)
└────────┬────────┘
         │ MCP Protocol
┌────────▼────────┐
│  MCP Server     │ (stdio transport)
└────────┬────────┘
         │
┌────────▼──────────┐
│  CacheManager     │ (Coordinates multiple sources)
└────────┬──────────┘
         │
    ┌────┴─────┬─────────┬─────────┐
    │          │         │         │
┌───▼───┐  ┌───▼──┐  ┌───▼──┐  ┌──▼──┐
│Cache1 │  │Cache2│  │Cache3│  │...  │ (Individual JSON files)
└───────┘  └──────┘  └──────┘  └─────┘
```

### Key Design Patterns

- **Multi-Source Architecture**: Each JSON file gets its own cache instance
- **CacheManager Pattern**: Central coordinator for routing and statistics
- **Nested Key Resolution**: Recursive dot notation parsing for deep object access
- **stdio Transport**: Standard MCP protocol communication
- **Error Isolation**: Failed sources don't crash the entire server

## Performance

### Benchmarks

- **Query Response Time**: <10ms for typical key lookups
- **Memory Usage**: ~1.5x original JSON file size
- **Startup Time**: <100ms for 10MB total JSON data
- **Concurrent Queries**: Handles 100+ simultaneous requests

### Optimization Tips

1. **Use Primary Sources**: Mark frequently accessed sources as `"primary": true`
2. **Enable File Watching**: Only for files that change frequently
3. **Monitor Memory Usage**: Use the web dashboard to track consumption
4. **Key Prefix Filtering**: Use prefix filters to reduce result sets

## Development

### Project Structure

```
mcp-json-cache/
├── src/
│   ├── index.ts              # Main MCP server entry point
│   ├── cache/
│   │   ├── JsonCache.ts      # Individual JSON file cache
│   │   └── CacheManager.ts   # Multi-source coordinator
│   ├── mcp/
│   │   └── tools.ts          # MCP tool implementations
│   ├── web/
│   │   ├── server.ts         # Web UI server
│   │   └── routes/           # API routes
│   └── utils/
│       ├── logger.ts         # Structured logging
│       └── config.ts         # Configuration management
├── config/
│   └── default.json          # Default configuration
├── dist/                     # Compiled JavaScript
└── package.json
```

### Scripts

```bash
# Development
npm run dev              # Run with ts-node
npm run watch            # Watch mode with auto-compile
npm run build            # Compile to dist/
npm start                # Run compiled version

# Web Server Only
npm run web              # Run only the web management UI

# Testing
npm test                 # Run tests
npm run test:watch       # Test in watch mode

# Linting
npm run lint             # ESLint
npm run lint:fix         # Auto-fix linting issues
```

### Web Server Only

To run only the web management UI without the MCP server:

```bash
# Set your JSON file
set JSON_FILE=test.json

# Run only the web server
npm run web
```

Then access the web interface at:
```
http://localhost:6315
```

### Adding New Features

1. **New MCP Tool**: Add to `src/mcp/tools.ts`
2. **Web UI Routes**: Add to `src/web/routes/`
3. **Cache Features**: Extend `src/cache/` classes
4. **Configuration**: Update `src/utils/config.ts`

## Troubleshooting

### Common Issues

**Server won't start:**
- Check that Node.js 16+ is installed
- Verify `npm install` completed successfully
- Server auto-finds available port if requested port is busy (tries 6315-6325)

**JSON files not loading:**
- Verify file paths are correct and absolute
- Check JSON syntax using an online validator
- Ensure file permissions allow reading

**Web UI not accessible:**
- Confirm `WEB_ENABLED=true` (default)
- Check firewall settings for the specified port
- Verify the server started successfully (check console logs)

**MCP tools not working:**
- Ensure server is running (`npm start`)
- Check Claude Code configuration in `.claude/settings.local.json`
- Verify the compiled `dist/index.js` exists

### Debug Mode

Enable debug logging:

```bash
set LOG_LEVEL=debug
npm start
```

This will show detailed information about:
- Configuration loading
- JSON file parsing
- Cache operations
- Web server requests
- MCP tool calls

### Log Files

- **Console Logs**: Real-time server output (stderr)
- **Web UI Logs**: Accessible via the Logs tab at `http://localhost:6315`
- **Error Logs**: Failed file loads and MCP errors

## Contributing

1. Fork the repository
2. Create a feature branch: `git checkout -b feature-name`
3. Make your changes and add tests
4. Run tests: `npm test`
5. Build project: `npm run build`
6. Submit a pull request

## License

[Add your license information here]

## Support

For issues and questions:
- Check the troubleshooting section above
- Review the configuration examples
- Enable debug mode for detailed logging
- Check the web UI dashboard for system status