const { execSync } = require('child_process');
const path = require('path');

// Determine environment from Vercel Git metadata or environment variables
const gitBranch = process.env.VERCEL_GIT_COMMIT_REF || process.env.GIT_BRANCH || '';
const vercelEnv = process.env.VERCEL_ENV || '';
const customConfig = process.argv[2]; // e.g. --configuration=development

let configuration = 'production';

if (customConfig) {
  configuration = customConfig.replace(/^--configuration=/, '');
} else if (gitBranch === 'develop' || vercelEnv === 'preview' || process.env.NODE_ENV === 'development') {
  configuration = 'development';
} else {
  configuration = 'production';
}

console.log(`========================================`);
console.log(`HiTech Build Dispatcher`);
console.log(`Branch: ${gitBranch || '(local / unspecified)'}`);
console.log(`Vercel Env: ${vercelEnv || '(local)'}`);
console.log(`Target Angular Configuration: ${configuration}`);
console.log(`========================================`);

try {
  // Execute Angular build with chosen configuration
  const buildCmd = `npx ng build --configuration ${configuration}`;
  console.log(`Running: ${buildCmd}`);
  execSync(buildCmd, { stdio: 'inherit' });

  // Run post-build script to prepare dual directory and 404 fallback
  const postBuildScript = path.join(__dirname, 'post-build.js');
  console.log(`Running post-build script: ${postBuildScript}`);
  execSync(`node "${postBuildScript}"`, { stdio: 'inherit' });

  console.log(`Build completed successfully for [${configuration}] environment.`);
} catch (error) {
  console.error(`Build failed:`, error.message);
  process.exit(1);
}
