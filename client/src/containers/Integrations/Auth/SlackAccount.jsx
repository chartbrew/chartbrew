import React, { useEffect, useState } from "react";
import { Alert, Button, Separator, Surface } from "@heroui/react";
import { useSelector } from "react-redux";
import { useNavigate } from "react-router";
import { LuArrowLeft } from "react-icons/lu";

import { API_HOST } from "../../../config/settings";
import { getAuthToken } from "../../../modules/auth";
import { selectUser } from "../../../slices/user";

function SlackAccount() {
  const navigate = useNavigate();
  const user = useSelector(selectUser);
  const [token, setToken] = useState(() => new URLSearchParams(window.location.search).get("token"));
  const [data, setData] = useState(null);
  const [error, setError] = useState("");
  const [pending, setPending] = useState(false);
  const [linked, setLinked] = useState(false);

  useEffect(() => {
    const controller = new AbortController();
    fetch(`${API_HOST}/apps/slack/account${token ? `?token=${encodeURIComponent(token)}` : ""}`, {
      headers: { Authorization: `Bearer ${getAuthToken()}` }, signal: controller.signal,
    }).then(async (response) => {
      const result = await response.json();
      if (!response.ok) throw new Error(result.error || "Slack accounts could not load. Try again.");
      setData(result);
    }).catch((failure) => {
      if (failure.name !== "AbortError") setError(failure.message);
    });
    return () => controller.abort();
  }, [token]);

  const changeAccount = async (id) => {
    setPending(true);
    setError("");
    try {
      const response = await fetch(`${API_HOST}/apps/slack/account${id ? `/${id}` : ""}`, {
        method: id ? "DELETE" : "POST",
        headers: { Authorization: `Bearer ${getAuthToken()}`, "Content-Type": "application/json" },
        ...(id ? {} : { body: JSON.stringify({ token }) }),
      });
      const result = await response.json();
      if (!response.ok) throw new Error(result.error || "The account could not be changed. Try again.");
      if (id) setData((current) => ({ ...current, accounts: current.accounts.filter((account) => account.id !== id) }));
      else {
        setLinked(true);
        setToken(null);
        window.history.replaceState(null, "", window.location.pathname);
      }
    } catch (failure) {
      setError(failure.message);
    } finally {
      setPending(false);
    }
  };

  return (
    <div className="flex w-full flex-col gap-4">
      <Button variant="ghost" size="sm" className="self-start" onPress={() => navigate("/integrations")}>
        <LuArrowLeft size={16} aria-hidden="true" />
        Back to integrations
      </Button>
      <h1 className="font-tight text-2xl font-semibold">Slack account</h1>
      <Surface className="flex flex-col gap-4 rounded-3xl border border-divider p-4">
        <div className="flex min-w-0 flex-col gap-1">
          <h2 className="text-sm font-semibold">Chartbrew account</h2>
          <p className="break-words text-sm text-muted">{user.email}</p>
        </div>
        <Separator />
        {error && (
          <Alert status="danger">
            <Alert.Indicator />
            <Alert.Content>
              <Alert.Title>{error}</Alert.Title>
            </Alert.Content>
          </Alert>
        )}
        {linked && (
          <Alert status="success">
            <Alert.Indicator />
            <Alert.Content>
              <Alert.Title>Account linked. Return to Slack to ask a question.</Alert.Title>
            </Alert.Content>
          </Alert>
        )}
        {!data && !error && <p role="status">Loading your Slack account…</p>}
        {token && data?.workspace && (
          <div className="flex flex-col items-start gap-4">
            <p className="text-sm">Link this account to {data.workspace}.</p>
            <Button onPress={() => changeAccount()} isPending={pending}>Link account</Button>
          </div>
        )}
        {!token && data?.accounts?.map((account) => (
          <div key={account.id} className="flex flex-col items-start gap-4 sm:flex-row sm:items-center sm:justify-between">
            <div className="flex min-w-0 flex-col gap-1">
              <h2 className="text-sm font-semibold">Slack workspace</h2>
              <p className="break-words text-sm">{account.workspace}</p>
            </div>
            <Button variant="secondary" onPress={() => changeAccount(account.id)} isPending={pending}>
              Unlink Slack account
            </Button>
          </div>
        ))}
        {!token && data?.accounts?.length === 0 && (
          <p className="text-sm">Run <code className="rounded-md bg-default px-1.5 py-0.5">/chartbrew link</code> in Slack to link your account.</p>
        )}
      </Surface>
    </div>
  );
}

export default SlackAccount;
