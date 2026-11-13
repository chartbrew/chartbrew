import { useCallback, useEffect, useRef } from "react";
import { useDispatch, useStore } from "react-redux";

import { getDashboardChartBatch, shouldSkipFiltering } from "../../../slices/chart";
import { buildChartRuntimeRequest } from "../../../modules/chartRuntimeFilters";
import { createChartBatchQueue } from "../../../modules/chartBatchQueue";

export default function useDashboardChartData({ projectId, charts, dashboardFilters, chartFilters, publicAccess, enabled = true, loadAll = false, onAccessError }) {
  const dispatch = useDispatch();
  const store = useStore();
  const elements = useRef(new Map());
  const observer = useRef(null);
  const visibleIds = useRef(new Set());
  const queue = useRef(null);
  const accessError = useRef(onAccessError);
  accessError.current = onAccessError;
  const accessJson = JSON.stringify(publicAccess || null);
  const requestsJson = JSON.stringify(charts
    .filter((chart) => String(chart.project_id) === String(projectId) && chart.type !== "markdown" && !chart.staged && (!publicAccess || (chart.onReport && !chart.draft)))
    .map((chart) => {
      const { filters, variables } = buildChartRuntimeRequest({ chart, dashboardFilters, chartFilters: chartFilters[chart.id] || [] });
      return { chart_id: chart.id, filters, variables, configurationVersion: chart.configurationVersion };
    }));

  useEffect(() => {
    if (!enabled || !projectId) return undefined;
    const requests = JSON.parse(requestsJson);
    const current = createChartBatchQueue({
      requests,
      isLoaded: (item) => {
        const chart = store.getState().chart.data.find((entry) => entry.id === item.chart_id);
        return !chart?.initialDataError && chart?.filterMetadata?.configurationVersion === item.configurationVersion
          && shouldSkipFiltering(chart, item.filters, item.variables);
      },
      loadBatch: (items) => {
        const request = dispatch(getDashboardChartBatch({ project_id: projectId, charts: items, publicAccess: JSON.parse(accessJson) }));
        request.then((action) => {
          if (["401", "403"].includes(action?.error?.code) && !action.meta.aborted) accessError.current?.(action.error.code);
        });
        return request;
      },
    });
    queue.current = current;
    if (loadAll) requests.forEach((item) => current.enqueue(item.chart_id));
    const isVisible = (entry) => entry.boundingClientRect.bottom > 0 && entry.boundingClientRect.top < window.innerHeight;
    const visibility = new IntersectionObserver((entries) => {
      entries.forEach((entry) => {
        const id = Number(entry.target.dataset.chartId);
        if (entry.isIntersecting) visibleIds.current.add(id);
        else visibleIds.current.delete(id);
      });
      entries.filter((entry) => entry.isIntersecting)
        .sort((left, right) => Number(isVisible(right)) - Number(isVisible(left)) || left.boundingClientRect.top - right.boundingClientRect.top)
        .forEach((entry) => current.enqueue(Number(entry.target.dataset.chartId)));
    }, { rootMargin: "200px 0px" });
    observer.current = visibility;
    elements.current.forEach((element) => visibility.observe(element));
    return () => {
      visibility.disconnect();
      observer.current = null;
      current.stop();
    };
  }, [dispatch, store, projectId, requestsJson, accessJson, enabled, loadAll]);

  useEffect(() => {
    if (!enabled) return;
    for (const item of JSON.parse(requestsJson)) {
      const chart = charts.find((entry) => entry.id === item.chart_id);
      if ((loadAll || visibleIds.current.has(item.chart_id)) && !chart?.initialDataPending && !chart?.initialDataError && !chart?.loading
        && (!shouldSkipFiltering(chart, item.filters, item.variables)
          || chart?.filterMetadata?.configurationVersion !== item.configurationVersion)) {
        queue.current?.retry(item.chart_id);
      }
    }
  }, [charts, requestsJson, enabled, loadAll]);

  const observeChart = useCallback((element) => {
    if (!element) return;
    const id = Number(element.dataset.chartId);
    const previous = elements.current.get(id);
    if (previous === element) return;
    if (previous) observer.current?.unobserve(previous);
    elements.current.set(id, element);
    observer.current?.observe(element);
    return () => {
      observer.current?.unobserve(element);
      elements.current.delete(id);
      visibleIds.current.delete(id);
    };
  }, []);

  return { observeChart, retryChart: (id) => queue.current?.retry(id) };
}
