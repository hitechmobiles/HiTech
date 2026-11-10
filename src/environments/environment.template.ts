export const environment = {
  production: false,
  appName: 'HiTech Mobile & Accessories',
  supabase: {
    url: '',
    anonKey: ''
  },
  cloudinary: {
    cloudName: '',
    apiKey: '',
    productPreset: 'hitech_products_unsigned',
    offerPreset: 'hitech_offers_unsigned'
  },
  admin: {
    email: '',
    passwordHash: '',
    role: 'admin'
  },
  resend: {
    apiEndpoint: '/api/send-email',
    notificationEmail: ''
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
