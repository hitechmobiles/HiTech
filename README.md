# HiTech — Mobile Phones, Accessories & Expert Repair Services

> Modern, high-performance Angular 19 E-Commerce & Service Booking Platform featuring multi-role authentication (Customer, Wholesale Shop Partner, Super Admin), dual-recipient transactional email notifications via **Resend**, unified client/shop address autofill, GitHub PAT-based catalog publishing, and continuous deployment on **Vercel**.

---

## 🚀 Live Repository & Deployment

- **GitHub Repository**: [https://github.com/BhuvaneshwaranMitrahsoft/HiTech.git](https://github.com/BhuvaneshwaranMitrahsoft/HiTech.git)
- **Deployment Platform**: **Vercel** (Automatic CI/CD on Git push to `main` and `develop`)
- **Serverless API**: Vercel Serverless Function at `/api/send-email` powered by **Resend**

---

## 🛠️ Technology Stack

| Layer | Technology | Description |
|---|---|---|
| **Framework** | Angular 19 | Standalone Components, Reactive Signals (`computed`, `signal`), OnPush Change Detection |
| **Styling** | Vanilla SCSS | Obsidian Dark Cyber Theme, Glassmorphism, Responsive Grid System, CSS Brand Arches |
| **Typography** | Google Fonts | `Outfit` (Headings, Badges, Numeric Displays), `Inter` (UI & Body Text) |
| **Email Delivery** | **Resend** | Serverless function `/api/send-email` with responsive HTML templates & local simulation fallback |
| **Hosting & CI/CD** | **Vercel** | Edge Network, automatic preview/production builds, zero-config SPA routing via `vercel.json` |
| **Security** | Web Crypto API | SHA-256 password hashing, Content-Security-Policy (CSP), HTTP security headers, PAT masking |
| **Data Architecture** | Pure Static + Git | JSON Catalogs (`public/data/`), browser `localStorage` overlays, GitHub PAT direct-commit publishing |

---

## 📱 Core Application Flows & Features

### 1. Customer User Flow
1. **Interactive Dashboard**:
   - Dynamic hero banner with quick CTA triggers ("Purchase Products", "Book a Service", "Register Shop").
   - Live trust badges (15,000+ repairs, 100% OEM spares, 60-min express fix, 10+ wholesale hubs).
   - 19 handcrafted CSS/SVG smartphone brand arches (Apple, Samsung, OnePlus, Nothing, Vivo, OPPO, Realme, etc.).
2. **Product Catalog & Sourcing**:
   - Filter by brand, price range, and subcategories (Flagship Phones, Chargers, Audio, Cases).
   - Single-click **Favourites Wishlist** bookmarking.
   - **Product Sourcing Form**: If a search query yields zero matches, an automated sourcing request form lets the customer request custom procurement with notifications sent to the admin.
   - **🔔 Restock Alerts ("Notify Me")**: Out-of-stock items feature a prominent "Notify Me" trigger allowing customers to register for restock notifications.
3. **Cart & Checkout**:
   - Multi-item management with quantity adjustments and free delivery threshold calculation.
   - Form validation for customer name, 10-digit mobile number, and delivery address.
4. **Dual Email Notification**:
   - On checkout, a transactional confirmation email is dispatched via Resend to **both** the customer and Super Admin (`bhuvaneshwaranaj@gmail.com`).

---

### 2. Shop Owner Partner Flow (B2B Wholesale)
1. **Partner Registration & Onboarding**:
   - Self-service partner enrollment via `/register-shop` with storefront image upload and GST details.
   - Admin approval activates the shop account with tiered wholesale discounts (10% to 25% OFF).
2. **Unified Booking & Purchase Forms with Address Autofill**:
   - Shop owners use the exact same purchase and service booking forms as retail customers.
   - When a logged-in shop partner accesses the checkout or service booking modal, an address toolbar appears:
     - **📍 Use Default Shop Address**: One-click autofill with the partner's registered shop name, proprietor name, mobile number, and store address.
     - **👤 Ship to Client Location**: One-click reset to empty fields so the shop partner can order or book repairs directly for client delivery.
3. **Automated Attribution**:
   - All orders and service requests created by shop owners are tagged with `placedByRole: 'shopowner'`, `shopOwnerId`, and `shopName` for B2B accounting.

---

### 3. Super Admin Management Console
1. **Cryptographic 2-Factor Authentication**:
   - Admin Email: `bhuvaneshwaranaj@gmail.com`
   - Password: SHA-256 hashed comparison via Web Crypto API.
   - Two-factor 6-digit OTP delivery with strict 60-second expiration timer.
2. **Catalog & Price Management**:
   - Instant in-stock / out-of-stock toggles for all devices and accessories.
   - Unified pricing matrix for smartphones, accessories, and repair services.
   - Shop owner directory management (approval, tier assignment, credential resets).
3. **Orders & Repair Bookings Desk**:
   - Full visibility into retail customer orders, wholesale restocks, and repair service requests.
   - Status updates (Pending, Confirmed, In Progress, Completed, Cancelled) with audit logs.
   - **Restock Alerts Tab**: Dedicated view of all customer restock notifications submitted via "🔔 Notify Me" with direct WhatsApp/phone contact triggers.
4. **GitHub PAT-Based Direct Branch Publishing**:
   - Admins can store a GitHub Personal Access Token (PAT) with `repo` scope securely in their browser (`localStorage`).
   - Clicking **"Publish Catalog to GitHub"** directly commits updated `products.json`, `accessories.json`, `services.json`, and `shop-owners.json` to the active GitHub branch (`main` or `develop`).
   - Clicking **"📤 Sync Orders & Bookings to Git"** commits accumulated orders and repair bookings to `public/data/orders.json` and `public/data/bookings.json`.
   - Vercel automatically detects the Git commit and triggers an updated production build with zero manual intervention.

---

## 🔐 Credentials Cheat Sheet (Testing & Demo)

| Role | Email | Password | OTP Verification |
|---|---|---|---|
| **Super Admin** | `bhuvaneshwaranaj@gmail.com` | `Bhuvi@02#1` | 6-Digit OTP (60s countdown) |
| **Shop Owner 1** | `owner1@hitech.com` | `Owner@HiTech123` | 6-Digit OTP (60s countdown) |
| **Shop Owner 2** | `owner2@hitech.com` | `Owner@HiTech123` | 6-Digit OTP (60s countdown) |
| *(Owners 3 to 10)* | `owner3@hitech.com` ... `owner10@hitech.com` | `Owner@HiTech123` | 6-Digit OTP (60s countdown) |

> 💡 **Development Note**: When running locally without live Resend API keys, the application automatically displays the generated 6-digit OTP in a high-visibility badge with a **"Click to Auto-Fill"** button for uninterrupted testing.

---

## 📧 Email Architecture & Vercel Serverless Function

HiTech uses **Resend** exclusively for transactional email delivery. The architecture consists of:

```
[ Angular App (Client) ] 
       │
       ▼ HTTP POST (JSON Payload)
[ /api/send-email (Vercel Serverless Function) ]
       │
       ▼ Authorization: Bearer RESEND_API_KEY
[ Resend API (https://api.resend.com/emails) ]
       ├──▶ Customer Confirmation (HTML Template)
       └──▶ Admin Alert to bhuvaneshwaranaj@gmail.com
```

### Vercel Environment Variables
Configure these in your [Vercel Project Dashboard](https://vercel.com/) under **Settings > Environment Variables**:

| Variable Name | Required | Description | Example |
|---|---|---|---|
| `RESEND_API_KEY` | **Yes** | Your Resend API Key | `re_123456789abcdef` |
| `RESEND_TO_EMAIL` | **Yes** | Admin notification recipient | `bhuvaneshwaranaj@gmail.com` |
| `RESEND_FROM_EMAIL` | Optional | Verified sender email address | `orders@yourdomain.com` (defaults to `onboarding@resend.dev`) |

---

## 🌐 Deploying to Vercel

### Automatic Deployment (Recommended)
1. Push changes to GitHub (`main` for production, `develop` for preview).
2. Connect your GitHub repository in Vercel.
3. Configure the Build & Development Settings:
   - **Framework Preset**: Angular
   - **Build Command**: `node scripts/build.js` (or `npx ng build`)
   - **Output Directory**: `dist/hi-tech`
4. Add the `RESEND_API_KEY` and `RESEND_TO_EMAIL` environment variables.
5. Vercel will deploy automatically on every Git push.

### SPA Routing & Security Headers (`vercel.json`)
The application includes a production-ready `vercel.json` configuration:
- Global rewrites ensuring all client routes resolve to `/index.html`.
- Strict HTTP security headers: `X-Content-Type-Options: nosniff`, `X-Frame-Options: SAMEORIGIN`, `X-XSS-Protection: 1; mode=block`, and `Referrer-Policy: strict-origin-when-cross-origin`.
- Caching headers for static assets (`/assets/*`).

---

## 💻 Local Development Setup

```bash
# 1. Clone the repository
git clone https://github.com/BhuvaneshwaranMitrahsoft/HiTech.git
cd HiTech

# 2. Install dependencies
npm install

# 3. Start local development server
npm start
# Application runs at http://localhost:4200/

# 4. Run test suite (130 unit tests)
npm run test:ci

# 5. Run linter
npm run lint

# 6. Build production bundle
npm run build:prod
```

---

## 📄 License & Attribution

Designed and built for **HiTech Mobiles & Spares** by pair programming with Antigravity AI.
