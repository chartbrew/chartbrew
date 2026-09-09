import React, { useEffect, useState } from "react";
import { useLocation, useNavigate } from "react-router";
import { useSelector } from "react-redux";
import { Button, Checkbox, Label, ListBox, Select, Spinner } from "@heroui/react";
import { Helmet } from "react-helmet-async";
import { LuShieldCheck } from "react-icons/lu";
import { MCP_PERMISSIONS, mcpOAuthRequest } from "../api/mcpOAuth";
import { selectUser } from "../slices/user";

export default function McpConsent() {
  const { search } = useLocation();
  const navigate = useNavigate();
  const user = useSelector(selectUser);
  const requestId = new URLSearchParams(search).get("request");
  const [info, setInfo] = useState(null);
  const [teamId, setTeamId] = useState(null);
  const [permissions, setPermissions] = useState([]);
  const [error, setError] = useState("");
  const [pending, setPending] = useState(false);
  const framed = window.self !== window.top;
  const team = info?.teams.find((item) => String(item.id) === teamId);

  useEffect(() => {
    let active = true;
    setInfo(null);
    setError("");
    if (framed) {
      setError("Open Chartbrew in a separate tab, then start the connection again in your app.");
      return undefined;
    }
    if (!/^[a-f0-9-]{36}$/.test(requestId || "")) {
      setError("This access request is not available. Start the connection again in your app.");
      return undefined;
    }
    mcpOAuthRequest(`consent/${requestId}`).then((data) => {
      if (!active) return;
      setInfo(data);
      const onlyTeam = data.teams.length === 1 ? data.teams[0] : null;
      setTeamId(onlyTeam ? String(onlyTeam.id) : null);
      setPermissions(data.scopes.filter((scope) => !onlyTeam || onlyTeam.scopes.includes(scope)));
    }).catch((failure) => {
      if (!active) return;
      if (failure.status === 401) navigate(`/login?oauthRequest=${requestId}`, { replace: true });
      else setError("This access request has expired or is not available. Start the connection again in your app.");
    });
    return () => { active = false; };
  }, [framed, navigate, requestId]);

  const respond = async (allow) => {
    setPending(true);
    setError("");
    try {
      const result = await mcpOAuthRequest(`consent/${requestId}`, { method: "POST",
        body: JSON.stringify({ allow, teamId: team?.id, scopes: permissions }) });
      window.location.assign(result.redirect);
    } catch {
      setError("Access could not be saved. Try again, or start a new connection in your app.");
      setPending(false);
    }
  };

  return (
    <main className="min-h-screen bg-surface-secondary px-4 py-12 sm:py-20">
      <Helmet><title>Connect an app | Chartbrew</title><meta name="referrer" content="no-referrer" /></Helmet>
      <div className="mx-auto max-w-lg rounded-3xl bg-surface p-6 sm:p-8">
        <div className="mb-8 flex items-center gap-2 font-semibold"><LuShieldCheck aria-hidden className="text-accent" />Chartbrew</div>
        {!info && !error ? <div role="status" className="flex items-center gap-3"><Spinner size="sm" />Loading access request…</div> : null}
        {info ? <>
          <h1 className="font-tw text-2xl font-semibold break-words">Allow {info.app.name} to access Chartbrew?</h1>
          <p className="mt-3 text-sm text-muted break-words">Return address: {info.app.returnHost}</p>
          <p className="mt-3 text-sm">App names are supplied by the app. Only continue if you started this connection and trust this app.</p>
          {user.email ? <p className="mt-4 text-sm text-muted break-words">Signed in as {user.email}</p> : null}
          <Select className="mt-6 w-full" placeholder="Select a team" value={teamId} isDisabled={pending || !info.teams.length} variant="secondary"
            onChange={(value) => {
              setTeamId(String(value));
              const selected = info.teams.find((item) => String(item.id) === String(value));
              setPermissions(info.scopes.filter((scope) => selected?.scopes.includes(scope)));
            }}>
            <Label>Team</Label>
            <Select.Trigger><Select.Value /><Select.Indicator /></Select.Trigger>
            <Select.Popover><ListBox>{info.teams.map((item) => <ListBox.Item key={item.id} id={String(item.id)} textValue={item.name}>
              {item.name}<ListBox.ItemIndicator />
            </ListBox.Item>)}</ListBox></Select.Popover>
          </Select>
          {!info.teams.length ? <p role="alert" className="mt-3 text-danger">You do not have access to a team. Ask a team owner to invite you, then start the connection again.</p> : null}
          {team ? <>
            <p className="mt-3 text-sm text-muted">{team.allProjects
              ? "Access applies to all dashboards and connected data sources in this team, including those added later."
              : "Access is limited to the dashboards you can access now in this team."}</p>
            <div className="my-6 flex flex-col gap-3" role="group" aria-label="Requested permissions">
              {info.scopes.map((scope) => <Checkbox key={scope} isSelected={permissions.includes(scope)}
                isReadOnly={scope === "data:read"} isDisabled={pending || !team.scopes.includes(scope)}
                onChange={(selected) => setPermissions((current) => selected ? [...current, scope] : current.filter((item) => item !== scope))}>
                <Checkbox.Content><Checkbox.Control><Checkbox.Indicator /></Checkbox.Control><Label>{MCP_PERMISSIONS[scope]}</Label></Checkbox.Content>
              </Checkbox>)}
            </div>
            {info.scopes.some((scope) => !team.scopes.includes(scope)) ? <p className="mb-4 text-sm">Your team role does not allow all requested permissions. Only the selected permissions will be granted.</p> : null}
            <p className="text-sm text-muted">Other teams are not included. You can remove this access in Settings → Authorized apps.</p>
          </> : null}
        </> : null}
        {error ? <p role="alert" className="mt-4 text-danger">{error}</p> : null}
        {info ? <div className="mt-8 flex justify-end gap-3">
          <Button variant="secondary" isDisabled={pending} onPress={() => respond(false)}>Cancel</Button>
          <Button isDisabled={!team} isPending={pending} onPress={() => respond(true)}>Allow access</Button>
        </div> : error ? <Button className="mt-6" variant="secondary" onPress={() => navigate("/")}>Back to Chartbrew</Button> : null}
      </div>
    </main>
  );
}
