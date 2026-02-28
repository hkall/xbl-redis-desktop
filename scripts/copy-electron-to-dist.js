import fs from 'fs';
import path from 'path';

console.log('Preparing electron files for packaging...');

const distDir = path.join(process.cwd(), 'dist');
const electronDir = path.join(process.cwd(), 'electron');
const rootNodeModules = path.join(process.cwd(), 'node_modules');

// Ensure dist directory exists
if (!fs.existsSync(distDir)) {
  console.error('dist directory does not exist. Please run build first.');
  process.exit(1);
}

// Copy electron files to dist
console.log('Copying electron files to dist...');

function copyRecursiveSync(src, dest) {
  const exists = fs.existsSync(src);
  const stats = exists && fs.statSync(src);
  const isDirectory = exists && stats.isDirectory();

  if (isDirectory) {
    fs.mkdirSync(dest, { recursive: true });
    fs.readdirSync(src).forEach(childItemName => {
      copyRecursiveSync(path.join(src, childItemName), path.join(dest, childItemName));
    });
  } else {
    fs.copyFileSync(src, dest);
  }
}

// Copy only necessary node_modules dependencies to dist
function copyNodeModules() {
  const distNodeModules = path.join(distDir, 'node_modules');
  fs.mkdirSync(distNodeModules, { recursive: true });

  // Copy production dependencies only
  const dependencies = ['ioredis', 'java-object-serialization', 'redis-errors'];

  for (const dep of dependencies) {
    const srcPath = path.join(rootNodeModules, dep);
    const destPath = path.join(distNodeModules, dep);

    if (fs.existsSync(srcPath)) {
      console.log(`  Copying ${dep}...`);
      copyRecursiveSync(srcPath, destPath);
    }
  }

  // Also copy cluster-command-list from @ioredis if it exists
  const ioredisInternalPath = path.join(rootNodeModules, '@ioredis');
  if (fs.existsSync(ioredisInternalPath)) {
    console.log('  Copying @ioredis...');
    copyRecursiveSync(ioredisInternalPath, path.join(distNodeModules, '@ioredis'));
  }

  // Copy electron to dist/node_modules for electron-builder
  const electronPath = path.join(rootNodeModules, 'electron');
  if (fs.existsSync(electronPath)) {
    console.log('  Copying electron...');
    copyRecursiveSync(electronPath, path.join(distNodeModules, 'electron'));
  }
}

// Copy all files from electron directory to dist, excluding ts files
function copyElectronFiles() {
  const files = fs.readdirSync(electronDir);

  for (const file of files) {
    const srcPath = path.join(electronDir, file);
    const destPath = path.join(distDir, file);
    const stat = fs.statSync(srcPath);

    if (stat.isDirectory()) {
      // Skip directories that contain only TypeScript files
      const dirFiles = fs.readdirSync(srcPath);
      const hasJsFiles = dirFiles.some(f => !f.endsWith('.ts') && !f.endsWith('.config') && f !== 'tsconfig.json');

      if (hasJsFiles) {
        copyRecursiveSync(srcPath, destPath);
      }
    } else if (!file.endsWith('.ts') && !file.endsWith('.map') && !file.endsWith('.config') && file !== 'tsconfig.json') {
      fs.copyFileSync(srcPath, destPath);
    }
  }
}

copyElectronFiles();
console.log('Electron files copied successfully.');

// Copy node_modules dependencies
console.log('Copying node_modules dependencies...');
copyNodeModules();
console.log('node_modules dependencies copied successfully.');

// Create a minimal package.json for electron-builder in dist
console.log('Creating build package.json in dist...');

const rootPackageJson = JSON.parse(fs.readFileSync(path.join(process.cwd(), 'package.json'), 'utf8'));
const buildPackageJson = {
  name: rootPackageJson.name,
  version: rootPackageJson.version,
  description: rootPackageJson.description,
  author: rootPackageJson.author,
  main: 'main.cjs',
  dependencies: {
    'ioredis': rootPackageJson.dependencies.ioredis,
    'java-object-serialization': rootPackageJson.dependencies['java-object-serialization']
  },
  devDependencies: {
    'electron': rootPackageJson.devDependencies.electron
  },
  build: rootPackageJson.build
};

fs.writeFileSync(
  path.join(distDir, 'package.json'),
  JSON.stringify(buildPackageJson, null, 2)
);

console.log('Build preparation complete.');