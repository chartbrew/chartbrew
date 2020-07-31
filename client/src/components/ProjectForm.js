import React, { useState } from "react";
import PropTypes from "prop-types";
import { connect } from "react-redux";
import {
  Segment, Header, Form, Button, Icon, Label
} from "semantic-ui-react";

import { createProject } from "../actions/project";

/*
  Contains the project creation functionality
*/
function ProjectForm(props) {
  const {
    createProject, onComplete, team,
  } = props;

  const [loading, setLoading] = useState(false);
  const [newProject, setNewProject] = useState({});
  const [error, setError] = useState("");

  const _onCreateProject = () => {
    setLoading(true);
    createProject(newProject)
      .then((project) => {
        setLoading(false);
        setNewProject({});
        onComplete(project);
      })
      .catch((error) => {
        setLoading(false);
        setError(error);
      });
  };

  return (
    <div style={styles.container}>
      <Header attached="top" as="h2">Create a new project</Header>
      <Segment raised attached>
        <Form size="large">
          <Form.Field error={!!error}>
            <label>Name your project</label>
            <Form.Input
              onChange={(e, data) => setNewProject({
                ...newProject,
                name: data.value,
                team_id: team.active.id,
              })}
            />
            {error
              && (
              <Label basic color="red" pointing>
                {error}
              </Label>
              )}
          </Form.Field>
          <Form.Field>
            <Button
              primary
              icon
              labelPosition="right"
              loading={loading}
              disabled={!newProject.name}
              onClick={_onCreateProject}
            >
              <Icon name="right arrow" />
              Create
            </Button>
          </Form.Field>
        </Form>
      </Segment>
    </div>
  );
}

const styles = {
  container: {
    flex: 1,
  },
};

ProjectForm.defaultProps = {
  onComplete: () => {},
};

ProjectForm.propTypes = {
  createProject: PropTypes.func.isRequired,
  onComplete: PropTypes.func,
  team: PropTypes.object.isRequired,
};

const mapStateToProps = (state) => {
  return {
    team: state.team,
  };
};

const mapDispatchToProps = (dispatch) => {
  return {
    createProject: data => dispatch(createProject(data)),
  };
};

export default connect(mapStateToProps, mapDispatchToProps)(ProjectForm);
