# NeighborScope - Deployment Instructions

**Your app is ready to deploy! Follow these steps exactly.**

---

## 📋 What You Have

All files needed for deployment:
- ✅ React app code (src/App.jsx)
- ✅ Package configuration (package.json)
- ✅ HTML template (public/index.html)
- ✅ Deployment config (vercel.json)

---

## 🔑 STEP 1: Get Google Maps API Key (30 minutes)

### 1.1 Go to Google Cloud Console
Open: https://console.cloud.google.com/

### 1.2 Create Project
1. Click "**Create Project**" (top bar)
2. Project name: "**NeighborScope**"
3. Click "**Create**"

### 1.3 Enable APIs
1. Click "**APIs & Services**" → "**Library**" (left sidebar)
2. Search and enable each:
   - ✅ **Geocoding API** (search, click, enable)
   - ✅ **Maps JavaScript API** (search, click, enable)
   - ✅ **Places API** (search, click, enable)
   - ✅ **Street View Static API** (search, click, enable)

### 1.4 Create API Key
1. Click "**APIs & Services**" → "**Credentials**"
2. Click "**+ Create Credentials**" → "**API Key**"
3. **COPY YOUR API KEY** (looks like: AIzaSyD...)
4. Click "**Restrict Key**":
   - Application restrictions: "HTTP referrers"
   - Add: `*.vercel.app/*`
   - API restrictions: Select the 4 APIs above
   - Click "**Save**"

### 1.5 Add API Key to Code
1. Open: `src/App.jsx`
2. Find line 5: `const GOOGLE_MAPS_API_KEY = 'YOUR_API_KEY_HERE';`
3. Replace with: `const GOOGLE_MAPS_API_KEY = 'AIzaSyD...';` (your key)
4. **SAVE THE FILE**

---

## 📤 STEP 2: Upload to GitHub (15 minutes)

### 2.1 Create GitHub Account
- Go to: https://github.com/signup
- Create free account (if you don't have one)

### 2.2 Create Repository
1. Go to: https://github.com/new
2. Repository name: "**neighborscope**"
3. Description: "Neighborhood exploration tool for homebuyers"
4. Make it **Public**
5. Do NOT check "Add a README"
6. Click "**Create repository**"

### 2.3 Upload Files
**IMPORTANT: Upload the ENTIRE deployment-package folder contents**

1. On the repository page, click "**uploading an existing file**"
2. **Drag ALL these files** into the upload box:
   - package.json
   - vercel.json
   - .gitignore
   - README.md
   - public/ folder (with index.html inside)
   - src/ folder (with App.jsx and index.js inside)
3. Commit message: "Initial commit"
4. Click "**Commit changes**"

**Your repository structure should look like:**
```
neighborscope/
├── package.json
├── vercel.json
├── .gitignore
├── README.md
├── public/
│   └── index.html
└── src/
    ├── App.jsx
    └── index.js
```

---

## 🚀 STEP 3: Deploy to Vercel (10 minutes)

### 3.1 Sign Up for Vercel
1. Go to: https://vercel.com/signup
2. Click "**Continue with GitHub**"
3. Authorize Vercel

### 3.2 Import Project
1. Click "**Add New**" → "**Project**"
2. Find your "**neighborscope**" repository
3. Click "**Import**"

### 3.3 Configure (Use These Settings)
- **Framework Preset:** Create React App
- **Root Directory:** ./
- **Build Command:** `npm run build` (auto-filled)
- **Output Directory:** build (auto-filled)
- **Install Command:** `npm install` (auto-filled)

### 3.4 Deploy
1. Click "**Deploy**"
2. Wait 2-3 minutes (watch the build logs)
3. When done: "**🎉 Congratulations!**"
4. Click "**Visit**" to see your live site

### 3.5 Save Your URL
Your live site: `https://neighborscope.vercel.app` (or similar)

**WRITE IT DOWN!**

---

## 🧪 STEP 4: Test Your Site (5 minutes)

### Test These:
1. **Open your Vercel URL**
2. **Paste this address:**
   ```
   100 Stewart Avenue, Garden City, NY 11530
   ```
3. **Click "Explore"**
4. **You should see:**
   - ✅ Loading spinner
   - ✅ Map appears
   - ✅ Street View loads
   - ✅ Can click around the map
   - ✅ Can explore in Street View

### If It Works:
**🎉 YOU'RE LIVE! Your app is deployed!**

### If It Doesn't Work:
Check these:
- [ ] Did you add API key to src/App.jsx line 5?
- [ ] Did you upload ALL files to GitHub?
- [ ] Did Vercel build complete without errors?

---

## 📊 STEP 5: Add Google Analytics (30 minutes)

### 5.1 Create Google Analytics Account
1. Go to: https://analytics.google.com/
2. Click "**Start measuring**"
3. Account name: "**NeighborScope**"
4. Property name: "**NeighborScope App**"

### 5.2 Set Up Web Stream
1. Select "**Web**"
2. Website URL: Your Vercel URL
3. Stream name: "**NeighborScope Web**"
4. Click "**Create stream**"

### 5.3 Get Measurement ID
1. Copy your "**Measurement ID**" (G-XXXXXXXXXX)

### 5.4 Add to Your Site
1. Open: `public/index.html`
2. Find: `G-XXXXXXXXXX` (appears twice)
3. Replace BOTH with your Measurement ID
4. Save file
5. **Commit and push to GitHub** (Vercel auto-deploys)

### 5.5 Verify
1. Visit your site
2. Go to Google Analytics → "**Realtime**"
3. You should see yourself as an active user!

---

## ✅ You're Done!

**Your live site:** `https://yourapp.vercel.app`

**What works:**
- ✅ Search any address or Zillow link
- ✅ Explore neighborhoods in Street View
- ✅ Click-to-go navigation
- ✅ Keyboard controls (arrow keys)
- ✅ Full-screen mode
- ✅ Nearby places marked on map
- ✅ Time-of-day insights
- ✅ Analytics tracking

---

## 🎯 Next: Launch It!

**Follow the 7-Day Launch Plan:**
- Day 4: Post on Reddit (r/RealEstate)
- Day 5: Launch on Product Hunt
- Track everything in Google Analytics

See: `7_DAY_LAUNCH_PLAN.md` for complete launch strategy

---

## 🆘 Troubleshooting

### Map Not Loading
- Check: API key in src/App.jsx line 5
- Check: All 4 APIs enabled in Google Cloud
- Check: Billing enabled (even for free tier)

### Vercel Build Failed
- Check: All files uploaded to GitHub
- Check: Folder structure is correct
- Check: package.json exists

### Analytics Not Working
- Check: Measurement ID in public/index.html (2 places)
- Wait 24 hours for data to appear
- Check "Realtime" report first

---

## 📁 File Structure Reference

```
neighborscope/
├── package.json          # Dependencies
├── vercel.json           # Deployment config
├── .gitignore            # Files to ignore
├── README.md             # This file
├── public/
│   └── index.html        # HTML template (add Analytics here)
└── src/
    ├── App.jsx           # Main app code (add API key here)
    └── index.js          # Entry point
```

---

## 🎉 Success!

**You now have:**
- ✅ Live website
- ✅ Professional UI
- ✅ Working maps
- ✅ Analytics tracking
- ✅ Ready to launch

**Time to get users! 🚀**
