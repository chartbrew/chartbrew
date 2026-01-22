import React, { useEffect, useRef, useState } from "react"
import { Alert, Code, Spacer, Spinner } from "@heroui/react"
import toast from "react-hot-toast";

import { API_HOST } from "../../../config/settings";
import { getAuthToken } from "../../../modules/auth";
import { LuCircleCheck } from "react-icons/lu";

function SlackCallback() {
  const [error, setError] = useState(null);
  const [loading, setLoading] = useState(true);

  const initRef = useRef(false);

  useEffect(() => {
    if (!initRef.current) { 
      initRef.current = true;
      _onConnectSlack();
    }
  }, []);

  const _onConnectSlack = async () => {
    const code = new URLSearchParams(window.location.search).get("code");
    if (!code) {
      toast.error("No authentication code found. Please try again.");
      setError(true);
      setLoading(false);
      return;
    }

    const response = await fetch(`${API_HOST}/apps/slack/oauth/callback?code=${code}`, {
      method: "GET",
      headers: {
        "Authorization": `Bearer ${getAuthToken()}`,
      },
    });
    if (!response.ok) {
      toast.error("Failed to connect to Slack. Please try again.");
      setError(true);
      setLoading(false);
      return;
    }
    await response.json();
    toast.success("Successfully added Chartbrew to your Slack workspace");
    setLoading(false);
  };

  return (
    <div>
      <div className="text-lg font-semibold font-tw">
        Add Chartbrew to your Slack workspace
      </div>
      <div className="text-sm text-foreground-500">
        {"Add Chartbrew to your Slack workspace to start using it"}
      </div>

      <Spacer y={2} />

      <div className="bg-content1 p-4 rounded-lg border border-divider">
        {loading && (
          <div className="flex flex-col items-center justify-center gap-2">
            <Spinner variant="simple" aria-label="Loading..." />
            <div className="text-center">
              Please wait while we are adding Chartbrew to your Slack workspace...
            </div>
          </div>
        )}

        {!error && !loading && (
          <div className="flex flex-col items-center justify-center gap-2">
            <div>
              <LuCircleCheck className="text-success" size={42} />
            </div>
            <div className="text-center font-bold">
              Successfully added Chartbrew to your Slack workspace
            </div>
            <div className="text-center">
              DM Chartbrew in Slack to get started and finish the setup:
            </div>
            <div className="text-center">
              <Code>/chartbrew connect</Code>
            </div>
          </div>
        )}

        {error && (
          <Alert
            color="danger"
            variant="flat"
            title="Failed to add Chartbrew to your Slack workspace"
            description="Please try again."
            endContent={
              <a href={`${API_HOST}/apps/slack/oauth/start`}><img alt="Add to Slack" height="40" width="139" src="https://platform.slack-edge.com/img/add_to_slack.png" srcSet="https://platform.slack-edge.com/img/add_to_slack.png 1x, https://platform.slack-edge.com/img/add_to_slack@2x.png 2x" /></a>
            }
          />
        )}
      </div>
    </div>
  )
}

export default SlackCallback