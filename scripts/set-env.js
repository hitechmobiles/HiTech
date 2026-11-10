/**
 * Dynamic Environment Generator
 * Injects environment variables from .env / Vercel into Angular environment files before build.
 * Zero external dependencies.
 */
const fs = require('fs');
const path = require('path');

// 1. Built-in parser for local .env files
function loadLocalEnv() {
  const root = path.join(__dirname, '..');
  for (const envFile of ['.env', '.env.local']) {
    const fullPath = path.join(root, envFile);
    if (fs.existsSync(fullPath)) {
      const content = fs.readFileSync(fullPath, 'utf8');
      for (const line of content.split('\n')) {
        const trimmed = line.trim();
        if (!trimmed || trimmed.startsWith('#')) continue;
        const eqIdx = trimmed.indexOf('=');
        if (eqIdx > 0) {
          const key = trimmed.slice(0, eqIdx).trim();
          const val = trimmed.slice(eqIdx + 1).trim().replace(/^['"]|['"]$/g, '');
          if (!process.env[key]) {
            process.env[key] = val;
          }
        }
      }
    }
  }
}

loadLocalEnv();

const supabaseUrl = process.env.SUPABASE_URL || '';
const supabaseAnonKey = process.env.SUPABASE_ANON_KEY || '';
const cloudinaryCloudName = process.env.CLOUDINARY_CLOUD_NAME || '';
const cloudinaryApiKey = process.env.CLOUDINARY_API_KEY || '';
const cloudinaryProductPreset = process.env.CLOUDINARY_PRODUCTS_PRESET || 'hitech_products_unsigned';
const cloudinaryOfferPreset = process.env.CLOUDINARY_OFFERS_PRESET || 'hitech_offers_unsigned';
const adminEmail = process.env.ADMIN_EMAIL || '';
const adminPasswordHash = process.env.ADMIN_PASSWORD_HASH || '';
const resendNotificationEmail = process.env.RESEND_TO_EMAIL || 'hitechmobilesandservice@gmail.com';

function generateEnvironmentContent(isProd) {
  return `export const environment = {
  production: ${isProd},
  appName: 'HiTech Mobile & Accessories',
  supabase: {
    url: '${supabaseUrl}',
    anonKey: '${supabaseAnonKey}'
  },
  cloudinary: {
    cloudName: '${cloudinaryCloudName}',
    apiKey: '${cloudinaryApiKey}',
    productPreset: '${cloudinaryProductPreset}',
    offerPreset: '${cloudinaryOfferPreset}'
  },
  admin: {
    email: '${adminEmail}',
    passwordHash: '${adminPasswordHash}',
    role: 'admin'
  },
  resend: {
    apiEndpoint: '/api/send-email',
    notificationEmail: '${resendNotificationEmail}'
  },
  otpExpirySeconds: 60,
  hub: {
    name: 'Hi Tech Mobile Sales and Service',
    address: 'Maniyarampatti, Trichy, Tamil Nadu - 621315',
    lat: 10.7905,
    lng: 78.7047,
    pickupRadiusKm: 30
  },
  github: {
    owner: 'hitechmobiles',
    repo: 'HiTech',
    branch: 'develop',
    token: ''
  },
  ga: {
    measurementId: ''
  }
};
`;
}

const envDir = path.join(__dirname, '..', 'src', 'environments');
if (!fs.existsSync(envDir)) {
  fs.mkdirSync(envDir, { recursive: true });
}

fs.writeFileSync(path.join(envDir, 'environment.ts'), generateEnvironmentContent(false), 'utf8');
fs.writeFileSync(path.join(envDir, 'environment.prod.ts'), generateEnvironmentContent(true), 'utf8');

console.log('[set-env] Injected environment variables into Angular environment.ts & environment.prod.ts');
