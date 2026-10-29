export const environment = {
  production: true,
  appName: 'HiTech Mobile & Accessories',
  admin: {
    email: 'bhuvaneshwaranaj@gmail.com',
    passwordHash: '421d194eed97614f3a06a8867a1595ebb688432356d1d5ff0586be34ccb698e5',
    role: 'admin'
  },
  resend: {
    apiEndpoint: '/api/send-email',
    apiKey: '',
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
