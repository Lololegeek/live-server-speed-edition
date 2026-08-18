import * as fs from 'fs';
import * as path from 'path';

export type DetectedProjectType = 'static' | 'vite' | 'react' | 'vue' | 'angular' | 'svelte' | 'next' | 'nuxt' | 'unknown';

export interface DetectedProject {
  type: DetectedProjectType;
  name: string;
  root: string;
  entryFile: string;
  packageManager: 'npm' | 'yarn' | 'pnpm' | 'bun' | null;
  devScript: string | null;
  buildDirectory: string | null;
  hasSourceFiles: boolean;
  description: string;
}

function readJson(filePath: string): Record<string, any> | null {
  try {
    return JSON.parse(fs.readFileSync(filePath, 'utf8')) as Record<string, any>;
  } catch {
    return null;
  }
}

function hasAnyDependency(packageJson: Record<string, any>, names: string[]): boolean {
  const dependencies = {
    ...(packageJson.dependencies || {}),
    ...(packageJson.devDependencies || {}),
    ...(packageJson.peerDependencies || {})
  };
  return names.some(name => Boolean(dependencies[name]));
}

function findExistingDirectory(root: string, candidates: string[]): string | null {
  for (const candidate of candidates) {
    const fullPath = path.join(root, candidate);
    if (!fs.existsSync(fullPath)) continue;
    if (fs.existsSync(path.join(fullPath, 'index.html'))) return fullPath;

    // Angular can put the browser build below dist/<project>/browser.
    // Search only inside known build roots and keep the depth bounded so
    // source folders are never accidentally selected as build output.
    const queue: Array<{ directory: string; depth: number }> = [{ directory: fullPath, depth: 0 }];
    while (queue.length > 0) {
      const current = queue.shift()!;
      if (current.depth >= 3) continue;
      let entries: fs.Dirent[];
      try {
        entries = fs.readdirSync(current.directory, { withFileTypes: true });
      } catch {
        continue;
      }
      for (const entry of entries) {
        if (!entry.isDirectory() || entry.name === 'node_modules') continue;
        const child = path.join(current.directory, entry.name);
        if (fs.existsSync(path.join(child, 'index.html'))) return child;
        queue.push({ directory: child, depth: current.depth + 1 });
      }
    }
  }
  return null;
}

export function detectProject(root: string): DetectedProject {
  const resolvedRoot = path.resolve(root);
  const packageJson = readJson(path.join(resolvedRoot, 'package.json')) || {};
  const scripts = packageJson.scripts || {};
  const hasAngularConfig = fs.existsSync(path.join(resolvedRoot, 'angular.json'));
  const hasViteConfig = fs.readdirSync(resolvedRoot, { withFileTypes: true }).some(entry => /^vite\.config\./i.test(entry.name));

  let type: DetectedProjectType = 'static';
  if (hasAngularConfig || hasAnyDependency(packageJson, ['@angular/core', '@angular/cli'])) type = 'angular';
  else if (hasAnyDependency(packageJson, ['next'])) type = 'next';
  else if (hasAnyDependency(packageJson, ['nuxt'])) type = 'nuxt';
  else if (hasAnyDependency(packageJson, ['svelte', '@sveltejs/kit'])) type = 'svelte';
  else if (hasViteConfig) type = 'vite';
  else if (hasAnyDependency(packageJson, ['react', 'react-dom', 'react-scripts'])) type = 'react';
  else if (hasAnyDependency(packageJson, ['vue', '@vue/cli-service'])) type = 'vue';
  else if (fs.existsSync(path.join(resolvedRoot, 'index.html'))) type = 'static';
  else type = 'unknown';

  const lockFiles: Array<[string, DetectedProject['packageManager']]> = [
    ['pnpm-lock.yaml', 'pnpm'],
    ['yarn.lock', 'yarn'],
    ['bun.lockb', 'bun'],
    ['package-lock.json', 'npm']
  ];
  const packageManager = lockFiles.find(([file]) => fs.existsSync(path.join(resolvedRoot, file)))?.[1] || (packageJson.name ? 'npm' : null);
  const devScript = ['dev', 'start', 'serve'].find(script => typeof scripts[script] === 'string') || null;
  const buildDirectory = findExistingDirectory(resolvedRoot, ['dist', 'build', 'public', 'out', '.output/public']);
  const sourceDirectories = ['src', 'app', 'pages'].some(directory => fs.existsSync(path.join(resolvedRoot, directory)));
  const entryFile = fs.existsSync(path.join(resolvedRoot, 'index.html')) ? 'index.html' : buildDirectory ? path.relative(resolvedRoot, path.join(buildDirectory, 'index.html')) : '';
  const name = String(packageJson.name || path.basename(resolvedRoot));
  const description = type === 'static'
    ? 'Projet HTML statique'
    : `${type.toUpperCase()} détecté${devScript ? ` — script ${devScript} disponible` : ''}`;

  return {
    type,
    name,
    root: resolvedRoot,
    entryFile,
    packageManager,
    devScript,
    buildDirectory: buildDirectory ? path.relative(resolvedRoot, buildDirectory) : null,
    hasSourceFiles: sourceDirectories,
    description
  };
}
