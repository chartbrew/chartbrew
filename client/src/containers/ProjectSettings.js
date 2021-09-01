import React, { Component } from "react";
import { connect } from "react-redux";
import { withRouter } from "react-router";
import { PropTypes } from "prop-types";
import {
  Segment, Loader, Divider, Form, Button, Header, Icon, Input, Modal, Message, TransitionablePortal
} from "semantic-ui-react";

import canAccess from "../config/canAccess";
import { updateProject, changeActiveProject, removeProject } from "../actions/project";
import { cleanErrors as cleanErrorsAction } from "../actions/error";

/*
  Component for verifying a new user
*/
class ProjectSettings extends Component {
  constructor(props) {
    super(props);

    this.state = {
      success: false,
      error: false,
    };
  }

  componentDidMount() {
    const { cleanErrors } = this.props;
    cleanErrors();
  }

  _onSaveName = () => {
    const { updateProject, project, changeActiveProject } = this.props;
    const { projectName } = this.state;

    if (!projectName) {
      this.setState({ nameError: true });
      return;
    }

    this.setState({ loading: true, success: false, error: false });
    updateProject(project.id, { name: projectName })
      .then(() => {
        this.setState({ success: true, loading: false });
        changeActiveProject(project.id);
      })
      .catch(() => {
        this.setState({ error: true, loading: false });
      });
  }

  _onRemoveConfirmation = () => {
    this.setState({ removeModal: true });
  }

  _onRemove = () => {
    const { removeProject, project, history } = this.props;

    this.setState({ removeLoading: true, removeError: false });
    removeProject(project.id)
      .then(() => {
        history.push("/user");
      })
      .catch(() => {
        this.setState({ removeError: true, removeLoading: false });
      });
  }

  _canAccess(role) {
    const { user, team } = this.props;
    return canAccess(role, user.id, team.TeamRoles);
  }

  render() {
    const { project, style } = this.props;
    const {
      success, error, loading, nameError, projectName, removeError, removeModal,
      removeLoading,
    } = this.state;

    return (
      <div style={style}>
        <Header attached="top" as="h3">Project settings</Header>
        <Segment attached>
          <Loader active={!project.id} />
          <Form>
            <label>Project name</label>
            <Form.Group>
              <Form.Field error={nameError}>
                <Input
                  placeholder="Type a project name"
                  value={projectName ? projectName /* eslint-disable-line */
                    : project.name ? project.name : ""}
                  onChange={(e, data) => this.setState({ projectName: data.value })}
                />
              </Form.Field>
              <Form.Field>
                <Button
                  type="submit"
                  primary={!success && !error}
                  color={success ? "green" : error ? "red" : null}
                  disabled={!this._canAccess("admin")}
                  icon
                  labelPosition="right"
                  loading={loading}
                  onClick={this._onSaveName}
                >
                  {(success || !error) && <Icon name="checkmark" />}
                  {error && <Icon name="x" />}
                  Save name
                </Button>
              </Form.Field>
            </Form.Group>
          </Form>
          <Divider />

          <Button
            basic
            color="red"
            disabled={!this._canAccess("admin")}
            icon
            labelPosition="right"
            onClick={this._onRemoveConfirmation}
            floated="right"
          >
            <Icon name="x" />
            Remove project
          </Button>
          <Divider hidden section />

          {removeError
            && (
            <Message negative>
              <Message.Header>{"Oh snap! There was a problem with the request"}</Message.Header>
              <p>{"Please refresh the page and try again, or get in touch with us directly through the chat to help you out."}</p>
            </Message>
            )}
        </Segment>

        <TransitionablePortal open={removeModal}>
          <Modal open={removeModal} basic size="small" onClose={() => this.setState({ removeModal: false })}>
            <Header
              icon="exclamation triangle"
              content="Are you sure you want to remove this project?"
            />
            <Modal.Content>
              <p>
                {"This action will be PERMANENT. All the charts, connections and saved queries associated with this project will be deleted as well."}
              </p>
            </Modal.Content>
            <Modal.Actions>
              <Button
                basic
                inverted
                onClick={() => this.setState({ removeModal: false })}
              >
                Go back
              </Button>
              <Button
                color="orange"
                inverted
                loading={removeLoading}
                onClick={this._onRemove}
              >
                <Icon name="x" />
                Remove completely
              </Button>
            </Modal.Actions>
          </Modal>
        </TransitionablePortal>
      </div>
    );
  }
}

// const styles = {
//   container: {
//     flex: 1,
//   },
// };

ProjectSettings.defaultProps = {
  style: {},
};

ProjectSettings.propTypes = {
  style: PropTypes.object,
  user: PropTypes.object.isRequired,
  team: PropTypes.object.isRequired,
  history: PropTypes.object.isRequired,
  project: PropTypes.object.isRequired,
  updateProject: PropTypes.func.isRequired,
  changeActiveProject: PropTypes.func.isRequired,
  removeProject: PropTypes.func.isRequired,
  cleanErrors: PropTypes.func.isRequired,
};

const mapStateToProps = (state) => {
  return {
    user: state.user.data,
    team: state.team.active,
    project: state.project.active,
  };
};

const mapDispatchToProps = (dispatch) => {
  return {
    updateProject: (projectId, data) => dispatch(updateProject(projectId, data)),
    changeActiveProject: (projectId) => dispatch(changeActiveProject(projectId)),
    removeProject: (projectId) => dispatch(removeProject(projectId)),
    cleanErrors: () => dispatch(cleanErrorsAction()),
  };
};

export default withRouter(connect(mapStateToProps, mapDispatchToProps)(ProjectSettings));
