import fs from 'node:fs/promises';
import path from 'node:path';
import { build, context } from 'esbuild';

const rootDir = process.cwd();
const distDir = path.join(rootDir, 'dist');
const assetsDir = path.join(distDir, 'assets');
const watchMode = process.argv.includes('--watch');

const buildOptions = {
  absWorkingDir: rootDir,
  entryPoints: ['src/main.tsx'],
  bundle: true,
  format: 'esm',
  platform: 'browser',
  target: ['es2022'],
  outdir: assetsDir,
  entryNames: 'app',
  assetNames: 'app-[name]',
  sourcemap: watchMode,
  logLevel: 'info',
  metafile: true,
  jsx: 'automatic',
  loader: {
    '.css': 'css',
  },
  define: {
    'process.env.NODE_ENV': JSON.stringify(watchMode ? 'development' : 'production'),
  },
};

async function cleanDist() {
  await fs.rm(distDir, { recursive: true, force: true });
  await fs.mkdir(assetsDir, { recursive: true });
}

async function writeIndexHtml() {
  const html = `<!doctype html>
<html lang="pl">
  <head>
    <meta charset="UTF-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1.0" />
    <title>Cabling MVP</title>
    <link rel="stylesheet" href="/assets/app.css" />
  </head>
  <body>
    <div id="root"></div>
    <script type="module" src="/assets/app.js"></script>
  </body>
</html>
`;

  await fs.writeFile(path.join(distDir, 'index.html'), html, 'utf8');
}

async function runBuild() {
  await cleanDist();
  await build(buildOptions);
  await writeIndexHtml();
}

async function runWatch() {
  await cleanDist();

  const htmlPlugin = {
    name: 'write-index-html',
    setup(pluginBuild) {
      pluginBuild.onEnd(async (result) => {
        if (result.errors.length === 0) {
          await writeIndexHtml();
          console.log('Frontend rebuilt.');
        }
      });
    },
  };

  const ctx = await context({
    ...buildOptions,
    plugins: [htmlPlugin],
  });

  await ctx.watch();
  await writeIndexHtml();
  console.log('Watching frontend sources...');
  await new Promise(() => {});
}

if (watchMode) {
  await runWatch();
} else {
  await runBuild();
}
