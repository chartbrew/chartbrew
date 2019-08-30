import React, { Component } from "react";
import PropTypes from "prop-types";
import { connect } from "react-redux";
import {
  Segment, Header, Form, Button, Icon, Label
} from "semantic-ui-react";

import { createProject } from "../actions/project";

/*
  Contains the project creation functionality
*/
class ProjectForm extends Component {
  constructor(props) {
    super(props);

    this.state = {
      loading: false,
      newProject: {},
      error: "",
    };
  }

  _onCreateProject = () => {
    const { createProject, onComplete } = this.props;
    const { newProject } = this.state;

    this.setState({ loading: true });
    createProject(newProject)
      .then((project) => {
        this.setState({ loading: false, newProject: {} });
        onComplete(project);
      });
  }

  render() {
    const { error, newProject, loading } = this.state;
    const { team } = this.props;

    return (
      <div style={styles.container}>
        <Header attached="top" as="h2">Create a new project</Header>
        <Segment raised attached>
          <Form size="large">
            <Form.Field error={!!error}>
              <label>Name your project</label>
              <Form.Input
                onChange={(e, data) => this.setState({
                  newProject: {
                    ...newProject,
                    name: data.value,
                    team_id: team.active.id
                  }
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
                onClick={this._onCreateProject}
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
