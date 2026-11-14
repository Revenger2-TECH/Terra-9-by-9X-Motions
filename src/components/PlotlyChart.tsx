import React, { useEffect, useRef } from 'react';
import Plotly, { type Config, type Data, type Layout } from 'plotly.js-dist-min';

interface PlotlyChartProps {
  data: Data[];
  layout: Partial<Layout>;
  config?: Partial<Config>;
  className?: string;
  testId?: string;
}

export const PlotlyChart: React.FC<PlotlyChartProps> = ({
  data,
  layout,
  config,
  className = 'w-full h-72',
  testId,
}) => {
  const containerRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    const el = containerRef.current;
    if (!el) return;

    const mergedLayout: Partial<Layout> = {
      paper_bgcolor: 'rgba(11, 15, 25, 0)',
      plot_bgcolor: 'rgba(7, 9, 14, 0.75)',
      font: {
        family: 'JetBrains Mono, monospace',
        color: '#94A3B8',
        size: 11,
      },
      margin: { t: 28, r: 20, b: 44, l: 56 },
      ...layout,
    };

    const mergedConfig: Partial<Config> = {
      responsive: true,
      displayModeBar: true,
      displaylogo: false,
      modeBarButtonsToRemove: ['lasso2d', 'select2d', 'autoScale2d'],
      ...config,
    };

    Plotly.react(el, data, mergedLayout, mergedConfig);

    const observer = new ResizeObserver(() => {
      if (containerRef.current) {
        Plotly.Plots.resize(containerRef.current);
      }
    });
    observer.observe(el);

    return () => {
      observer.disconnect();
    };
  }, [data, layout, config]);

  useEffect(() => {
    const el = containerRef.current;
    return () => {
      if (el) {
        Plotly.purge(el);
      }
    };
  }, []);

  return <div ref={containerRef} className={className} data-testid={testId} />;
};
