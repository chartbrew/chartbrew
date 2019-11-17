import React, { Component } from "react";
import PropTypes from "prop-types";
import { connect } from "react-redux";
import { Link } from "react-router-dom";

import {
  Button, Icon, Header, Input, Popup, Form, Container
} from "semantic-ui-react";

import Chart from "./Chart";
import { updateProject, changeActiveProject } from "../actions/project";
import { cleanErrors as cleanErrorsAction } from "../actions/error";

/*
  Description
*/
class PublicDashboardEditor extends Component {
  constructor(props) {
    super(props);

    this.state = {
      dashboardTitle: "",
      noPublic: true,
    };
  }

  componentDidMount() {
    const { cleanErrors } = this.props;
    cleanErrors();
    this._checkIfNoPublic();
  }

  componentDidUpdate(prevProps) {
    if (prevProps.charts.length < 1) {
      this._checkIfNoPublic();
    }
  }

  _checkIfNoPublic = () => {
    const { charts } = this.props;

    if (charts) {
      for (let i = 0; i < charts.length; i++) {
        if (charts[i].public) {
          this.setState({ noPublic: false });
          break;
        }
      }
    }
  }

  _updateTitle = () => {
    const { updateProject, match, changeActiveProject } = this.props;
    const { dashboardTitle } = this.state;

    if (!dashboardTitle) {
      this.setState({ editingTitle: false });
      return;
    }

    this.setState({ titleLoading: true });
    updateProject(match.params.projectId, {
      dashboardTitle,
    })
      .then(() => {
        return changeActiveProject(match.params.projectId);
      })
      .then(() => {
        this.setState({ editingTitle: false, titleLoading: false });
      })
      .catch(() => {
        this.setState({ editingTitle: false, titleLoading: false });
      });
  }

  render() {
    const { project, charts, match } = this.props;
    const {
      noPublic, editingTitle, dashboardTitle, titleLoading,
    } = this.state;

    return (
      <div style={styles.container}>
        <div style={styles.previewButton}>
          <Button
            as={Link}
            to={`/b/${project.brewName}`}
            primary
            icon
            labelPosition="right"
            disabled={noPublic}
          >
            <Icon name="eye" />
            View your public dashboard
          </Button>
        </div>

        {!editingTitle
          && (
          <Header textAlign="center" size="huge" dividing onClick={() => this.setState({ editingTitle: true })}>
            <Popup
              trigger={(
                <a style={styles.editTitle}>
                  { project.dashboardTitle || project.name }
                </a>
              )}
              content="Edit your public dashboard title"
            />
          </Header>
          )}

        {editingTitle
          && (
          <Container fluid textAlign="center">
            <Form style={{ display: "inline-block" }} size="big">
              <Form.Group>
                <Form.Field>
                  <Input
                    placeholder="Enter a title"
                    value={dashboardTitle || project.dashboardTitle || project.name}
                    onChange={(e, data) => this.setState({ dashboardTitle: data.value })}
                  />
                </Form.Field>
                <Form.Field>
                  <Button
                    secondary
                    icon
                    labelPosition="right"
                    type="submit"
                    onClick={this._updateTitle}
                    loading={titleLoading}
                    size="big"
                  >
                    <Icon name="checkmark" />
                    Save
                  </Button>
                </Form.Field>
              </Form.Group>
            </Form>
          </Container>
          )}

        {noPublic
          && (
          <Container textAlign="center" style={{ paddingTop: 50 }}>
            <Header as="h1">
              {"You don't have any public charts yet"}
              <Header.Subheader>
                {"You can make a chart public from the individual chart menu on the main dashboard"}
              </Header.Subheader>
            </Header>

            <Button
              primary
              as={Link}
              to={`/${match.params.teamId}/${match.params.projectId}/dashboard`}
              size="large"
            >
              Go to dashboard
            </Button>
          </Container>
          )}

        <Chart isPublic charts={charts} />
      </div>
    );
  }
}
const styles = {
  container: {
    flex: 1,
    padding: 10,
    paddingLeft: 20,
  },
  previewButton: {
    padding: 10,
    paddingBottom: 0,
  },
};
PublicDashboardEditor.propTypes = {
  charts: PropTypes.array.isRequired,
  project: PropTypes.object.isRequired,
  match: PropTypes.object.isRequired,
  updateProject: PropTypes.func.isRequired,
  changeActiveProject: PropTypes.func.isRequired,
  cleanErrors: PropTypes.func.isRequired,
};

const mapStateToProps = (state) => {
  return {
    charts: state.chart.data,
    project: state.project.active,
  };
};

const mapDispatchToProps = (dispatch) => {
  return {
    updateProject: (projectId, data) => dispatch(updateProject(projectId, data)),
    changeActiveProject: (projectId) => dispatch(changeActiveProject(projectId)),
    cleanErrors: () => dispatch(cleanErrorsAction()),
  };
};

export default connect(mapStateToProps, mapDispatchToProps)(PublicDashboardEditor);
