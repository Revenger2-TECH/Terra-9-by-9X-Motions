# TERRA-9 — Earth Analog Intelligence System

**Developed by 9X MOTIONS**  
*Beyond Earth. Grounded in Data. Driven by Discovery.*  
Context: NASA Space Apps Challenge 2026 (Independent research platform; no NASA endorsement implied).

---

## Overview

TERRA-9 identifies, evaluates, and ranks terrestrial analog locations that exhibit measurable geomorphological, thermal, and climatological similarities to selected lunar and Martian planetary targets:

- **Moon:** Shackleton Crater / Lunar South Polar Region (`89.54°S, 129.78°E`)
- **Mars:** Jezero Crater (`18.38°N, 77.58°E`)

Candidate Earth regions include Atacama Desert (Chile), Ladakh High Plateau (India), McMurdo Dry Valleys (Antarctica), Death Valley (USA), Icelandic Volcanic Highlands (Iceland), Namib Desert (Namibia), Mauna Kea Volcanic Zone (USA), and Salar de Uyuni Basin (Bolivia), plus custom researcher-ingested CSV/JSON datasets.

---

## Architecture

- **Frontend:** React 19, TypeScript, Tailwind CSS v4, Plotly (`plotly.js-dist-min`), Leaflet (offline-guaranteed vector continent + graticule rendering), `jsPDF` (PDF dossier generation).
- **Backend:** Express (`server.ts`) serving Vite in development and static `dist/` in production on port `3000`.
- **Scientific Similarity Core (`src/engine/similarity.ts`):** Deterministic, explainable weighted feature-distance engine with strict unit/measurement-type validation, zero-imputation prohibition, and proportional weight renormalization.

---

## REST API Endpoints

| Method | Endpoint | Description |
| :--- | :--- | :--- |
| `GET` | `/api/health` | Backend health, methodology version, dataset & site counts |
| `GET` | `/api/targets` | Lunar & Martian planetary target specifications |
| `GET` | `/api/datasets` | Scientific dataset provenance registry |
| `POST` | `/api/datasets/ingest` | Validate & register local CSV/JSON terrestrial candidate datasets |
| `GET` | `/api/earth-sites` | Registered Earth candidate sites and measurements |
| `POST` | `/api/analysis/run` | Execute weighted feature-distance similarity analysis |
| `GET` | `/api/analysis/latest` | Retrieve latest analysis run for a target |
| `GET` | `/api/analysis/:analysisId` | Retrieve specific analysis run by ID |
| `GET` | `/api/analysis/:analysisId/explanation` | Retrieve feature-level explanation for a candidate site |
| `GET` | `/api/reports` | List generated scientific dossiers |
| `POST` | `/api/reports/generate` | Generate traceable scientific dossier from an analysis run |
| `GET` | `/api/reports/:reportId` | Retrieve report by ID |
| `GET` | `/api/external/nasa-power` | Live query proxy to NASA POWER climatology point API |

---

## Local Dataset Integration (CSV Schema)

Upload or paste CSV datasets in **05 — Data Intelligence** using the following header format (`NA` / `NULL` / empty values are preserved as missing and excluded without zero-imputation):

```csv
site_name,country,lat,lon,elevation_m,slope_deg,surface_temp_k,precipitation_mm_yr,solar_irradiance_wm2
Rio Tinto Basin,Spain,37.70,-6.55,340,8.1,296.5,580,210
Chajnantor Plateau,Chile,-23.02,-67.75,5058,4.2,276.4,NA,295
```

---

## Running & Testing

```bash
npm install
npm test      # Runs unit tests in src/engine/similarity.test.ts
npm run lint  # TypeScript check (tsc --noEmit)
npm run build # Production Vite bundle
npm run dev   # Starts Express + Vite full-stack server on port 3000
```
