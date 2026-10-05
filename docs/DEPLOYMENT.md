# Warmup Deployment Guide

Warmup is a fully static client-side web application. It requires no Node.js runtime on the server, no database, and no server-side rendering. The entire application compiles into static HTML, JavaScript, CSS, and font assets in the `dist/` directory.

---

## 1. Deploying to Vercel

Vercel detects Vite projects automatically. Vite's default `/` base path works for this deployment, so no extra base-path configuration or `vercel.json` file is required.

### Via the Vercel Dashboard
1. Import `coder-bat01/Warm-up` from GitHub in the Vercel dashboard.
2. Keep the project root as `./` and select the **Vite** framework preset.
3. Use `npm run build` as the build command and `dist` as the output directory.
4. Click **Deploy**. Vercel will create deployments for future pushes to the configured production branch.

### Via Vercel CLI
```bash
npm i -g vercel
vercel
```

Use `vercel --prod` to deploy a production build from the CLI.

---

## 2. Deploying to Cloudflare Pages

1. In Cloudflare Dashboard, go to **Workers & Pages** → **Create Application** → **Pages** → **Connect to Git**.
2. Select the `Warm-up` repository.
3. Set build configuration:
   - **Framework preset:** Vite
   - **Build command:** `npm run build`
   - **Build output directory:** `dist`
4. Click **Save and Deploy**.

---

## 3. Deploying to Netlify

### Via Netlify CLI
```bash
npm i -g netlify-cli
netlify deploy --prod --dir=dist
```

### Via Netlify Web Dashboard
1. Click **Add new site** → **Import an existing project**.
2. Select GitHub and pick `Warm-up`.
3. Set build settings:
   - **Build command:** `npm run build`
   - **Publish directory:** `dist`
4. Click **Deploy Warmup**.

---

## 4. Self-Hosting (Nginx / Caddy / Docker)

### Nginx Configuration
```nginx
server {
    listen 80;
    server_name warmup.yourdomain.com;
    return 301 https://$host$request_uri;
}

server {
    listen 443 ssl http2;
    server_name warmup.yourdomain.com;

    ssl_certificate /path/to/fullchain.pem;
    ssl_certificate_key /path/to/privkey.pem;

    root /var/www/warmup/dist;
    index index.html;

    # Enable gzip compression for fast loads
    gzip on;
    gzip_types text/plain text/css application/json application/javascript text/xml application/xml application/xml+rss text/javascript image/svg+xml;

    location / {
        try_files $uri $uri/ /index.html;
    }

    # Cache static assets
    location ~* \.(?:ico|css|js|gif|jpe?g|png|woff2?|eot|otf|ttf|svg)$ {
        expires 6M;
        access_log off;
        add_header Cache-Control "public, max-age=15552000, immutable";
    }
}
```

### Caddy Configuration
```caddy
warmup.yourdomain.com {
    root * /var/www/warmup/dist
    file_server
    encode gzip zstd
    try_files {path} /index.html
}
```

---

## 5. Important Browser & Runtime Considerations

### HTTPS is Required for Accurate Timing
Modern web browsers (Chromium, Firefox, Safari) clamp the resolution of `performance.now()` on unencrypted HTTP connections to mitigate micro-architectural timing attacks (Spectre).
- On **HTTPS** (and `localhost`), timer precision is maximized.
- Always serve production deployments over HTTPS.

### Origin Isolation for Stored Scores
Player history (`localStorage`) is strictly partitioned by origin (`protocol + domain + port`).
- Scores earned on `http://localhost:5173` will not appear on `https://your-domain.com`.
- If you change domains, existing user history remains stored on the previous domain.
