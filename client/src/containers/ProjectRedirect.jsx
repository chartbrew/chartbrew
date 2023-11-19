import React, { useEffect } from "react";
import {
  Spacer, CircularProgress
} from "@nextui-org/react";
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

  useEffect(() => {
    dispatch(getProject({ project_id: params.projectId, active: true }))
      .then((project) => {
        navigate(`/${project.team_id}/${project.id}/dashboard`);
      })
      .catch(() => {
        navigate("/user");
      });
  }, []);

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
