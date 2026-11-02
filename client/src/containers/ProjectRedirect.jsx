import React, { useEffect, useRef } from "react";
import { useNavigate, useParams } from "react-router";
import { useDispatch } from "react-redux";

import LoadingScreen from "../components/LoadingScreen";
import { getProject } from "../slices/project";

function ProjectRedirect() {
  const params = useParams();
  const navigate = useNavigate();
  const dispatch = useDispatch();

  const initRef = useRef(false);

  useEffect(() => {
    if (params.projectId && !initRef.current) {
      dispatch(getProject({ project_id: params.projectId, active: true }))
        .then((project) => {
          if (project?.payload) {
            navigate(`/${project.payload.team_id}/${project.payload.id}/dashboard`);
          } else {
            navigate("/");
          }
        })
        .catch(() => {
          navigate("/");
        });
      initRef.current = true;
    }
  }, [params]);

  return <LoadingScreen label="Loading dashboard" />;

}

export default ProjectRedirect;
