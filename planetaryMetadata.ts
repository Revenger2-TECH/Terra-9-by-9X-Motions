export interface PlanetarySummary {
  datasetId: string;
  sourceFileName: string;
  body: "MOON" | "MARS" | "EARTH";
  metrics: {
    minElevationMeters: number;
    maxElevationMeters: number;
    meanSlopeDeg: number;
    meanSkinTempK: number;
    thermalAnomalyMeanC: number;
  };
}

export const PLANETARY_SUMMARIES: PlanetarySummary[] = [
  {
    datasetId: "Site04_final_adj_5mpp_surf.tiff",
    sourceFileName: "Site04_final_adj_5mpp_surf.tiff",
    body: "MOON",
    metrics: {
      minElevationMeters: -4150,
      maxElevationMeters: 4300,
      meanSlopeDeg: 24.5,
      meanSkinTempK: 95.0,
      thermalAnomalyMeanC: -12.4,
    },
  },
  {
    datasetId: "tmax_tmin_anom.xyz",
    sourceFileName: "tmax_tmin_anom.xyz",
    body: "EARTH",
    metrics: {
      minElevationMeters: -400,
      maxElevationMeters: 6500,
      meanSlopeDeg: 12.1,
      meanSkinTempK: 288.2,
      thermalAnomalyMeanC: 1.15,
    },
  },
  {
    datasetId: "jezero_elevation_mosaic.tiff",
    sourceFileName: "jezero_elevation_mosaic.tiff",
    body: "MARS",
    metrics: {
      minElevationMeters: -2700,
      maxElevationMeters: 1200,
      meanSlopeDeg: 8.5,
      meanSkinTempK: 210.0,
      thermalAnomalyMeanC: 2.8,
    },
  },
];