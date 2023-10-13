import React, { useEffect } from "react";
import PropTypes from "prop-types";
import {
  Spacer, CircularProgress
} from "@nextui-org/react";
import { connect } from "react-redux";
import { useParams } from "react-router";

import { getProject as getProjectAction } from "../actions/project";
import Container from "../components/Container";
import Row from "../components/Row";
import Text from "../components/Text";

function ProjectRedirect(props) {
  const { getProject, history } = props;

  const params = useParams();

  useEffect(() => {
    getProject(params.projectId, true)
      .then((project) => {
        history.push(`/${project.team_id}/${project.id}/dashboard`);
      })
      .catch(() => {
        history.push("/user");
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

ProjectRedirect.propTypes = {
  match: PropTypes.object.isRequired,
  history: PropTypes.object.isRequired,
  getProject: PropTypes.func.isRequired,
};

const mapStateToProps = () => ({
});

const mapDispatchToProps = (dispatch) => ({
  getProject: (id, active) => dispatch(getProjectAction(id, active)),
});

export default connect(mapStateToProps, mapDispatchToProps)(ProjectRedirect);
