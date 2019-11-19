import React, { Component } from "react";
import PropTypes from "prop-types";
import { connect } from "react-redux";
import { Link } from "react-router-dom";
import {
  Divider, Dimmer, Loader, Form, Modal, List, Header, Message, Container,
  Segment, Button, Icon, Card,
} from "semantic-ui-react";

import { getTeams, createTeam, saveActiveTeam } from "../actions/team";
import { getUser, relog as relogAction } from "../actions/user";
import { cleanErrors as cleanErrorsAction } from "../actions/error";
import ProjectForm from "../components/ProjectForm";
import InviteMembersForm from "../components/InviteMembersForm";
import Invites from "../components/Invites";
import Navbar from "../components/Navbar";
import canAccess from "../config/canAccess";
/*
  Description
*/

class UserDashboard extends Component {
  constructor(props) {
    super(props);

    this.state = {
      loading: false,
      createTeamModal: false,
      addMembersModal: false,
      submitError: false,
      name: "",
      addProject: false,
      selectedTeamId: -1,
      fetched: false,
    };
  }

  componentDidMount() {
    const { relog, cleanErrors } = this.props;
    cleanErrors();
    relog();
    this._getTeams();
  }

  componentDidUpdate(prevProps) {
    const { errors } = this.props;
    const { fetched, limitationModal } = this.state;
    if (!fetched && prevProps.user.data.id && !prevProps.user.loading) {
      this._getTeams();
    }

    if (!limitationModal) {
      errors.map((error) => {
        if (error.code === 406 && error.pathname === window.location.pathname) {
          this.setState({ limitationModal: true });
        }
        return true;
      });
    }
  }

  setTeamIcon(role) {
    switch (role) {
      case "member":
        return "user";
      case "owner":
        return "star";
      case "editor":
        return "edit";
      case "admin":
        return "star half full";
      default: return "user";
    }
  }

  _getTeams = () => {
    const { getTeams, user } = this.props;
    const { retried } = this.state;

    this.setState({ fetched: true, loading: true });
    getTeams(user.data.id)
      .then(() => {
        this.setState({ loading: false });
      })
      .catch(() => {
        if (!retried) {
          this._getTeams();
        }
        this.setState({ loading: false, retried: true });
      });
  }

  handleChange = (e, { name, value }) => this.setState({ [name]: value });

  createTeam = () => {
    const { createTeam, user, saveActiveTeam } = this.props;
    const { name } = this.state;

    this.setState({ loading: true });
    createTeam(user.data.id, name)
      .then((newTeam) => {
        // set team to saveActiveTeam
        saveActiveTeam(newTeam);
        this.setState({
          canCreateTeam: false, loading: false, createTeamModal: false, addMembersModal: true, name: "" // eslint-disable-line
        });
      }).catch(() => {
        this.setState({ submitError: true, loading: false });
      });
  }

  _onProjectCreated = () => {
    const { getTeams, user } = this.props;

    getTeams(user.data.id);
    this.setState({ addProject: false });
  }

  /* Modal to invite team members  */
  invitationModal = () => {
    const { addMembersModal } = this.state;

    return (
      <Modal
        open={addMembersModal}
        onClose={() => this.setState({ addMembersModal: false })}
        size="small"
        closeIcon
          >
        <InviteMembersForm
          skipTeamInvite={() => this.setState({ addMembersModal: false })}
            />
      </Modal>
    );
  }


  /* Modal to create new team  */
  newTeamModal = () => {
    const {
      createTeamModal, submitError, loading, name,
    } = this.state;

    return (
      <Modal
        open={createTeamModal}
        onClose={() => this.setState({ createTeamModal: false })}
        size="mini"
        closeIcon
        >
        <Modal.Header> Create a new Team </Modal.Header>
        <Modal.Content>
          <Form onSubmit={this.createTeam}>
            <Form.Input label="Team name *" placeholder="Enter a name for your team" name="name" value={name} onChange={this.handleChange} />
            <Divider />
            {submitError
            && (
            <Container textAlign="center" style={{ margin: "1em" }}>
              <Message negative> There was an error creating a new team. </Message>
            </Container>
            )}
            <Form.Button loading={loading} disabled={!name} type="submit" floated="right" compact size="large" primary icon labelPosition="right">
              {" "}
              Submit
              <Icon name="arrow right" />
              {" "}
            </Form.Button>
          </Form>
        </Modal.Content>
        <Divider hidden />
      </Modal>
    );
  }

  newProjectModal = () => {
    const { addProject, selectedTeamId } = this.state;

    return (
      <Modal
        open={addProject}
        onClose={() => this.setState({ addProject: false })}
        size="tiny"
        closeIcon>
        <ProjectForm onComplete={this._onProjectCreated} teamId={selectedTeamId} />
      </Modal>
    );
  }

  limitationModal = () => {
    const { team, cleanErrors } = this.props;
    const { limitationModal } = this.state;
    return (
      <Modal
        open={limitationModal && !!team.id}
        size="small"
        onClose={() => {
          this.setState({ limitationModal: false });
          cleanErrors();
        }}
      >
        <Header
          content="Oh no! You've reached the limits of your plan"
          inverted
        />
        <Modal.Content>
          You can create more projects when you upgrade your current plan. Want to have a look?
        </Modal.Content>
        <Modal.Actions>
          <Button
            onClick={() => {
              this.setState({ limitationModal: false });
              cleanErrors();
            }}
          >
            Close
          </Button>
          <Link to={`/manage/${team.id}/plans`}>
            <Button
              positive
            >
              See the plans
            </Button>
          </Link>
        </Modal.Actions>
      </Modal>
    );
  }

  directToProject = (team, projectId) => {
    const { saveActiveTeam, history } = this.props;

    saveActiveTeam(team);
    history.push(`/${team.id}/${projectId}/dashboard`);
  }

  _onNewProject = (team) => {
    const { saveActiveTeam } = this.props;
    this.setState({ addProject: true });

    saveActiveTeam(team);
  }

  _canAccess(role, teamRoles) {
    const { user } = this.props;
    return canAccess(role, user.data.id, teamRoles);
  }

  render() {
    const { user, teams } = this.props;
    const { loading } = this.state;

    if (!user.data.id) {
      return (
        <div style={styles.container}>
          <Dimmer active={loading}>
            <Loader />
          </Dimmer>
        </div>
      );
    }

    return (
      <div style={styles.container}>
        <Navbar hideTeam transparent />
        <Container textAlign="center" style={styles.mainContent}>
          <Header textAlign="center" as="h2" inverted>Your teams</Header>
          {loading && <Loader inverted active={loading} />}

          <Invites />
          {this.newTeamModal()}
          {this.invitationModal()}
          {this.newProjectModal()}
          {this.limitationModal()}

          <List>
            {teams && teams.map((key) => {
              return (
                <List.Item key={key.id} style={styles.listItem}>
                  <Segment attached="top" raised>
                    <Header textAlign="center" as="h3" content={key.name} />
                  </Segment>
                  <Segment style={styles.violetSection} raised attached clearing>
                    {this._canAccess("admin", key.TeamRoles)
                      && (
                      <Button
                        style={{ marginTop: -55, float: "right" }}
                        size="small"
                        secondary
                        icon
                        labelPosition="right"
                        as={Link}
                        to={`/manage/${key.id}/members`}
                      >
                        <Icon name="settings" />
                        Settings
                      </Button>
                      )}

                    {key.TeamRoles[0] && key.TeamRoles.map((teamRole) => {
                      return (
                        teamRole.user_id === user.data.id
                          && (
                          <span key={teamRole.user_id}>
                            <Icon inverted circular name={this.setTeamIcon(teamRole.role)} size="large" color="blue" />
                            <List.Description style={styles.listRole} content={`team ${teamRole.role}`} />
                          </span>
                          )
                      );
                    })}
                    <Container style={{ paddingTop: 20 }}>
                      <Card.Group itemsPerRow={3} stackable centered>
                        {key.Projects && key.Projects.map((project) => {
                          return (
                            <Card
                              style={styles.card}
                              key={project.id}
                              onClick={() => this.directToProject(key, project.id)}>
                              <Card.Content>
                                <Header size="large">{project.name}</Header>
                              </Card.Content>
                            </Card>
                          );
                        })}
                        {this._canAccess("admin", key.TeamRoles)
                          && (
                          <Card
                            style={styles.card}
                            onClick={() => this._onNewProject(key)}
                          >
                            <Card.Content>
                              <List.Icon name="add circle" size="large" color="green" />
                            </Card.Content>
                            <Card.Content extra> Add a new project </Card.Content>
                          </Card>
                          )}
                      </Card.Group>
                    </Container>
                  </Segment>
                </List.Item>
              );
            })}
          </List>
        </Container>
      </div>
    );
  }
}

const styles = {
  container: {
    flex: 1,
    backgroundColor: "#103751",
    minHeight: window.innerHeight,
  },
  listContent: {
    cursor: "pointer",
  },
  teamHeader: {
    cursor: "pointer",
    backgroundColor: "",
  },
  listItem: {
    margin: "4em",
  },
  listRole: {
    color: "white",
    fontSize: "13px"
  },
  card: {
    backgroundColor: "white",
  },
  blueSection: {
    backgroundColor: "#103751",
    borderColor: "#103751",
  },
  mainContent: {
    backgroundColor: "#103751",
    borderColor: "#103751",
    paddingTop: 50,
  },
  violetSection: {
    backgroundColor: "#1a7fa0",
    borderColor: "#1a7fa0",
  },
};

UserDashboard.propTypes = {
  user: PropTypes.object.isRequired,
  teams: PropTypes.array.isRequired,
  getTeams: PropTypes.func.isRequired,
  createTeam: PropTypes.func.isRequired,
  saveActiveTeam: PropTypes.func.isRequired,
  history: PropTypes.object.isRequired,
  relog: PropTypes.func.isRequired,
  cleanErrors: PropTypes.func.isRequired,
  errors: PropTypes.array.isRequired,
  team: PropTypes.object.isRequired,
};

const mapStateToProps = (state) => {
  return {
    user: state.user,
    teams: state.team.data,
    team: state.team.active,
    errors: state.error,
  };
};

const mapDispatchToProps = (dispatch) => {
  return {
    getUser: (id) => dispatch(getUser(id)),
    getTeams: (userId) => dispatch(getTeams(userId)),
    createTeam: (userId, name) => dispatch(createTeam(userId, name)),
    saveActiveTeam: (team) => dispatch(saveActiveTeam(team)),
    relog: () => dispatch(relogAction()),
    cleanErrors: () => dispatch(cleanErrorsAction()),
  };
};

export default connect(mapStateToProps, mapDispatchToProps)(UserDashboard);
