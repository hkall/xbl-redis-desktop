# XBL DevTools

[![Version](https://img.shields.io/badge/version-1.3.0-blue.svg)](../../releases)
[![Platform](https://img.shields.io/badge/platform-Windows-lightgrey.svg)](../../releases)
[![License](https://img.shields.io/badge/license-MIT-green.svg)](LICENSE)
[![Node.js](https://img.shields.io/badge/node.js-18%2B-brightgreen.svg)](https://nodejs.org)

---

A powerful desktop tool for Redis management, API testing, and MySQL database operations.

---

## Features

### 🚀 Three Core Modules

| Module | Description |
|--------|-------------|
| **Redis** | Full Redis management - data viewing, editing, CLI, batch operations, export, server monitoring |
| **API Testing** | Complete API testing tool - request management, environments, code generation, stress testing, automated testing |
| **Database** | MySQL connection and query execution with data editing, export support |

### ✨ Highlights

- 📊 **Intuitive UI** - Clean layout with clear key-value display
- 🔍 **Complete Redis Type Support** - String, Hash, List, Set, ZSet with Java serialization viewer
- ✏️ **Inline Editing** - Edit data directly, supports keyboard shortcuts
- 🔄 **Multi-Connection Management** - Manage multiple Redis/database connections simultaneously
- 🌐 **Internationalization** - Full Chinese/English support with one-click switching
- ⚡ **High Performance** - SCAN-based pagination, won't block Redis server
- 🌳 **Smart Key Grouping** - Auto-group keys by colon delimiter, tree view display

### 📋 API Testing Features

- Multiple HTTP methods (GET, POST, PUT, DELETE, PATCH, HEAD, OPTIONS)
- Request body support (JSON, form-data, x-www-form-urlencoded, raw, binary)
- Environment variables with `{{var}}` syntax
- Code generation (cURL, fetch, axios, XMLHttpRequest)
- **Stress Testing** - Concurrent requests, real-time RPS metrics, response time distribution
- **Automated Testing** - Test cases, assertions, test suites, execution reports
- Request history and project management
- Import/Export with OpenAPI 3.0 support

### 🗄️ Database Features

- MySQL connection management
- SQL editor with syntax highlighting and auto-completion
- Data viewing and inline editing
- Query execution with pagination
- Export to CSV, JSON, SQL, Excel
- Table structure viewing and editing
- Stored procedures and triggers management

---

## Installation

### Windows

Download from [Releases](../../releases):

- **Installer**: `XBL DevTools-win-1.3.0.exe` - Standard Windows installer
- **Portable**: Extract and run directly, no installation required

---

## Quick Start

### Redis Connection

1. Click "New Connection" button
2. Enter Redis server info (host, port, password)
3. Click "Connect" to start

### API Testing

1. Create a new project
2. Add requests with URL, method, headers, body
3. Press `Ctrl + Enter` to send

### Database Connection

1. Add new database connection
2. Enter MySQL server info
3. Browse tables and execute queries

---

## Tech Stack

| Technology | Description |
|------------|-------------|
| Electron 31 | Cross-platform desktop framework |
| React 18 | UI framework |
| Vite 5 | Build tool |
| Tailwind CSS 3 | Styling |
| TypeScript 5 | Type-safe development |
| Zustand | State management |
| ioredis | Redis client |
| mysql2 | MySQL client |
| xlsx | Excel export |

---

## Development

```bash
# Clone
git clone https://github.com/hkall/xbl-redis-desktop.git
cd xbl-redis-desktop

# Install
npm install

# Development
npm run electron:dev

# Build
npm run electron:build:win
```

---

## Changelog

### v1.3.0 (2026-04-02)

- **API Stress Testing** - Concurrent requests with real-time metrics (RPS, response time, error rate)
- **API Automated Testing** - Test cases, assertions, test suites, execution reports
- **Database Module** - MySQL support with query execution, data editing, export
- **Excel Export** - Export query results to Excel format
- **Smart Column Width** - Intelligent column width calculation for query results
- **Performance Optimization** - Removed unnecessary table row count queries

### v1.2.0 (2026-03-12)

- Hash lazy loading with HSCAN pagination
- Performance improvements for large Hash keys

### v1.1.0 (2026-03-11)

- CLI command line tool
- Batch operations with pattern matching
- Data export (JSON/CSV)
- API testing module
- Internationalization (Chinese/English)

---

## Roadmap

- [ ] Redis Cluster support
- [ ] Redis Sentinel support
- [ ] PostgreSQL support
- [ ] MongoDB support
- [ ] Data import functionality
- [ ] Pub/Sub subscription

---

## License

[MIT License](LICENSE)

---

## Author

- **hukun** - 1181929830@qq.com

---

## Acknowledgments

Thanks to these open source projects:

[Electron](https://www.electronjs.org/) | [React](https://reactjs.org/) | [Vite](https://vitejs.dev/) | [Tailwind CSS](https://tailwindcss.com/) | [ioredis](https://github.com/luin/ioredis) | [Zustand](https://github.com/pmndrs/zustand) | [Lucide](https://lucide.dev/)

---

**XBL DevTools** - Making Redis & API management simpler and more efficient!