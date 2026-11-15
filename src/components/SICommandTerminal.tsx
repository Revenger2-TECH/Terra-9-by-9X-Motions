import React, { useEffect, useMemo, useRef, useState } from 'react';
import {
  AlertTriangle,
  CheckCircle2,
  ChevronDown,
  ChevronRight,
  Compass,
  CornerDownLeft,
  Cpu,
  Loader2,
  MapPin,
  RotateCcw,
  Terminal,
  Wrench,
  X,
} from 'lucide-react';
import type {
  AnalysisRunRecord,
  EarthSite,
  PlanetaryTarget,
  TargetId,
} from '../engine/types';
import {
  parseMarkdownBlocks,
  tokenizeInlineWithCitations,
  type InlineToken,
  type MapCitationTarget,
} from './ui/siMarkdown';

export interface SITraceStep {
  id: string;
  phase: 'planning' | 'tool_call' | 'tool_result' | 'synthesizing';
  title: string;
  detail: string;
  toolName?: string;
  args?: Record<string, unknown>;
  timestampUtc: string;
}

export interface SITerminalMessage {
  id: string;
  role: 'user' | 'model';
  text: string;
  traces?: SITraceStep[];
  model?: string;
  error?: string;
  timestampUtc: string;
}

interface SICommandTerminalProps {
  open: boolean;
  onClose: () => void;
  activeTarget: PlanetaryTarget | null;
  activeTargetId: TargetId;
  earthSites: EarthSite[];
  onFocusLocation: (citation: MapCitationTarget) => void;
  onAnalysisUpdated?: (record: AnalysisRunRecord) => void;
}

const PRESET_PROMPTS = [
  {
    label: 'Rank Jezero Analogs',
    prompt:
      'Run similarity analysis for Jezero Crater (Mars) and explain the top 3 Earth analogs with verified coordinates and dataset provenance.',
  },
  {
    label: 'Query .xyz Thermal Grid',
    prompt:
      'Query tmax_tmin_anom.xyz and planetary DEM metadata summaries, and compare their thermal anomaly and skin temperature ranges.',
  },
  {
    label: 'Shackleton Crater Analogs',
    prompt:
      'Evaluate Shackleton Crater (Moon) against McMurdo Dry Valleys and Ladakh High Plateau, disclosing datum and thermal caveats.',
  },
  {
    label: 'Thermal Guardrail Audit',
    prompt:
      'Run similarity analysis for Jezero using NASA_POWER_AIR_2M mode and explain why 2m air temperature is scientifically incompatible with MODIS LST.',
  },
];

export const SICommandTerminal: React.FC<SICommandTerminalProps> = ({
  open,
  onClose,
  activeTarget,
  activeTargetId,
  earthSites,
  onFocusLocation,
  onAnalysisUpdated,
}) => {
  const [messages, setMessages] = useState<SITerminalMessage[]>([]);
  const [input, setInput] = useState('');
  const [isRunning, setIsRunning] = useState(false);
  const [liveTraces, setLiveTraces] = useState<SITraceStep[]>([]);
  const [expandedTraces, setExpandedTraces] = useState<Record<string, boolean>>({});
  const scrollEndRef = useRef<HTMLDivElement | null>(null);
  const inputRef = useRef<HTMLTextAreaElement | null>(null);
  const abortRef = useRef<AbortController | null>(null);

  useEffect(() => {
    if (open) {
      const timer = setTimeout(() => inputRef.current?.focus(), 120);
      return () => clearTimeout(timer);
    }
  }, [open]);

  useEffect(() => {
    scrollEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages, liveTraces]);

  const toggleTrace = (messageId: string) => {
    setExpandedTraces((prev) => ({ ...prev, [messageId]: !prev[messageId] }));
  };

  const handleReset = () => {
    abortRef.current?.abort();
    setIsRunning(false);
    setLiveTraces([]);
    setMessages([]);
    setExpandedTraces({});
  };

  const handleSubmitPrompt = async (promptOverride?: string) => {
    const trimmed = (promptOverride ?? input).trim();
    if (!trimmed || isRunning) return;

    const userMsg: SITerminalMessage = {
      id: `usr-${Date.now()}`,
      role: 'user',
      text: trimmed,
      timestampUtc: new Date().toISOString(),
    };

    const historyPayload = messages
      .filter((m) => !m.error && m.text.trim().length > 0)
      .slice(-10)
      .map((m) => ({ role: m.role, text: m.text }));

    setMessages((prev) => [...prev, userMsg]);
    if (!promptOverride) setInput('');
    setIsRunning(true);
    setLiveTraces([]);

    const controller = new AbortController();
    abortRef.current = controller;

    const collectedTraces: SITraceStep[] = [];
    let resolvedModel = 'gemini-4-hydrogen';
    let finalAnswer = '';
    let errorText: string | null = null;

    try {
      const res = await fetch('/api/si/agent', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          prompt: trimmed,
          history: historyPayload,
          activeTargetId,
          stream: true,
        }),
        signal: controller.signal,
      });

      const contentType = res.headers.get('content-type') ?? '';

      if (!res.ok && !contentType.includes('ndjson')) {
        const errJson = await res.json().catch(() => ({}));
        throw new Error(errJson.error || `SI Agent returned HTTP ${res.status}.`);
      }

      if (contentType.includes('ndjson') && res.body) {
        const reader = res.body.getReader();
        const decoder = new TextDecoder();
        let buffer = '';

        while (true) {
          const { done, value } = await reader.read();
          if (done) break;
          buffer += decoder.decode(value, { stream: true });
          const lines = buffer.split('\n');
          buffer = lines.pop() ?? '';

          for (const rawLine of lines) {
            const line = rawLine.trim();
            if (!line) continue;
            const evt = JSON.parse(line);
            if (evt.type === 'trace' && evt.step) {
              collectedTraces.push(evt.step as SITraceStep);
              setLiveTraces([...collectedTraces]);
            } else if (evt.type === 'final') {
              finalAnswer = evt.answerMarkdown ?? '';
              resolvedModel = evt.model ?? resolvedModel;
              if (evt.analysisRecord) {
                onAnalysisUpdated?.(evt.analysisRecord as AnalysisRunRecord);
              }
            } else if (evt.type === 'error') {
              errorText = evt.error ?? 'SI Agent execution failed.';
            }
          }
        }
      } else {
        const data = await res.json();
        finalAnswer = data.answerMarkdown ?? '';
        resolvedModel = data.model ?? resolvedModel;
        if (Array.isArray(data.traces)) {
          collectedTraces.push(...data.traces);
        }
        if (data.analysisRecord) {
          onAnalysisUpdated?.(data.analysisRecord as AnalysisRunRecord);
        }
      }
    } catch (err) {
      if (err instanceof Error && err.name === 'AbortError') {
        errorText = 'Investigation aborted by operator.';
      } else {
        errorText =
          err instanceof Error ? err.message : 'Unable to reach TERRA-9 SI orchestrator.';
      }
    } finally {
      setIsRunning(false);
      setLiveTraces([]);
      abortRef.current = null;
    }

    const assistantId = `si-${Date.now()}`;
    const assistantMsg: SITerminalMessage = {
      id: assistantId,
      role: 'model',
      text: errorText ? '' : finalAnswer || 'No output returned by SI orchestrator.',
      traces: collectedTraces,
      model: resolvedModel,
      error: errorText ?? undefined,
      timestampUtc: new Date().toISOString(),
    };

    setMessages((prev) => [...prev, assistantMsg]);
    setExpandedTraces((prev) => ({ ...prev, [assistantId]: Boolean(errorText) }));
  };

  if (!open) return null;

  return (
    <aside
      aria-label="TERRA-9 SI Command Terminal"
      data-testid="si-command-terminal"
      className="fixed inset-y-0 right-0 z-50 w-full sm:w-[490px] lg:w-[540px] p-3 sm:p-4 flex flex-col pointer-events-none"
    >
      <div className="t9-glass-panel pointer-events-auto flex-1 rounded-2xl border border-cyan-400/25 bg-[#04060A]/90 shadow-[0_24px_80px_rgba(0,0,0,0.75)] flex flex-col overflow-hidden">
        {/* Terminal Top Header */}
        <div className="px-4 py-3.5 border-b border-white/[0.08] bg-[#04060A]/80 flex items-center justify-between gap-3">
          <div className="flex items-center gap-2.5 min-w-0">
            <div className="w-8 h-8 rounded-lg bg-cyan-400/12 border border-cyan-400/35 flex items-center justify-center shrink-0">
              <Terminal className="w-4 h-4 text-[#22D3EE]" />
            </div>
            <div className="min-w-0">
              <div className="flex items-center gap-2">
                <h2 className="font-display text-sm font-semibold text-white tracking-tight truncate">
                  SI Command Terminal
                </h2>
              </div>
              <div className="font-mono text-[10px] text-slate-400 flex items-center gap-1.5 truncate">
                <span className="text-[#22D3EE]">ReAct Orchestrator</span>
                <span aria-hidden="true">·</span>
                <span>
                  {activeTarget ? `${activeTarget.body} ${activeTarget.name}` : 'Standby'}
                </span>
              </div>
            </div>
          </div>

          <div className="flex items-center gap-1.5 shrink-0">
            <button
              type="button"
              onClick={handleReset}
              aria-label="Reset SI Terminal conversation"
              className="px-2.5 py-1.5 rounded-lg bg-white/[0.04] border border-white/10 hover:border-white/25 text-slate-300 hover:text-white font-mono text-[11px] inline-flex items-center gap-1.5 cursor-pointer whitespace-nowrap"
            >
              <RotateCcw className="w-3 h-3" />
              <span>Clear</span>
            </button>
            <button
              type="button"
              onClick={onClose}
              aria-label="Close SI Command Terminal"
              className="p-1.5 rounded-lg bg-white/[0.04] border border-white/10 hover:border-cyan-400/50 text-slate-300 hover:text-white cursor-pointer"
            >
              <X className="w-4 h-4" />
            </button>
          </div>
        </div>

        {/* Preset Scientific Queries Bar */}
        <div className="px-4 py-2.5 border-b border-white/[0.06] bg-[#060910]/85 flex flex-wrap items-center gap-1.5">
          {PRESET_PROMPTS.map((preset) => (
            <button
              key={preset.label}
              type="button"
              disabled={isRunning}
              onClick={() => handleSubmitPrompt(preset.prompt)}
              className="px-2.5 py-1 rounded-md bg-white/[0.04] hover:bg-cyan-400/12 border border-white/[0.08] hover:border-cyan-400/40 text-slate-300 hover:text-[#22D3EE] disabled:opacity-45 font-mono text-[11px] transition-colors cursor-pointer whitespace-nowrap shrink-0"
            >
              {preset.label}
            </button>
          ))}
        </div>

        {/* Scrollable Transcript & Reasoning Stream */}
        <div className="flex-1 overflow-y-auto px-4 py-4 space-y-4">
          {messages.length === 0 && !isRunning && (
            <div className="rounded-xl border border-white/[0.07] bg-[#04060A]/75 p-4 space-y-3">
              <div className="flex items-center gap-2 font-mono text-xs text-[#22D3EE]">
                <Cpu className="w-4 h-4" />
                <span>Autonomous Geospatial & Analog Agent Ready</span>
              </div>
              <p className="text-xs text-slate-300 leading-relaxed">
                Ask TERRA-9 SI to compute weighted analog distance rankings, inspect{' '}
                <code className="font-mono text-[#22D3EE] bg-white/[0.05] px-1 py-0.5 rounded">
                  tmax_tmin_anom.xyz
                </code>{' '}
                and planetary DEM summaries, or audit thermal measurement compatibility. Click any
                cited analog site or coordinate in the answer to pan and zoom the WGS84 map.
              </p>
              <div className="pt-2 border-t border-white/[0.06] font-mono text-[11px] text-slate-400 flex flex-wrap items-center gap-2">
                <span>Tools: run_similarity_analysis</span>
                <span aria-hidden="true">·</span>
                <span>query_dataset_metadata</span>
                <span aria-hidden="true">·</span>
                <span>WGS84 & LST guardrails active</span>
              </div>
            </div>
          )}

          {messages.map((msg) => (
            <div key={msg.id} className="space-y-2">
              {msg.role === 'user' ? (
                <div className="rounded-xl border border-cyan-400/25 bg-cyan-400/[0.07] px-3.5 py-2.5 space-y-1">
                  <div className="flex items-center justify-between font-mono text-[10px] text-[#22D3EE]">
                    <span>Operator Prompt</span>
                    <span className="text-slate-500 tabular-nums">
                      {msg.timestampUtc.slice(11, 19)} UTC
                    </span>
                  </div>
                  <p className="text-xs text-slate-100 leading-relaxed whitespace-pre-wrap">
                    {msg.text}
                  </p>
                </div>
              ) : (
                <div className="rounded-xl border border-white/[0.08] bg-[#060910]/90 p-3.5 space-y-3">
                  <div className="flex items-center justify-between gap-2 font-mono text-[10px] text-slate-400 border-b border-white/[0.06] pb-2">
                    <span className="text-[#22D3EE] font-semibold">
                      TERRA-9 SI Synthesis
                    </span>
                    <div className="flex items-center gap-2 tabular-nums">
                      {msg.model && <span>{msg.model}</span>}
                      <span aria-hidden="true">·</span>
                      <span>{msg.timestampUtc.slice(11, 19)} UTC</span>
                    </div>
                  </div>

                  {/* Reasoning & Tool Trace Accordion */}
                  {msg.traces && msg.traces.length > 0 && (
                    <div className="rounded-lg border border-white/[0.07] bg-[#04060A]/80 overflow-hidden">
                      <button
                        type="button"
                        onClick={() => toggleTrace(msg.id)}
                        aria-expanded={Boolean(expandedTraces[msg.id])}
                        className="w-full px-3 py-2 flex items-center justify-between gap-2 font-mono text-[11px] text-slate-300 hover:text-white cursor-pointer"
                      >
                        <span className="inline-flex items-center gap-2">
                          {expandedTraces[msg.id] ? (
                            <ChevronDown className="w-3.5 h-3.5 text-[#22D3EE]" />
                          ) : (
                            <ChevronRight className="w-3.5 h-3.5 text-slate-400" />
                          )}
                          <span>Reasoning & Tool Execution Log</span>
                        </span>
                        <span className="text-slate-500 tabular-nums">
                          {msg.traces.length} step{msg.traces.length === 1 ? '' : 's'}
                        </span>
                      </button>

                      {expandedTraces[msg.id] && (
                        <div className="border-t border-white/[0.06] px-3 py-2 space-y-2">
                          {msg.traces.map((step) => (
                            <TraceStepRow key={step.id} step={step} />
                          ))}
                        </div>
                      )}
                    </div>
                  )}

                  {msg.error ? (
                    <div className="rounded-lg border border-rose-500/40 bg-rose-500/10 p-3 flex items-start gap-2.5 text-xs text-rose-200">
                      <AlertTriangle className="w-4 h-4 text-rose-400 shrink-0 mt-0.5" />
                      <div className="space-y-1">
                        <div className="font-mono text-[11px] font-semibold text-rose-300">
                          Execution Error
                        </div>
                        <p className="leading-relaxed">{msg.error}</p>
                      </div>
                    </div>
                  ) : (
                    <InteractiveMarkdown
                      markdown={msg.text}
                      sites={earthSites}
                      onFocusLocation={onFocusLocation}
                    />
                  )}
                </div>
              )}
            </div>
          ))}

          {/* Live Streaming Reasoning Log */}
          {isRunning && (
            <div
              data-testid="si-live-reasoning-log"
              className="rounded-xl border border-cyan-400/35 bg-[#060A12]/95 p-3.5 space-y-2.5"
            >
              <div className="flex items-center justify-between font-mono text-[11px] text-[#22D3EE]">
                <span className="inline-flex items-center gap-2">
                  <Loader2 className="w-3.5 h-3.5 animate-spin" />
                  <span>Live ReAct Reasoning Log</span>
                </span>
                <span className="text-slate-400 tabular-nums">
                  {liveTraces.length} step{liveTraces.length === 1 ? '' : 's'}
                </span>
              </div>

              <div className="space-y-2 border-t border-white/[0.06] pt-2">
                {liveTraces.length === 0 ? (
                  <div className="font-mono text-[11px] text-slate-400">
                    Dispatching prompt to Gemini SI orchestrator...
                  </div>
                ) : (
                  liveTraces.map((step) => <TraceStepRow key={step.id} step={step} />)
                )}
              </div>
            </div>
          )}

          <div ref={scrollEndRef} />
        </div>

        {/* Bottom Command Input */}
        <form
          onSubmit={(e) => {
            e.preventDefault();
            handleSubmitPrompt();
          }}
          className="p-3.5 border-t border-white/[0.08] bg-[#04060A]/90 space-y-2"
        >
          <label htmlFor="si-terminal-input" className="sr-only">
            Enter scientific query for TERRA-9 SI Agent
          </label>
          <div className="flex items-end gap-2">
            <textarea
              ref={inputRef}
              id="si-terminal-input"
              rows={2}
              value={input}
              disabled={isRunning}
              onChange={(e) => setInput(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === 'Enter' && !e.shiftKey) {
                  e.preventDefault();
                  handleSubmitPrompt();
                }
              }}
              placeholder="Ask SI to rank analogs, query .xyz grids, or audit thermal data..."
              className="flex-1 resize-none rounded-xl bg-[#070B13] border border-white/12 focus:border-[#22D3EE] focus:outline-none px-3 py-2 font-mono text-xs text-slate-100 placeholder:text-slate-500 leading-relaxed"
            />
            <button
              type="submit"
              disabled={isRunning || input.trim().length === 0}
              className="h-[54px] px-4 rounded-xl bg-[#22D3EE] hover:bg-cyan-300 disabled:opacity-45 text-slate-950 font-display text-xs font-semibold inline-flex items-center gap-1.5 cursor-pointer whitespace-nowrap shrink-0 transition-colors"
            >
              {isRunning ? (
                <>
                  <Loader2 className="w-3.5 h-3.5 animate-spin" />
                  <span>Running</span>
                </>
              ) : (
                <>
                  <span>Execute</span>
                  <CornerDownLeft className="w-3.5 h-3.5" />
                </>
              )}
            </button>
          </div>
          <div className="flex items-center justify-between gap-2 font-mono text-[10px] text-slate-500">
            <span className="truncate">Enter to run · Shift+Enter for newline</span>
            <span className="truncate">Click cited sites or coords to pan map</span>
          </div>
        </form>
      </div>
    </aside>
  );
};

const TraceStepRow: React.FC<{ step: SITraceStep }> = ({ step }) => {
  const Icon =
    step.phase === 'planning'
      ? Compass
      : step.phase === 'tool_call'
      ? Wrench
      : step.phase === 'tool_result'
      ? CheckCircle2
      : Cpu;

  const toneClass =
    step.phase === 'planning'
      ? 'text-sky-400'
      : step.phase === 'tool_call'
      ? 'text-amber-400'
      : step.phase === 'tool_result'
      ? 'text-emerald-400'
      : 'text-[#22D3EE]';

  return (
    <div className="flex items-start gap-2 font-mono text-[11px]">
      <Icon className={`w-3.5 h-3.5 shrink-0 mt-0.5 ${toneClass}`} />
      <div className="min-w-0 flex-1 space-y-0.5">
        <div className="flex items-center justify-between gap-2">
          <span className={`font-semibold ${toneClass}`}>{step.title}</span>
          <span className="text-[10px] text-slate-500 tabular-nums shrink-0">
            {step.timestampUtc.slice(11, 19)}
          </span>
        </div>
        <div className="text-[11px] text-slate-400 break-words leading-snug">
          {step.detail}
        </div>
      </div>
    </div>
  );
};

const InteractiveMarkdown: React.FC<{
  markdown: string;
  sites: EarthSite[];
  onFocusLocation: (citation: MapCitationTarget) => void;
}> = ({ markdown, sites, onFocusLocation }) => {
  const blocks = useMemo(() => parseMarkdownBlocks(markdown), [markdown]);

  return (
    <div className="space-y-2.5 text-xs text-slate-200 leading-relaxed">
      {blocks.map((block, idx) => {
        if (block.type === 'hr') {
          return <hr key={idx} className="border-0 border-t border-white/[0.08] my-2" />;
        }

        if (block.type === 'heading') {
          const cls =
            block.level === 1
              ? 'font-display text-base font-bold text-white pt-1'
              : block.level === 2
              ? 'font-display text-sm font-semibold text-white pt-1'
              : 'font-mono text-xs font-semibold text-[#22D3EE] uppercase tracking-wider pt-1';
          return (
            <div key={idx} className={cls}>
              <InlineTokensView
                text={block.text}
                sites={sites}
                onFocusLocation={onFocusLocation}
              />
            </div>
          );
        }

        if (block.type === 'code') {
          return (
            <pre
              key={idx}
              className="rounded-lg bg-[#04060A] border border-white/[0.08] p-2.5 overflow-x-auto font-mono text-[11px] text-cyan-200"
            >
              <code>{block.code}</code>
            </pre>
          );
        }

        if (block.type === 'table') {
          return (
            <div
              key={idx}
              className="overflow-x-auto rounded-lg border border-white/[0.08] bg-[#04060A]/70"
            >
              <table className="w-full text-left border-collapse font-mono text-[11px]">
                <thead>
                  <tr className="border-b border-white/[0.08] text-slate-400">
                    {block.headers.map((h, hIdx) => (
                      <th key={hIdx} className="px-2.5 py-2 font-semibold whitespace-nowrap">
                        {h}
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody className="divide-y divide-white/[0.05]">
                  {block.rows.map((row, rIdx) => (
                    <tr key={rIdx} className="hover:bg-white/[0.03]">
                      {row.map((cell, cIdx) => (
                        <td key={cIdx} className="px-2.5 py-1.5 text-slate-200 tabular-nums">
                          <InlineTokensView
                            text={cell}
                            sites={sites}
                            onFocusLocation={onFocusLocation}
                          />
                        </td>
                      ))}
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          );
        }

        if (block.type === 'list') {
          const Tag = block.ordered ? 'ol' : 'ul';
          return (
            <Tag
              key={idx}
              className={`space-y-1.5 pl-4 ${
                block.ordered ? 'list-decimal' : 'list-disc'
              } marker:text-[#22D3EE]`}
            >
              {block.items.map((item, itemIdx) => (
                <li key={itemIdx} className="pl-1">
                  <InlineTokensView
                    text={item}
                    sites={sites}
                    onFocusLocation={onFocusLocation}
                  />
                </li>
              ))}
            </Tag>
          );
        }

        return (
          <p key={idx}>
            <InlineTokensView
              text={block.text}
              sites={sites}
              onFocusLocation={onFocusLocation}
            />
          </p>
        );
      })}
    </div>
  );
};

const InlineTokensView: React.FC<{
  text: string;
  sites: EarthSite[];
  onFocusLocation: (citation: MapCitationTarget) => void;
}> = ({ text, sites, onFocusLocation }) => {
  const tokens: InlineToken[] = useMemo(
    () => tokenizeInlineWithCitations(text, sites),
    [text, sites]
  );

  return (
    <>
      {tokens.map((tok, i) => {
        if (tok.type === 'bold') {
          return (
            <strong key={i} className="font-semibold text-white">
              {tok.value}
            </strong>
          );
        }
        if (tok.type === 'code') {
          return (
            <code
              key={i}
              className="font-mono text-[11px] text-[#22D3EE] bg-white/[0.06] px-1 py-0.5 rounded"
            >
              {tok.value}
            </code>
          );
        }
        if (tok.type === 'citation') {
          return (
            <button
              key={i}
              type="button"
              onClick={() => onFocusLocation(tok.citation)}
              title={`Focus map on ${tok.citation.label} (${tok.citation.lat.toFixed(2)}, ${tok.citation.lon.toFixed(2)})`}
              className="inline-flex items-center gap-1 mx-0.5 px-1.5 py-0.5 rounded bg-cyan-400/12 border border-cyan-400/35 hover:bg-cyan-400/25 hover:border-[#22D3EE] text-[#22D3EE] font-mono text-[11px] underline decoration-cyan-400/40 underline-offset-2 cursor-pointer transition-colors align-baseline"
            >
              <MapPin className="w-3 h-3 shrink-0" />
              <span>{tok.label}</span>
            </button>
          );
        }
        return <React.Fragment key={i}>{tok.value}</React.Fragment>;
      })}
    </>
  );
};
