export const environment = {
  production: false,
  appName: 'HiTech Mobile & Accessories',
  admin: {
    email: 'hitechmobilesandservice@gmail.com',
    passwordHash: 'f636e4ecf9885a0111b777cc419467127116715e43dab9bbaa2fcd93c57607fb',
    role: 'admin'
  },
  resend: {
    apiEndpoint: '/api/send-email',
    apiKey: 're_EBa6bKgi_PdixrfD7A4wwo5aJAAFZaQwc',
    notificationEmail: 'hitechmobilesandservice@gmail.com'
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
  }
};
