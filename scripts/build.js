#!/usr/bin/env node

/**
 * Build script using esbuild
 * Bundles the MCP server into a single executable file
 */

import esbuild from 'esbuild';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const projectRoot = path.join(__dirname, '..');

const isWatch = process.argv.includes('--watch');
const isDev = process.argv.includes('--dev');

console.log(`🏗️ Building Orderly MCP Server${isWatch ? ' (watch mode)' : ''}...\n`);

// Ensure dist directory exists
const distDir = path.join(projectRoot, 'dist');
if (!fs.existsSync(distDir)) {
  fs.mkdirSync(distDir, { recursive: true });
}

// Copy data files to dist
console.log('📁 Copying data files...');
const dataSrcDir = path.join(projectRoot, 'src', 'data');
const dataDestDir = path.join(distDir, 'data');

function copyDir(src, dest) {
  if (!fs.existsSync(dest)) {
    fs.mkdirSync(dest, { recursive: true });
  }

  const entries = fs.readdirSync(src, { withFileTypes: true });

  for (const entry of entries) {
    const srcPath = path.join(src, entry.name);
    const destPath = path.join(dest, entry.name);

    if (entry.isDirectory()) {
      copyDir(srcPath, destPath);
    } else {
      fs.copyFileSync(srcPath, destPath);
    }
  }
}

if (fs.existsSync(dataSrcDir)) {
  copyDir(dataSrcDir, dataDestDir);
  console.log('   ✅ Data files copied');
}

// Build configuration
const buildOptions = {
  entryPoints: [path.join(projectRoot, 'src', 'index.ts')],
  bundle: true,
  platform: 'node',
  target: 'node20',
  format: 'esm', // Keep ESM format
  outfile: path.join(distDir, 'index.js'),
  minify: !isDev,
  sourcemap: true,
  external: [], // Bundle everything
  banner: {
    js: '#!/usr/bin/env node\n',
  },
  define: {
    'process.env.NODE_ENV': isDev ? '"development"' : '"production"',
  },
};

async function build() {
  try {
    if (isWatch) {
      const ctx = await esbuild.context(buildOptions);
      await ctx.watch();
      console.log('👀 Watching for changes...');
    } else {
      await esbuild.build(buildOptions);

      // Read the generated file and fix the shebang
      let content = fs.readFileSync(buildOptions.outfile, 'utf-8');

      // Remove duplicate shebang if present
      if (content.startsWith('#!/usr/bin/env node\n#!/usr/bin/env node')) {
        content = content.replace(
          '#!/usr/bin/env node\n#!/usr/bin/env node',
          '#!/usr/bin/env node'
        );
      }

      // Write the fixed content back
      fs.writeFileSync(buildOptions.outfile, content);

      // Make the output file executable
      fs.chmodSync(buildOptions.outfile, '755');

      // Generate TypeScript declarations
      console.log('📝 Generating TypeScript declarations...');
      try {
        const { execSync } = await import('child_process');
        execSync('yarn build:types', { stdio: 'inherit', cwd: projectRoot });
      } catch (e) {
        console.warn('   ⚠️ Type generation failed (non-critical)');
      }

      console.log('\n✅ Build complete!');
      console.log(`   📦 Output: ${buildOptions.outfile}`);

      // Show file size
      const stats = fs.statSync(buildOptions.outfile);
      const sizeKB = (stats.size / 1024).toFixed(2);
      console.log(`   📊 Size: ${sizeKB} KB`);
      console.log('\n🚀 Run with: node dist/index.js');
    }
  } catch (error) {
    console.error('❌ Build failed:', error.message);
    process.exit(1);
  }
}

build();
