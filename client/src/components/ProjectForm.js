import React, { useState } from "react";
import PropTypes from "prop-types";
import { connect } from "react-redux";
import {
  Header, Form, Button, Icon, Label, Menu, Divider
} from "semantic-ui-react";

import { createProject } from "../actions/project";
import CustomTemplates from "../containers/Connections/CustomTemplates/CustomTemplates";

/*
  Contains the project creation functionality
*/
function ProjectForm(props) {
  const {
    createProject, onComplete, team, templates,
  } = props;

  const [loading, setLoading] = useState(false);
  const [newProject, setNewProject] = useState({});
  const [error, setError] = useState("");
  const [activeMenu, setActiveMenu] = useState("empty");
  const [createdProject, setCreatedProject] = useState(null);

  const _onCreateProject = (noRedirect) => {
    setLoading(true);
    return createProject(newProject)
      .then((project) => {
        setLoading(false);
        setNewProject({});
        setCreatedProject(project);

        if (noRedirect) return project;

        return onComplete(project);
      })
      .catch((error) => {
        setLoading(false);
        setError(error);
      });
  };

  const _onCompleteTemplate = () => {
    setTimeout(() => {
      onComplete(createdProject, false);
    }, 1000);
  };

  return (
    <div style={styles.container}>
      <Header as="h3">Create a new project</Header>

      <Form size="large">
        <Form.Field error={!!error}>
          <Form.Input
            onChange={(e, data) => setNewProject({
              ...newProject,
              name: data.value,
              team_id: team.active.id,
            })}
            placeholder="Enter a name for your project"
          />
          {error
            && (
            <Label basic color="red" pointing>
              {error}
            </Label>
            )}
        </Form.Field>

        <Form.Field>
          <Menu secondary>
            <Menu.Item
              active={activeMenu === "empty"}
              onClick={() => setActiveMenu("empty")}
            >
              <Icon name="pencil" />
              Empty project
            </Menu.Item>
            <Menu.Item
              active={activeMenu === "template"}
              onClick={() => setActiveMenu("template")}
            >
              <Icon name="clone" />
              From template
            </Menu.Item>
          </Menu>
        </Form.Field>

        {activeMenu === "empty" && (
          <Form.Field>
            <Button
              primary
              icon
              labelPosition="right"
              loading={loading}
              disabled={!newProject.name}
              onClick={() => _onCreateProject()}
              size="large"
            >
              <Icon name="right arrow" />
              Create
            </Button>
          </Form.Field>
        )}
      </Form>

      {activeMenu === "template" && (
        <>
          <Divider hidden />
          <CustomTemplates
            templates={templates.data}
            loading={templates.loading}
            teamId={team.id}
            projectId={createdProject && createdProject.id}
            connections={[]}
            onComplete={_onCompleteTemplate}
            onCreateProject={() => _onCreateProject(true)}
          />
        </>
      )}
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
  templates: PropTypes.object.isRequired,
};

const mapStateToProps = (state) => {
  return {
    team: state.team,
    templates: state.template
  };
};

const mapDispatchToProps = (dispatch) => {
  return {
    createProject: data => dispatch(createProject(data)),
  };
};

export default connect(mapStateToProps, mapDispatchToProps)(ProjectForm);
