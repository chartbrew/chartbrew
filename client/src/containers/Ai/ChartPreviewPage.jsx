import React, { useCallback, useEffect, useState } from "react";
import { useParams } from "react-router";
import { useSelector } from "react-redux";
import { Button, ProgressCircle } from "@heroui/react";
import { Helmet } from "react-helmet-async";
import { selectUser } from "../../slices/user";
import { getAuthToken } from "../../modules/auth";
import { API_HOST } from "../../config/settings";
import AiChartPreview from "./AiChartPreview";

export default function ChartPreviewPage() {
  const { chartId } = useParams();
  const user = useSelector(selectUser);
  const [preview, setPreview] = useState(null);
  const [error, setError] = useState(null);
  const request = useCallback(async (targetProjectId) => {
    const response = await fetch(`${API_HOST}/chart-previews/${encodeURIComponent(chartId)}`, {
      method: targetProjectId ? "POST" : "GET",
      headers: { Authorization: `Bearer ${getAuthToken()}`, "Content-Type": "application/json" },
      ...(targetProjectId ? { body: JSON.stringify({ targetProjectId }) } : {}),
    });
    if (response.status === 401) {
      window.location.href = `/login?preview=${encodeURIComponent(chartId)}`;
      throw new Error("Sign in to view this preview.");
    }
    const result = await response.json();
    if (!response.ok) throw Object.assign(new Error(result.message), { status: response.status });
    return result;
  }, [chartId]);

  const [retry, setRetry] = useState(0);
  useEffect(() => {
    let active = true;
    setPreview(null);
    setError(null);
    if (user?.id) request().then((result) => { if (active) setPreview(result); })
      .catch((failure) => { if (active) setError(failure); });
    return () => { active = false; };
  }, [request, user?.id, retry]);

  return (
    <main className="mx-auto flex min-h-dvh w-full max-w-5xl flex-col gap-6 px-4 py-8 sm:px-8">
      <Helmet><title>{preview?.parsed.chartName || "Chart preview"} | Chartbrew</title></Helmet>
      <nav><Button variant="secondary" render={(props) => <a {...props} href="/" />}>Open Chartbrew</Button></nav>
      {error ? (
        <section className="space-y-4 py-16 text-center" role="alert">
          <h1 className="text-xl font-semibold">{[403, 404].includes(error.status) ? "Preview unavailable" : "The preview could not load"}</h1>
          <p className="text-muted">{[403, 404].includes(error.status)
            ? "This preview has expired, was deleted, or your account does not have access."
            : "Try loading the preview again."}</p>
          <Button variant="secondary" onPress={() => setRetry((value) => value + 1)}>Try again</Button>
        </section>
      ) : preview ? (
        <AiChartPreview chartData={preview.chart} parsed={preview.parsed} teamId={preview.teamId}
          selectedContext={{ multiSelect: [] }}
          onChartAction={async ({ action }) => {
            const result = await request(action.targetProjectId);
            setPreview(result);
            return result.parsed;
          }} />
      ) : (
        <ProgressCircle isIndeterminate aria-label="Loading preview" className="mx-auto my-16">
          <ProgressCircle.Track><ProgressCircle.TrackCircle /><ProgressCircle.FillCircle /></ProgressCircle.Track>
        </ProgressCircle>
      )}
    </main>
  );
}
