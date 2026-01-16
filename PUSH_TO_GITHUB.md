# 🚀 Push to GitHub - Quick Guide

## Step 1: Create Repository on GitHub (One-time Setup)

1. Go to https://github.com/new
2. Fill in:
   - **Repository name**: `toeasy-main` (or your preferred name)
   - **Description**: ToEasy - AI Data Analytics Platform
   - **Privacy**: Choose Public or Private
   - **DO NOT** initialize with README (we already have files)
3. Click "Create repository"
4. Copy the repository URL (e.g., `https://github.com/yourusername/toeasy-main.git`)

## Step 2: Connect Local Repository to GitHub

Replace `YOUR_USERNAME` and `YOUR_REPO_NAME` with your actual values:

```bash
cd E:\toeasy-main-demo

# Add remote
git remote add origin https://github.com/YOUR_USERNAME/YOUR_REPO_NAME.git

# Verify it's added
git remote -v

# Push to GitHub
git branch -M main
git push -u origin main
```

## Alternative: If Remote Already Exists

```bash
# Check what's configured
git remote -v

# Remove wrong remote if needed
git remote remove origin

# Add correct remote
git remote add origin https://github.com/YOUR_USERNAME/YOUR_REPO_NAME.git

# Push
git push -u origin main
```

## Complete Commands to Run Now

```powershell
cd E:\toeasy-main-demo

# 1. Add remote (replace with your GitHub URL)
git remote add origin https://github.com/YOUR_USERNAME/toeasy-main.git

# 2. Verify
git remote -v

# 3. Push everything
git branch -M main
git push -u origin main
```

## What Gets Pushed

✅ All backend code (Express, routes, middleware)
✅ Frontend API client
✅ Database migrations
✅ Configuration files
✅ Docker setup
✅ All documentation (6 guides)
✅ Git history (6 commits)

---

## After Pushing

You can then:
1. Deploy backend to Railway (auto-pull from GitHub)
2. Deploy frontend to Vercel (auto-pull from GitHub)
3. Both will auto-update when you push changes

## Troubleshooting

**Error: "remote origin already exists"**
```bash
git remote remove origin
git remote add origin https://your-repo-url
```

**Error: "Authentication failed"**
- Use personal access token instead of password
- Go to https://github.com/settings/tokens
- Create new token with `repo` scope
- Use token instead of password

**Need help?**
See [DEPLOYMENT.md](./DEPLOYMENT.md) Step 2 for more details
