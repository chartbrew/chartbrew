import React, { useEffect, useRef } from "react";
import {
  Spacer, CircularProgress
} from "@heroui/react";
import { useNavigate, useParams } from "react-router";
import { useDispatch } from "react-redux";

import { getProject } from "../slices/project";
import Container from "../components/Container";
import Row from "../components/Row";
import Text from "../components/Text";

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

  return (
    <Container>
      <Spacer y={4} />
      <Row align="center" justify="center">
        <CircularProgress color="default" size="xl" aria-label="Loading" />
      </Row>
      <Spacer y={1} />
      <Row align="center" justify="center">
        <Text size="lg" color="gray">Loading the dashboard...</Text>
      </Row>
    </Container>
  );
}

export default ProjectRedirect;
