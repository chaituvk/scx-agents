# adp-web

Planner dashboard. Next.js 16 App Router + React 19 + Tailwind v4 + Recharts.

```bash
npm install
NEXT_PUBLIC_API_BASE=http://localhost:8000 npm run dev
```

Surfaces:
- `/` - KPI dashboard
- `/forecasts` - history + forecast explorer
- `/replenishment` - order workbench
- `/accuracy` - WAPE/bias by group (requires backtest pipeline to have run)

Data fetching is done from React Server Components (RSC) against the FastAPI
service. Charts are client components because Recharts needs the DOM.
