import React, { useEffect, useRef, useState } from "react"
import { Alert } from "@heroui/react"
import toast from "react-hot-toast";

import CupLoader from "../../../components/CupLoader";
import { API_HOST } from "../../../config/settings";
import { getAuthToken } from "../../../modules/auth";
import { LuCircleCheck } from "react-icons/lu";

function SlackCallback() {
  const isUpgrade = new URLSearchParams(window.location.search).get("state")?.startsWith("upgrade_");
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

    const response = await fetch(`${API_HOST}/apps/slack/oauth/callback?${new URLSearchParams({ code, state: new URLSearchParams(window.location.search).get("state") || "" })}`, {
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
    toast.success(isUpgrade ? "Slack access updated" : "Chartbrew added to Slack");
    setLoading(false);
  };

  return (
    <div>
      <div className="text-lg font-semibold font-tight">
        {isUpgrade ? "Update Slack access" : "Add Chartbrew to Slack"}
      </div>

      <div className="h-2" />

      <div className="bg-surface p-4 rounded-3xl border border-divider">
        {loading && (
          <div className="flex flex-col items-center justify-center gap-2">
            <CupLoader label="Loading..." />
            <div className="text-center">
              {isUpgrade ? "Updating Slack access…" : "Connecting Slack…"}
            </div>
          </div>
        )}

        {!error && !loading && (
          <div className="flex flex-col items-center justify-center gap-2">
            <div>
              <LuCircleCheck className="text-success" size={42} />
            </div>
            <div className="text-center font-bold">
              {isUpgrade ? "Slack access updated" : "Chartbrew added to Slack"}
            </div>
            <div className="text-center">
              {isUpgrade ? "Return to Slack. Link your personal account if you have not done so." : "Run this command in Slack to complete setup:"}
            </div>
            <div className="text-center">
              <code className="rounded-md bg-default/40 px-1.5 py-0.5 text-base text-default-700">{isUpgrade ? "/chartbrew link" : "/chartbrew connect"}</code>
            </div>
          </div>
        )}

        {error && (
          <Alert status="danger">
            <Alert.Indicator />
            <Alert.Content>
              <Alert.Title>{isUpgrade ? "Slack access could not be updated" : "Slack could not be connected"}</Alert.Title>
              <Alert.Description>{isUpgrade ? "Return to the Slack integration in Chartbrew and select Update Slack access again." : "Please try again."}</Alert.Description>
              {!isUpgrade && (
                <div className="mt-3">
                  <a href={`${API_HOST}/apps/slack/oauth/start`}>
                    <img alt="Add to Slack" height="40" width="139" src="https://platform.slack-edge.com/img/add_to_slack.png" srcSet="https://platform.slack-edge.com/img/add_to_slack.png 1x, https://platform.slack-edge.com/img/add_to_slack@2x.png 2x" />
                  </a>
                </div>
              )}
            </Alert.Content>
          </Alert>
        )}
      </div>
    </div>
  )
}

export default SlackCallback
