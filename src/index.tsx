import React from 'react';
import type { PluginComponentProps } from './hs-plugin';

const PLUGIN_ID = 'flag-status';
const FLAGWATCH_URL = 'https://flagwatch.net/api/v1/';

interface FlagData {
  status: 'full-staff' | 'half-staff';
  reason?: string;
  orderFrom?: string;
  url?: string;
}

interface FlagWatchItem {
  start_date: string;
  end_date: string;
  reason: string;
  order_from: string;
  url: string;
}

/**
 * Transform FlagWatch API response into our FlagData shape.
 * Compares today's date (Eastern time, where federal proclamations are issued)
 * against each item's start/end dates to find active proclamations.
 */
function transformFlagData(raw: unknown): FlagData {
  const items = (raw as { items?: FlagWatchItem[] }).items ?? [];
  const today = new Intl.DateTimeFormat('en-CA', { timeZone: 'America/New_York' }).format(new Date());

  const active = items.find((item) => {
    const start = item.start_date;
    const end = item.end_date || start; // empty end_date = single day
    return today >= start && today <= end;
  });

  if (active) {
    return {
      status: 'half-staff',
      reason: active.reason,
      orderFrom: active.order_from,
      url: active.url,
    };
  }

  return { status: 'full-staff' };
}

/** Fetch flag status via the plugin proxy with polling. */
function useFlagData(refreshMs: number): [FlagData | null, string | null] {
  const [data, setData] = React.useState<FlagData | null>(null);
  const [error, setError] = React.useState<string | null>(null);

  React.useEffect(() => {
    let cancelled = false;
    let inFlight = false;

    async function fetchData() {
      if (inFlight) return;
      inFlight = true;
      try {
        const res = await window.__HS_SDK__.pluginFetch(PLUGIN_ID, {
          url: FLAGWATCH_URL,
          cacheTtlMs: 1_800_000, // 30 min server-side cache
        });
        if (cancelled) return;
        if (res.ok) {
          const raw = await res.json();
          if (cancelled) return;
          setData(transformFlagData(raw));
          setError(null);
        } else {
          setError(`HTTP ${res.status}`);
        }
      } catch {
        if (!cancelled) setError('Failed to fetch flag status');
      } finally {
        inFlight = false;
      }
    }

    fetchData();
    const id = setInterval(fetchData, refreshMs);
    return () => { cancelled = true; clearInterval(id); };
  }, [refreshMs]);

  return [data, error];
}

function FlagVisual({ isHalfStaff }: { isHalfStaff: boolean }) {
  const flagW = 70;
  const flagH = 37;
  const poleX = 15;
  const poleTop = 10;
  const poleBottom = 190;
  const finialR = 5;

  const fullStaffY = poleTop + finialR * 2 + 2;
  const halfStaffY = (poleTop + poleBottom) / 2;
  const flagY = isHalfStaff ? halfStaffY : fullStaffY;

  const stripeH = flagH / 13;
  const cantonW = flagW * 0.4;
  const cantonH = stripeH * 7;

  return (
    <svg viewBox="0 0 120 200" style={{ width: '100%', height: 'auto', maxHeight: '60%' }}>
      {/* Flagpole */}
      <line
        x1={poleX} y1={poleTop + finialR}
        x2={poleX} y2={poleBottom}
        stroke="#9ca3af" strokeWidth={3} strokeLinecap="round"
      />
      {/* Gold finial ball */}
      <circle cx={poleX} cy={poleTop + finialR} r={finialR} fill="#d4a017" />

      {/* Flag group with transition */}
      <g style={{ transition: 'transform 1.5s ease-in-out', transform: `translateY(${flagY}px)` }}>
        {/* 13 stripes */}
        {Array.from({ length: 13 }, (_, i) => (
          <rect
            key={i}
            x={poleX + 1}
            y={i * stripeH}
            width={flagW}
            height={stripeH}
            fill={i % 2 === 0 ? '#b91c1c' : '#ffffff'}
          />
        ))}
        {/* Blue canton */}
        <rect x={poleX + 1} y={0} width={cantonW} height={cantonH} fill="#1e3a5f" />
        {/* Simplified star grid (5 rows x 6 cols) */}
        {Array.from({ length: 5 }, (_, row) =>
          Array.from({ length: 6 }, (_, col) => (
            <text
              key={`${row}-${col}`}
              x={poleX + 1 + cantonW * (col + 0.5) / 6}
              y={cantonH * (row + 0.55) / 5}
              fontSize={3.2}
              fill="#ffffff"
              textAnchor="middle"
              dominantBaseline="central"
            >
              *
            </text>
          ))
        )}
      </g>
    </svg>
  );
}

// Named export forces Rollup to produce an object ({ default: ... }) rather than
// assigning the default export directly to the IIFE global. The plugin loader
// reads window.__HS_PLUGIN__['default'], which requires the object form.
export const pluginId = PLUGIN_ID;

export default function FlagStatusPlugin({ config, style }: PluginComponentProps) {
  const showReason = config.showReason !== false;
  const refreshMin = (config.refreshIntervalMin as number) || 30;
  const refreshMs = refreshMin * 60_000;

  const { ModuleLoadingState } = window.__HS_SDK__;
  const [data, error] = useFlagData(refreshMs);

  // Module wrapper styles — plugins must apply these on the root element
  const wrapperStyle: React.CSSProperties = {
    width: '100%',
    height: '100%',
    overflow: 'hidden',
    fontFamily: style.fontFamily,
    fontSize: style.fontSize,
    color: style.textColor,
    backgroundColor: style.backgroundColor,
    borderRadius: style.borderRadius,
    padding: style.padding,
    opacity: style.opacity,
    backdropFilter: `blur(${style.backdropBlur ?? 0}px)`,
    WebkitBackdropFilter: `blur(${style.backdropBlur ?? 0}px)`,
    boxSizing: 'border-box',
  };

  if (data === null) {
    return (
      <div style={wrapperStyle}>
        <ModuleLoadingState loading={!error} error={error ?? undefined}>
          {null}
        </ModuleLoadingState>
      </div>
    );
  }

  const isHalfStaff = data.status === 'half-staff';

  return (
    <div style={wrapperStyle}>
      <div style={{
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        justifyContent: 'center',
        height: '100%',
        gap: 8,
      }}>
        <FlagVisual isHalfStaff={isHalfStaff} />
        <p style={{
          textAlign: 'center',
          fontWeight: 500,
          fontSize: style.fontSize * 1.1,
          margin: 0,
        }}>
          {isHalfStaff ? 'Half-Staff' : 'Full Staff'}
        </p>
        {isHalfStaff && showReason && data.reason && (
          <p style={{
            textAlign: 'center',
            opacity: 0.7,
            lineHeight: 1.375,
            fontSize: style.fontSize * 0.8,
            margin: 0,
          }}>
            {data.reason}
          </p>
        )}
      </div>
    </div>
  );
}
