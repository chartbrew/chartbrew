import React, { useState, useEffect } from "react";
import { useDispatch, useSelector } from "react-redux";
import { Outlet, useParams } from "react-router";
import { Alert, Button } from "@heroui/react";

import { getProject, changeActiveProject, getProjects } from "../../slices/project";
import { getTeam, getTeamMembers, selectTeam } from "../../slices/team";
import { getProjectCharts } from "../../slices/chart";
import LoadingScreen from "../../components/LoadingScreen";

function ProjectBoard() {
  const [result, setResult] = useState(null);
  const [retry, setRetry] = useState(0);
  const team = useSelector(selectTeam);
  const { projectId } = useParams();
  const dispatch = useDispatch();
  const requestKey = `${team?.id}:${projectId}`;

  useEffect(() => {
    if (!projectId || !team?.id) return undefined;

    let cancelled = false;
    const requests = [];
    const run = (action) => {
      const request = dispatch(action);
      requests.push(request);
      return request.unwrap();
    };

    const load = async () => {
      try {
        await Promise.all([
          run(getTeam(team.id)),
          run(getTeamMembers({ team_id: team.id })),
          run(getProjects({ team_id: team.id })),
          run(getProjectCharts({ project_id: projectId })),
        ]);
        if (cancelled) return;
        await run(getProject({ project_id: projectId }));
        if (cancelled) return;
        dispatch(changeActiveProject(projectId));
        window.localStorage.setItem("__cb_active_team", team.id);
        setResult({ key: requestKey, error: false });
      } catch (error) {
        if (!cancelled) setResult({ key: requestKey, error: true });
      }
    };

    load();
    return () => {
      cancelled = true;
      requests.forEach((request) => request.abort());
    };
  }, [projectId, team?.id, dispatch, requestKey, retry]);

  if (result?.key !== requestKey) {
    return <LoadingScreen label="Loading dashboard" />;
  }

  if (result.error) {
    return (
      <Alert status="danger">
        <Alert.Indicator />
        <Alert.Content>
          <Alert.Title>Could not load this dashboard</Alert.Title>
          <Alert.Description>Check your connection and try again.</Alert.Description>
        </Alert.Content>
        <Button
          variant="secondary"
          onPress={() => {
            setResult(null);
            setRetry((value) => value + 1);
          }}
        >
          Try again
        </Button>
      </Alert>
    );
  }

  return (
    <div className="w-full bg-background">
      <Outlet />
    </div>
  );
}

export default ProjectBoard;
