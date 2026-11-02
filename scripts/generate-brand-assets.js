const fs = require('fs');
const path = require('path');

const brandsDir = path.join(__dirname, '..', 'public', 'images', 'brands');
const servicesDir = path.join(__dirname, '..', 'public', 'images', 'services');

fs.mkdirSync(brandsDir, { recursive: true });
fs.mkdirSync(servicesDir, { recursive: true });

// Brand SVGs
const brandLogos = {
  apple: `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 170 170" width="100%" height="100%">
    <rect width="100%" height="100%" rx="32" fill="#0f172a"/>
    <path d="M112.5 86.8c.2 20.3 17.7 27 18 27.2-.2.5-2.8 9.5-9.2 18.9-5.6 8.1-11.3 16.2-20.5 16.3-9 .2-12-5.4-22.3-5.4-10.4 0-13.7 5.2-22.3 5.6-8.9.3-15.5-8.8-21.1-17-11.5-16.7-20.3-47.2-8.5-67.7 5.9-10.2 16.3-16.6 27.7-16.8 8.6-.2 16.8 5.8 22 5.8 5.3 0 15.1-7.2 25.4-6.1 4.3.2 16.4 1.7 24.2 13.2-.6.4-14.4 8.5-13.4 26z" fill="#f8fafc"/>
    <path d="M98.6 44.9c4.7-5.7 7.8-13.6 6.9-21.5-6.7.3-14.9 4.5-19.7 10.1-4.2 4.9-7.9 12.9-6.9 20.5 7.5.6 15-3.4 19.7-9.1z" fill="#f8fafc"/>
  </svg>`,

  samsung: `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 240 80" width="100%" height="100%">
    <rect width="100%" height="100%" rx="16" fill="#034ea2"/>
    <text x="120" y="52" fill="#ffffff" font-family="'Outfit', -apple-system, sans-serif" font-weight="900" font-size="34" letter-spacing="4" text-anchor="middle">SAMSUNG</text>
  </svg>`,

  oneplus: `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 200 80" width="100%" height="100%">
    <rect width="100%" height="100%" rx="16" fill="#eb0028"/>
    <g transform="translate(20, 20)">
      <rect width="40" height="40" rx="6" fill="#ffffff"/>
      <path d="M20 10v20M10 20h20" stroke="#eb0028" stroke-width="4" stroke-linecap="round"/>
      <text x="50" y="30" fill="#ffffff" font-family="'Outfit', -apple-system, sans-serif" font-weight="800" font-size="28" letter-spacing="2">ONEPLUS</text>
    </g>
  </svg>`,

  vivo: `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 200 80" width="100%" height="100%">
    <rect width="100%" height="100%" rx="16" fill="#415fff"/>
    <text x="100" y="53" fill="#ffffff" font-family="'Outfit', -apple-system, sans-serif" font-weight="900" font-size="44" letter-spacing="2" text-anchor="middle">vivo</text>
  </svg>`,

  nothing: `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 220 80" width="100%" height="100%">
    <rect width="100%" height="100%" rx="16" fill="#18181b"/>
    <text x="110" y="50" fill="#f43f5e" font-family="'Courier New', monospace" font-weight="700" font-size="30" letter-spacing="3" text-anchor="middle">(NOTHING)</text>
  </svg>`,

  xiaomi: `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 160 80" width="100%" height="100%">
    <rect width="100%" height="100%" rx="16" fill="#ff6900"/>
    <text x="80" y="52" fill="#ffffff" font-family="'Outfit', -apple-system, sans-serif" font-weight="900" font-size="34" letter-spacing="2" text-anchor="middle">Xiaomi</text>
  </svg>`,

  redmi: `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 180 80" width="100%" height="100%">
    <rect width="100%" height="100%" rx="16" fill="#dc2626"/>
    <text x="90" y="52" fill="#ffffff" font-family="'Outfit', -apple-system, sans-serif" font-weight="800" font-size="34" letter-spacing="2" text-anchor="middle">Redmi</text>
  </svg>`,

  realme: `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 180 80" width="100%" height="100%">
    <rect width="100%" height="100%" rx="16" fill="#ffc915"/>
    <text x="90" y="52" fill="#000000" font-family="'Outfit', -apple-system, sans-serif" font-weight="800" font-size="34" letter-spacing="1" text-anchor="middle">realme</text>
  </svg>`,

  iqoo: `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 180 80" width="100%" height="100%">
    <rect width="100%" height="100%" rx="16" fill="#f59e0b"/>
    <text x="90" y="53" fill="#000000" font-family="'Outfit', -apple-system, sans-serif" font-weight="900" font-size="42" letter-spacing="2" text-anchor="middle">iQOO</text>
  </svg>`,

  motorola: `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 200 80" width="100%" height="100%">
    <rect width="100%" height="100%" rx="16" fill="#0b5cff"/>
    <text x="100" y="50" fill="#ffffff" font-family="'Outfit', -apple-system, sans-serif" font-weight="700" font-size="28" letter-spacing="1.5" text-anchor="middle">motorola</text>
  </svg>`,

  poco: `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 160 80" width="100%" height="100%">
    <rect width="100%" height="100%" rx="16" fill="#facc15"/>
    <text x="80" y="54" fill="#000000" font-family="'Outfit', -apple-system, sans-serif" font-weight="900" font-size="42" letter-spacing="3" text-anchor="middle">POCO</text>
  </svg>`,

  infinix: `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 180 80" width="100%" height="100%">
    <rect width="100%" height="100%" rx="16" fill="#10b981"/>
    <text x="90" y="52" fill="#ffffff" font-family="'Outfit', -apple-system, sans-serif" font-weight="800" font-size="32" letter-spacing="2" text-anchor="middle">Infinix</text>
  </svg>`,

  google: `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 180 80" width="100%" height="100%">
    <rect width="100%" height="100%" rx="16" fill="#1e293b"/>
    <text x="90" y="52" fill="#38bdf8" font-family="'Outfit', -apple-system, sans-serif" font-weight="800" font-size="34" letter-spacing="2" text-anchor="middle">Google</text>
  </svg>`,

  generic: `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 180 80" width="100%" height="100%">
    <rect width="100%" height="100%" rx="16" fill="#0f172a" stroke="#38bdf8" stroke-width="2"/>
    <text x="90" y="50" fill="#38bdf8" font-family="'Outfit', -apple-system, sans-serif" font-weight="800" font-size="28" letter-spacing="2" text-anchor="middle">HiTech</text>
  </svg>`
};

for (const [key, svg] of Object.entries(brandLogos)) {
  fs.writeFileSync(path.join(brandsDir, `${key}.svg`), svg);
}

// Service SVGs
const serviceLogos = {
  'screen-repair': `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 100 100" width="100%" height="100%">
    <defs>
      <linearGradient id="g1" x1="0%" y1="0%" x2="100%" y2="100%">
        <stop offset="0%" stop-color="#00f2fe"/>
        <stop offset="100%" stop-color="#4facfe"/>
      </linearGradient>
    </defs>
    <rect width="100" height="100" rx="20" fill="#0f172a" stroke="#1e293b"/>
    <rect x="25" y="15" width="50" height="70" rx="8" fill="none" stroke="url(#g1)" stroke-width="4"/>
    <line x1="42" y1="20" x2="58" y2="20" stroke="url(#g1)" stroke-width="2" stroke-linecap="round"/>
    <circle cx="50" cy="77" r="3" fill="url(#g1)"/>
    <path d="M35 35l30 30M35 45l20 20" stroke="#f43f5e" stroke-width="2" stroke-linecap="round" opacity="0.6"/>
  </svg>`,

  'battery-replacement': `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 100 100" width="100%" height="100%">
    <defs>
      <linearGradient id="gb" x1="0%" y1="0%" x2="100%" y2="100%">
        <stop offset="0%" stop-color="#10b981"/>
        <stop offset="100%" stop-color="#059669"/>
      </linearGradient>
    </defs>
    <rect width="100" height="100" rx="20" fill="#0f172a" stroke="#1e293b"/>
    <rect x="24" y="24" width="52" height="52" rx="8" fill="none" stroke="url(#gb)" stroke-width="4"/>
    <rect x="42" y="16" width="16" height="8" rx="2" fill="url(#gb)"/>
    <path d="M52 34l-8 16h12l-6 16 14-20h-12z" fill="#facc15"/>
  </svg>`,

  'water-damage': `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 100 100" width="100%" height="100%">
    <defs>
      <linearGradient id="gw" x1="0%" y1="0%" x2="100%" y2="100%">
        <stop offset="0%" stop-color="#06b6d4"/>
        <stop offset="100%" stop-color="#3b82f6"/>
      </linearGradient>
    </defs>
    <rect width="100" height="100" rx="20" fill="#0f172a" stroke="#1e293b"/>
    <path d="M50 20 C50 20, 28 50, 28 64 A22 22 0 0 0 72 64 C72 50, 50 20, 50 20 Z" fill="url(#gw)"/>
    <path d="M42 56 a10 10 0 0 0 10 10" stroke="#ffffff" stroke-width="3" stroke-linecap="round" fill="none" opacity="0.6"/>
  </svg>`,

  'motherboard-repair': `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 100 100" width="100%" height="100%">
    <defs>
      <linearGradient id="gm" x1="0%" y1="0%" x2="100%" y2="100%">
        <stop offset="0%" stop-color="#a855f7"/>
        <stop offset="100%" stop-color="#6366f1"/>
      </linearGradient>
    </defs>
    <rect width="100" height="100" rx="20" fill="#0f172a" stroke="#1e293b"/>
    <rect x="28" y="28" width="44" height="44" rx="6" fill="#1e1b4b" stroke="url(#gm)" stroke-width="4"/>
    <circle cx="50" cy="50" r="10" fill="url(#gm)"/>
    <path d="M50 16v12M50 72v12M16 50h12M72 50h12M35 16v12M65 16v12M35 72v12M65 72v12" stroke="url(#gm)" stroke-width="3" stroke-linecap="round"/>
  </svg>`,

  'charging-port': `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 100 100" width="100%" height="100%">
    <defs>
      <linearGradient id="gc" x1="0%" y1="0%" x2="100%" y2="100%">
        <stop offset="0%" stop-color="#f59e0b"/>
        <stop offset="100%" stop-color="#ef4444"/>
      </linearGradient>
    </defs>
    <rect width="100" height="100" rx="20" fill="#0f172a" stroke="#1e293b"/>
    <rect x="26" y="34" width="48" height="32" rx="10" fill="none" stroke="url(#gc)" stroke-width="4"/>
    <rect x="36" y="46" width="28" height="8" rx="4" fill="url(#gc)"/>
    <path d="M50 18v16M50 66v16" stroke="url(#gc)" stroke-width="3" stroke-linecap="round"/>
  </svg>`,

  'software-unlock': `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 100 100" width="100%" height="100%">
    <defs>
      <linearGradient id="gs" x1="0%" y1="0%" x2="100%" y2="100%">
        <stop offset="0%" stop-color="#ec4899"/>
        <stop offset="100%" stop-color="#8b5cf6"/>
      </linearGradient>
    </defs>
    <rect width="100" height="100" rx="20" fill="#0f172a" stroke="#1e293b"/>
    <rect x="30" y="44" width="40" height="34" rx="6" fill="none" stroke="url(#gs)" stroke-width="4"/>
    <path d="M38 44v-12a12 12 0 0 1 24 0v12" fill="none" stroke="url(#gs)" stroke-width="4" stroke-linecap="round"/>
    <circle cx="50" cy="58" r="4" fill="url(#gs)"/>
    <path d="M50 62v6" stroke="url(#gs)" stroke-width="3" stroke-linecap="round"/>
  </svg>`
};

for (const [key, svg] of Object.entries(serviceLogos)) {
  fs.writeFileSync(path.join(servicesDir, `${key}.svg`), svg);
}

console.log('Brand & Service vector assets created successfully!');

