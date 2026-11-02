import { useCallback, useEffect, useState } from "react";

import { getAiAvailability } from "../../../api/ai";

export default function useAiAvailability({ enabled = true, teamId }) {
  const [availability, setAvailability] = useState(null);
  const [error, setError] = useState(null);
  const [isLoading, setIsLoading] = useState(false);

  const load = useCallback(async () => {
    if (!enabled || !teamId) return;
    setError(null);
    setAvailability(null);
    setIsLoading(true);
    try {
      setAvailability(await getAiAvailability(teamId));
    } catch (loadError) {
      setAvailability(null);
      setError(loadError);
    } finally {
      setIsLoading(false);
    }
  }, [enabled, teamId]);

  useEffect(() => {
    if (!enabled || !teamId) {
      setAvailability(null);
      setError(null);
      setIsLoading(false);
      return;
    }
    load();
  }, [enabled, load, teamId]);

  return {
    availability,
    error,
    isLoading,
    reload: load,
  };
}
