import React, { useMemo } from 'react';
import {
  LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, ReferenceLine,
  RadarChart, PolarGrid, PolarAngleAxis, Radar, Legend,
  BarChart, Bar, Cell,
} from 'recharts';
import type { PerformanceLog } from '../../services/api';
import './PerformanceCharts.css';

interface Props {
  logs: PerformanceLog[];
  cohortLogs: PerformanceLog[];
}

// ── helpers ────────────────────────────────────────────────────────────────

function scoreColor(score: number): string {
  if (score >= 75) return 'var(--color-success)';
  if (score >= 50) return 'var(--color-warning)';
  return 'var(--color-danger)';
}

function extractRubricAverages(logs: PerformanceLog[]): Record<string, number> {
  const totals: Record<string, number> = {};
  const counts: Record<string, number> = {};
  for (const log of logs) {
    if (!log.rubric) continue;
    for (const [key, val] of Object.entries(log.rubric)) {
      if (typeof val === 'number') {
        totals[key] = (totals[key] ?? 0) + val;
        counts[key] = (counts[key] ?? 0) + 1;
      }
    }
  }
  return Object.fromEntries(
    Object.keys(totals).map(k => [k, Math.round(totals[k] / counts[k])])
  );
}

function formatCategory(key: string): string {
  return key.replace(/_/g, ' ').replace(/\b\w/g, c => c.toUpperCase());
}

// ── custom tooltip ──────────────────────────────────────────────────────────

const ChartTooltip: React.FC<any> = ({ active, payload, label }) => {
  if (!active || !payload?.length) return null;
  return (
    <div className="chart-tooltip">
      <p className="chart-tooltip__label">{label}</p>
      {payload.map((p: any) => (
        <p key={p.dataKey} className="chart-tooltip__item" style={{ color: p.color }}>
          {p.name}: <strong>{p.value}</strong>
        </p>
      ))}
    </div>
  );
};

// ── main component ──────────────────────────────────────────────────────────

const PerformanceCharts: React.FC<Props> = ({ logs, cohortLogs }) => {
  const hasCohort = cohortLogs.length > 0;

  // 1. Score trend — sorted by date or pr_number
  const trendData = useMemo(() => {
    return [...logs]
      .sort((a, b) => {
        if (a.created_at && b.created_at) return new Date(a.created_at).getTime() - new Date(b.created_at).getTime();
        return (a.pr_number ?? 0) - (b.pr_number ?? 0);
      })
      .map(log => ({
        label: `PR #${log.pr_number ?? '?'}`,
        score: log.score,
        date: log.created_at ? new Date(log.created_at).toLocaleDateString('en-US', { month: 'short', day: 'numeric' }) : '',
      }));
  }, [logs]);

  const userAvg = logs.length > 0
    ? Math.round(logs.reduce((s, l) => s + l.score, 0) / logs.length)
    : 0;

  const cohortAvg = cohortLogs.length > 0
    ? Math.round(cohortLogs.reduce((s, l) => s + l.score, 0) / cohortLogs.length)
    : 0;

  // 2. Rubric radar / category bars
  const userRubric = useMemo(() => extractRubricAverages(logs), [logs]);
  const cohortRubric = useMemo(() => extractRubricAverages(cohortLogs), [cohortLogs]);
  const allCategories = useMemo(() => {
    const keys = new Set([...Object.keys(userRubric), ...Object.keys(cohortRubric)]);
    return Array.from(keys);
  }, [userRubric, cohortRubric]);

  const radarData = useMemo(() =>
    allCategories.map(key => ({
      category: formatCategory(key),
      You: userRubric[key] ?? 0,
      ...(hasCohort ? { Cohort: cohortRubric[key] ?? 0 } : {}),
    })),
    [allCategories, userRubric, cohortRubric, hasCohort]
  );

  const categoryBarData = useMemo(() =>
    allCategories.map(key => ({
      category: formatCategory(key),
      You: userRubric[key] ?? 0,
      ...(hasCohort ? { Cohort: cohortRubric[key] ?? 0 } : {}),
    })),
    [allCategories, userRubric, cohortRubric, hasCohort]
  );

  // 3. Score distribution — buckets
  const BUCKETS = [
    { range: '0–25',   min: 0,  max: 25  },
    { range: '26–50',  min: 26, max: 50  },
    { range: '51–75',  min: 51, max: 75  },
    { range: '76–100', min: 76, max: 100 },
  ];

  const distData = useMemo(() => {
    return BUCKETS.map(({ range, min, max }) => ({
      range,
      You: logs.filter(l => l.score >= min && l.score <= max).length,
      ...(hasCohort ? { Cohort: cohortLogs.filter(l => l.score >= min && l.score <= max).length } : {}),
    }));
  }, [logs, cohortLogs, hasCohort]);

  const hasRubric = allCategories.length > 0;

  if (logs.length === 0) return null;

  return (
    <div className="perf-charts">
      <div className="perf-charts__header">
        <h2 className="perf-charts__title">Performance Analytics</h2>
        <div className="perf-charts__meta">
          <span className="perf-charts__pill" style={{ color: 'var(--color-info)' }}>
            {logs.length} PR{logs.length !== 1 ? 's' : ''} reviewed
          </span>
          <span className="perf-charts__pill" style={{ color: scoreColor(userAvg) }}>
            Avg score: {userAvg}
          </span>
          {hasCohort && (
            <span className="perf-charts__pill" style={{ color: 'var(--color-text-muted)' }}>
              Cohort avg: {cohortAvg}
            </span>
          )}
        </div>
      </div>

      <div className={`perf-charts__grid ${hasRubric ? 'perf-charts__grid--4' : 'perf-charts__grid--2'}`}>

        {/* ── Chart 1: Score Trend ── */}
        <div className="chart-card card anim-fade-up">
          <div className="chart-card__header">
            <span className="chart-card__title">Score Trend</span>
            <span className="chart-card__sub">per PR submission</span>
          </div>
          <ResponsiveContainer width="100%" height={220}>
            <LineChart data={trendData} margin={{ top: 8, right: 12, left: -20, bottom: 0 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.05)" />
              <XAxis dataKey="label" tick={{ fill: 'var(--color-text-muted)', fontSize: 11 }} axisLine={false} tickLine={false} />
              <YAxis domain={[0, 100]} tick={{ fill: 'var(--color-text-muted)', fontSize: 11 }} axisLine={false} tickLine={false} />
              <Tooltip content={<ChartTooltip />} />
              {hasCohort && (
                <ReferenceLine y={cohortAvg} stroke="rgba(255,255,255,0.2)" strokeDasharray="4 4"
                  label={{ value: `Cohort ${cohortAvg}`, fill: 'var(--color-text-muted)', fontSize: 10, position: 'insideTopRight' }}
                />
              )}
              <ReferenceLine y={userAvg} stroke="rgba(59,130,246,0.35)" strokeDasharray="4 4"
                label={{ value: `Avg ${userAvg}`, fill: 'var(--color-primary-light)', fontSize: 10, position: 'insideTopLeft' }}
              />
              <Line
                type="monotone" dataKey="score" name="Score"
                stroke="var(--color-gold)" strokeWidth={2.5}
                dot={{ fill: 'var(--color-gold)', r: 4, strokeWidth: 0 }}
                activeDot={{ r: 6, fill: 'var(--color-gold)', stroke: 'var(--color-bg)', strokeWidth: 2 }}
              />
            </LineChart>
          </ResponsiveContainer>
        </div>

        {/* ── Chart 2: Score Distribution ── */}
        <div className="chart-card card anim-fade-up">
          <div className="chart-card__header">
            <span className="chart-card__title">Score Distribution</span>
            <span className="chart-card__sub">PR count by score band</span>
          </div>
          <ResponsiveContainer width="100%" height={220}>
            <BarChart data={distData} margin={{ top: 8, right: 12, left: -20, bottom: 0 }} barCategoryGap="30%">
              <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.05)" vertical={false} />
              <XAxis dataKey="range" tick={{ fill: 'var(--color-text-muted)', fontSize: 11 }} axisLine={false} tickLine={false} />
              <YAxis allowDecimals={false} tick={{ fill: 'var(--color-text-muted)', fontSize: 11 }} axisLine={false} tickLine={false} />
              <Tooltip content={<ChartTooltip />} />
              {hasCohort && <Legend wrapperStyle={{ fontSize: '11px', color: 'var(--color-text-muted)' }} />}
              <Bar dataKey="You" name="You" radius={[4, 4, 0, 0]}>
                {distData.map((entry) => (
                  <Cell
                    key={entry.range}
                    fill={
                      entry.range === '76–100' ? 'var(--color-success)' :
                      entry.range === '51–75'  ? 'var(--color-info)' :
                      entry.range === '26–50'  ? 'var(--color-warning)' :
                                                  'var(--color-danger)'
                    }
                    fillOpacity={0.85}
                  />
                ))}
              </Bar>
              {hasCohort && (
                <Bar dataKey="Cohort" name="Cohort" fill="rgba(255,255,255,0.12)" radius={[4, 4, 0, 0]} />
              )}
            </BarChart>
          </ResponsiveContainer>
        </div>

        {/* ── Chart 3: Rubric Radar (only if rubric data exists) ── */}
        {hasRubric && (
          <div className="chart-card card anim-fade-up">
            <div className="chart-card__header">
              <span className="chart-card__title">Skill Radar</span>
              <span className="chart-card__sub">average per rubric category</span>
            </div>
            <ResponsiveContainer width="100%" height={240}>
              <RadarChart data={radarData} margin={{ top: 8, right: 24, left: 24, bottom: 8 }}>
                <PolarGrid stroke="rgba(255,255,255,0.08)" />
                <PolarAngleAxis
                  dataKey="category"
                  tick={{ fill: 'var(--color-text-muted)', fontSize: 10 }}
                />
                {hasCohort && (
                  <Radar name="Cohort" dataKey="Cohort" stroke="rgba(255,255,255,0.3)" fill="rgba(255,255,255,0.06)" strokeWidth={1.5} />
                )}
                <Radar name="You" dataKey="You" stroke="var(--color-gold)" fill="rgba(52,211,153,0.15)" strokeWidth={2} dot />
                {hasCohort && <Legend wrapperStyle={{ fontSize: '11px', color: 'var(--color-text-muted)' }} />}
                <Tooltip content={<ChartTooltip />} />
              </RadarChart>
            </ResponsiveContainer>
          </div>
        )}

        {/* ── Chart 4: Category Breakdown bar (only if rubric data exists) ── */}
        {hasRubric && (
          <div className="chart-card card anim-fade-up">
            <div className="chart-card__header">
              <span className="chart-card__title">Category Breakdown</span>
              <span className="chart-card__sub">avg score{hasCohort ? ' vs cohort' : ''}</span>
            </div>
            <ResponsiveContainer width="100%" height={240}>
              <BarChart
                data={categoryBarData}
                layout="vertical"
                margin={{ top: 4, right: 16, left: 8, bottom: 4 }}
                barCategoryGap="25%"
              >
                <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.05)" horizontal={false} />
                <XAxis type="number" domain={[0, 100]} tick={{ fill: 'var(--color-text-muted)', fontSize: 11 }} axisLine={false} tickLine={false} />
                <YAxis type="category" dataKey="category" width={110} tick={{ fill: 'var(--color-text-muted)', fontSize: 11 }} axisLine={false} tickLine={false} />
                <Tooltip content={<ChartTooltip />} />
                {hasCohort && <Legend wrapperStyle={{ fontSize: '11px', color: 'var(--color-text-muted)' }} />}
                {hasCohort && (
                  <Bar dataKey="Cohort" name="Cohort" fill="rgba(255,255,255,0.1)" radius={[0, 4, 4, 0]} barSize={8} />
                )}
                <Bar dataKey="You" name="You" radius={[0, 4, 4, 0]} barSize={8}>
                  {categoryBarData.map((entry) => (
                    <Cell key={entry.category} fill={scoreColor(entry.You)} fillOpacity={0.9} />
                  ))}
                </Bar>
              </BarChart>
            </ResponsiveContainer>
          </div>
        )}
      </div>
    </div>
  );
};

export default PerformanceCharts;
