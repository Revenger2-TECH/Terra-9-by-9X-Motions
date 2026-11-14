import React from 'react';

interface SegmentedMetricBarProps {
  value: number | null; // 0 to 1
  segments?: number;
  label?: string;
}

export const SegmentedMetricBar: React.FC<SegmentedMetricBarProps> = ({
  value,
  segments = 16,
  label,
}) => {
  if (value === null || !Number.isFinite(value)) {
    return (
      <div className="flex items-center gap-2.5">
        <div className="flex items-center gap-[3px]" aria-label={label ?? 'Data unavailable'}>
          {Array.from({ length: segments }).map((_, idx) => (
            <span
              key={idx}
              className="inline-block h-2 w-1.5 rounded-[2px] bg-white/[0.06]"
            />
          ))}
        </div>
        <span className="font-mono text-[11px] text-amber-400 uppercase tracking-wider">
          Insufficient
        </span>
      </div>
    );
  }

  const clamped = Math.max(0, Math.min(1, value));
  const filledCount = Math.round(clamped * segments);

  return (
    <div className="flex items-center gap-3">
      <div
        className="flex items-center gap-[3px]"
        role="meter"
        aria-valuenow={Math.round(clamped * 100)}
        aria-valuemin={0}
        aria-valuemax={100}
        aria-label={label ?? 'Similarity index'}
      >
        {Array.from({ length: segments }).map((_, idx) => {
          const active = idx < filledCount;
          let colorClass = 'bg-white/[0.07]';
          if (active) {
            if (clamped >= 0.72) {
              colorClass = 'bg-cyan-400 shadow-[0_0_8px_rgba(34,211,238,0.35)]';
            } else if (clamped >= 0.5) {
              colorClass = 'bg-sky-400';
            } else {
              colorClass = 'bg-amber-400';
            }
          }
          return (
            <span
              key={idx}
              className={`inline-block h-2 w-1.5 rounded-[2px] transition-colors ${colorClass}`}
            />
          );
        })}
      </div>
      <span className="font-mono text-xs font-semibold text-slate-50 tabular-nums">
        {(clamped * 100).toFixed(1)}%
      </span>
    </div>
  );
};

interface StatusIndicatorProps {
  tone: 'nominal' | 'cyan' | 'amber' | 'error' | 'muted';
  label: string;
}

export const StatusIndicator: React.FC<StatusIndicatorProps> = ({ tone, label }) => {
  const toneMap = {
    nominal: { box: 'bg-emerald-400', text: 'text-emerald-400' },
    cyan: { box: 'bg-cyan-400', text: 'text-cyan-400' },
    amber: { box: 'bg-amber-400', text: 'text-amber-400' },
    error: { box: 'bg-rose-400', text: 'text-rose-400' },
    muted: { box: 'bg-slate-500', text: 'text-slate-400' },
  }[tone];

  return (
    <span className="inline-flex items-center gap-1.5 font-mono text-[11px] font-medium tracking-wide whitespace-nowrap shrink-0">
      <span className={`inline-block h-1.5 w-1.5 rounded-xs ${toneMap.box}`} aria-hidden="true" />
      <span className={toneMap.text}>{label}</span>
    </span>
  );
};

interface ModuleCardProps {
  title: string;
  subtitle?: string;
  moduleCode?: string;
  rightSlot?: React.ReactNode;
  children: React.ReactNode;
  className?: string;
}

export const ModuleCard: React.FC<ModuleCardProps> = ({
  title,
  subtitle,
  rightSlot,
  children,
  className = '',
}) => {
  return (
    <section
      className={`rounded-2xl bg-[#0B101B]/85 backdrop-blur-md border border-white/[0.08] shadow-[inset_0_1px_0_0_rgba(255,255,255,0.04)] flex flex-col overflow-hidden ${className}`}
    >
      <header className="flex flex-wrap items-center justify-between gap-3 px-5 py-3.5 border-b border-white/[0.06]">
        <div className="min-w-0">
          <h2 className="font-display text-sm font-semibold tracking-tight text-slate-100 truncate">
            {title}
          </h2>
          {subtitle && (
            <p className="text-xs text-slate-400 mt-0.5 truncate">{subtitle}</p>
          )}
        </div>
        {rightSlot && <div className="flex items-center gap-3 shrink-0">{rightSlot}</div>}
      </header>
      <div className="p-5 flex-1">{children}</div>
    </section>
  );
};
