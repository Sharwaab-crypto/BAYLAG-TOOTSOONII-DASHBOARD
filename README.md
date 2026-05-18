# 📊 KPI Dashboard

Менежментийн хяналтын самбар — Vite + React + Tailwind дээр бүтээгдсэн.

## ✨ Боломжууд

- **KPI Хяналт** — Хэлтэс бүрд карт, өдрийн утга оруулах, period-аар автомат нэгтгэх
- **Бараа нөөц** — Бараа нэмэх, орлогдох, өртөг/зарах үнэ, дотоод код
- **Тооцоо** — Бараа сонгож үнээр тооцоо тулгах, архивлах
- **Нэгдсэн тайлан** — Огноо × карт breakdown, Excel татах
- **Тооцооны томьёо** — Картуудын хооронд +−×÷ үйлдэл

## 🚀 Локалд ажиллуулах

```bash
# 1. Dependency суулгах
npm install

# 2. Хөгжүүлэлтийн серверийг ажиллуулах
npm run dev

# 3. Production build
npm run build

# 4. Build-ийг урьдчилан харах
npm run preview
```

Browser-аар `http://localhost:5173` нээгээрэй.

## 🌐 Deploy хийх

### Сонголт 1: Vercel (хамгийн хялбар, ҮНЭГҮЙ)

1. [vercel.com](https://vercel.com) сайтад GitHub-ээр бүртгүүлнэ
2. Энэ folder-ыг GitHub repo руу push хийнэ:
   ```bash
   git init
   git add .
   git commit -m "Initial commit"
   git remote add origin https://github.com/<USERNAME>/<REPO>.git
   git push -u origin main
   ```
3. Vercel-д "New Project" → GitHub repo сонгох → **Deploy**
4. Хэдхэн секундийн дотор `https://<your-app>.vercel.app` хаягтай болно

**Эсвэл CLI-ээр:**
```bash
npm install -g vercel
vercel
```

### Сонголт 2: Netlify

1. [netlify.com](https://netlify.com) бүртгүүлнэ
2. **"Add new site" → "Deploy manually"**
3. `npm run build` хийгээд `dist` folder-ыг чирж оруулна

Эсвэл GitHub-аар:
- Build command: `npm run build`
- Publish directory: `dist`

### Сонголт 3: GitHub Pages

1. `vite.config.js`-ийн `base`-ийг repo нэрээр өөрчилнө:
   ```js
   base: '/<repo-name>/',
   ```
2. Build хийгээд `dist` folder-ыг `gh-pages` branch руу push:
   ```bash
   npm install -D gh-pages
   ```
3. `package.json`-д script нэмнэ:
   ```json
   "deploy": "gh-pages -d dist"
   ```
4. Build болон deploy:
   ```bash
   npm run build
   npm run deploy
   ```

### Сонголт 4: Cloudflare Pages

1. [pages.cloudflare.com](https://pages.cloudflare.com) бүртгүүлнэ
2. GitHub repo холбоно
3. Build settings:
   - Build command: `npm run build`
   - Output directory: `dist`
4. **Deploy** дарна

### Сонголт 5: Өөрийн серверт (VPS)

```bash
# Build хийх
npm run build

# dist/ folder-ыг сервер рүү хуулах
scp -r dist/* user@server:/var/www/dashboard/

# Nginx config жишээ:
# server {
#   listen 80;
#   server_name your-domain.com;
#   root /var/www/dashboard;
#   index index.html;
#   location / {
#     try_files $uri $uri/ /index.html;
#   }
# }
```

## 📁 Бүтэц

```
kpi-dashboard/
├── public/
│   ├── favicon.svg          # Лого
│   └── _redirects           # Netlify routing
├── src/
│   ├── App.jsx              # App wrapper
│   ├── Dashboard.jsx        # Гол дашбоард компонент
│   ├── main.jsx             # React entry
│   └── index.css            # Tailwind + custom styles
├── index.html               # HTML template
├── package.json
├── vite.config.js
├── tailwind.config.js
├── postcss.config.js
├── vercel.json              # Vercel routing
└── README.md
```

## 🔧 Технологи

- **React 18** — UI
- **Vite 5** — Build tool
- **Tailwind CSS 3** — Styling
- **Recharts** — Graphs (bar, area, pie)
- **Lucide React** — Icons
- **SheetJS (xlsx)** — Excel export

## ⚙️ Тохиргоо

Эхний өгөгдөл `src/Dashboard.jsx`-ийн `useState` хэсэгт байна:
- `departments` — Хэлтэс ба картууд
- `products` — Барааны жагсаалт

Үйлдвэрлэлийн орчинд эдгээрийг **API эсвэл database**-аас татаж авах хэрэгтэй.

### Localstorage-д хадгалах (нэмэлт)

Browser хаагдсаны дараа өгөгдөл алга болохгүй байх бол `useEffect`-аар localStorage руу хадгална. Жишээ:

```jsx
// Дашбоардын эхэнд
const [departments, setDepartments] = useState(() => {
  const saved = localStorage.getItem('kpi-departments');
  return saved ? JSON.parse(saved) : defaultDepartments;
});

useEffect(() => {
  localStorage.setItem('kpi-departments', JSON.stringify(departments));
}, [departments]);
```

`products` болон `reconciliations`-д ч ижил арга.

## 📝 Лиценз

MIT — чөлөөтэй ашиглана.

## 🤝 Хувь нэмэр

Pull request, issue тавихыг хүлээж байна!
