import React from "react";
import PropTypes from "prop-types";
import { Card, Skeleton } from "@heroui/react";
import { AnimatePresence, motion, useReducedMotion } from "framer-motion";

import presets from "../../../../../shared/onboarding/reportPresets.json";
import "../onboardingReport.css";

const samples = [28, 42, 36, 56, 48, 65, 59, 76, 70, 86, 81, 96];
const MotionCard = motion.create(Card);

function SampleChart({ type, variant = 0 }) {
  if (type === "donut") {
    return (
      <svg viewBox="0 0 300 160" className="h-0 min-h-0 w-full flex-1 text-accent">
        <circle cx="150" cy="80" r="55" fill="none" stroke="currentColor" strokeWidth="24" opacity="0.18" />
        <circle cx="150" cy="80" r="55" fill="none" stroke="currentColor" strokeWidth="24" strokeDasharray="220 346" transform="rotate(-90 150 80)" />
      </svg>
    );
  }
  const values = samples.map((value, index) => Math.max(12, value - ((index + variant) % 4) * variant * 4));
  const points = values.map((value, index) => `${12 + index * 25},${145 - value}`).join(" ");
  return (
    <svg viewBox="0 0 300 160" className="h-0 min-h-0 w-full flex-1 text-accent" preserveAspectRatio="none">
      {[45, 95, 145].map((y) => (
        <line key={y} x1="0" y1={y} x2="300" y2={y} stroke="currentColor" opacity="0.1" />
      ))}
      {type === "bar" ? values.map((value, index) => (
        <rect key={index} x={index * 25 + 4} y={145 - value} width="15" height={value} rx="3" fill="currentColor" opacity={0.45 + index * 0.04} />
      )) : (
        <>
          <polygon points={`12,145 ${points} 287,145`} fill="currentColor" opacity="0.1" />
          <polyline points={points} fill="none" stroke="currentColor" strokeWidth="3" strokeLinejoin="round" strokeLinecap="round" />
        </>
      )}
    </svg>
  );
}
SampleChart.propTypes = { type: PropTypes.string.isRequired, variant: PropTypes.number };

function SampleContent({ index, preset, ready, value }) {
  if (index < 2 || value) {
    return ready
      ? <p className="mt-4 text-4xl font-semibold tabular-nums">{value || preset.values[index]}</p>
      : <Skeleton animationType="none" className="mt-4 h-10 w-28 rounded" />;
  }
  if (index !== 4) {
    const chartTypes = { 2: preset.charts[0], 3: preset.charts[1], 5: "bar", 6: "line", 7: "line", 8: "donut" };
    return (
      <div className="mt-5 flex min-h-0 flex-1 flex-col gap-4">
        {ready ? <SampleChart type={chartTypes[index]} variant={index - 2} /> : <Skeleton animationType="none" className="w-full flex-1 rounded-lg" />}
        <div className="flex justify-between gap-2 text-xs text-muted">
          {(chartTypes[index] === "donut" ? preset.rows : ["Week 1", "Week 4", "Week 8", "Week 12"]).map((label) => (
            <span key={label} className="truncate">{ready ? label : ""}</span>
          ))}
        </div>
      </div>
    );
  }
  return (
    <div className="mt-4 divide-y divide-divider">
      {preset.rows.map((row, rowIndex) => (
        <div key={rowIndex} className="flex h-11 items-center justify-between text-sm">
          {ready ? (
            <>
              <span>{row}</span>
              <div className="flex w-1/2 items-center gap-6">
                <div className="h-2 flex-1 rounded-full bg-accent/10">
                  <div className="h-full rounded-full bg-accent/50" style={{ width: `${[80, 60, 40, 25][rowIndex]}%` }} />
                </div>
                <span className="w-12 text-right tabular-nums">{[480, 320, 240, 160][rowIndex]}</span>
              </div>
            </>
          ) : <Skeleton animationType="none" className="h-3 w-full rounded" />}
        </div>
      ))}
    </div>
  );
}
SampleContent.propTypes = {
  value: PropTypes.string,
  index: PropTypes.number.isRequired,
  preset: PropTypes.object.isRequired,
  ready: PropTypes.bool.isRequired,
};

function OnboardingReport({ branding, ready, preview }) {
  const reducedMotion = useReducedMotion();
  const basePreset = presets[preview?.preset] || presets.general;
  const preset = {
    ...basePreset,
    rows: preview?.rows || basePreset.rows,
    values: preview?.kpiFormats?.map((format, index) => (
      format === "percent" ? ["32.4%", "48.6%"][index] : ["1,284", "86,240"][index]
    )) || basePreset.values,
  };
  const metricTitles = preview?.titles || preset.titles;
  const titles = [...metricTitles, metricTitles[0], metricTitles[1], metricTitles[2], metricTitles[3]];
  const cards = titles.map((title, index) => ({ title, index }));
  const extraKpis = (preview?.extraKpis || basePreset.extraKpis).map((kpi, index) => ({
    title: kpi.title,
    index: titles.length + index,
    value: kpi.format === "percent" ? ["94.2%", "68.5%"][index] : ["3,640", "872"][index],
  }));
  cards.splice(1, 0, ...extraKpis);
  const transition = { duration: reducedMotion ? 0 : 0.7, ease: "easeInOut" };
  const logoUrl = branding?.logo?.data
    ? `data:${branding.logo.mimeType};base64,${branding.logo.data}` : branding?.logoUrl;

  return (
    <div className="onboarding-report pointer-events-none select-none">
      <div aria-hidden="true" className="onboarding-report-content">
        <div className="mb-8 flex h-24 items-center gap-4">
          <AnimatePresence initial={false} mode="wait">
            <motion.div key={logoUrl || "logo"} initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} transition={transition}>
              {logoUrl ? (
                <img src={logoUrl} alt="" className="size-14 rounded-xl object-contain" />
              ) : <Skeleton animationType="none" className="size-14 rounded-xl bg-muted/25" />}
            </motion.div>
          </AnimatePresence>
          <div className="min-w-0 flex-1">
            {branding?.businessName ? (
              <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={transition} className="truncate text-2xl font-semibold">
                {branding.businessName}
              </motion.div>
            ) : <Skeleton animationType="none" className="h-7 w-48 max-w-full rounded bg-muted/25" />}
            {branding?.description ? (
              <motion.p initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={transition} className="mt-3 line-clamp-2 max-w-xl text-sm text-muted">
                {branding.description}
              </motion.p>
            ) : <Skeleton animationType="none" className="mt-3 h-3 w-80 max-w-full rounded bg-muted/25" />}
          </div>
        </div>
        <div className="flex flex-1 flex-col">
          <AnimatePresence initial={false} mode="wait">
            <motion.div
              key={ready ? JSON.stringify(preview || "general") : "skeleton"}
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              transition={transition}
              className="onboarding-report-grid"
            >
              {cards.map(({ title, index, value }, position) => (
                <MotionCard
                  key={index}
                  initial={ready && !reducedMotion ? { opacity: 0, y: 16 } : false}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{
                    duration: reducedMotion ? 0 : 0.65,
                    delay: ready && !reducedMotion ? position * 0.06 : 0,
                    ease: [0.22, 1, 0.36, 1],
                  }}
                  className={`rounded-2xl border border-divider bg-surface p-6 shadow-none ${index === 4 ? "col-span-4" : index < 2 || value ? "min-h-0" : "col-span-2 min-h-0"}`}
                >
                  {ready ? <p className="truncate text-sm font-medium">{title}</p> : <Skeleton animationType="none" className="h-4 w-36 max-w-full rounded" />}
                  <SampleContent index={index} preset={preset} ready={ready} value={value} />
                </MotionCard>
              ))}
            </motion.div>
          </AnimatePresence>
        </div>
      </div>
    </div>
  );
}

OnboardingReport.propTypes = {
  branding: PropTypes.object,
  ready: PropTypes.bool.isRequired,
  preview: PropTypes.object,
};

export default OnboardingReport;
