import React, { Component } from "react";
import PropTypes from "prop-types";
import { connect } from "react-redux";
import { withRouter } from "react-router";
import { Link } from "react-router-dom";
import {
  Menu, Dropdown, Dimmer, Container, Loader, Icon, Modal, Button,
} from "semantic-ui-react";
import UserAvatar from "react-user-avatar";

import { getTeam } from "../actions/team";
import { logout } from "../actions/user";
import { getProject, changeActiveProject } from "../actions/project";
import { getProjectCharts } from "../actions/chart";
import FeedbackForm from "./FeedbackForm";
import cbLogo from "../assets/cb_logo_4_small_inverted.png";
import canAccess from "../config/canAccess";
import { DOCUMENTATION_HOST } from "../config/settings";
/*
  Description
*/

class Navbar extends Component {
  constructor(props) {
    super(props);

    this.state = {
      loading: true,
    };
  }

  componentDidMount() {
    const { match } = this.props;
    this._onTeamChange(match.params.teamId, match.params.projectId);
  }

  _onTeamChange = (teamId, projectId) => {
    const {
      getTeam, getProject, changeActiveProject, getProjectCharts,
    } = this.props;

    this.setState({ loading: true });
    getTeam(teamId)
      .then(() => {
        this.setState({ loading: false });
        return new Promise(resolve => resolve(true));
      })
      .then(() => {
        return getProject(projectId);
      })
      .then(() => {
        return changeActiveProject(projectId);
      })
      .then(() => {
        return getProjectCharts(projectId);
      })
      .then(() => {
        // this.props.history.push(`/${teamId}/${projectId}/dashboard`);
        this.setState({ loading: false });
      })
      .catch(() => {});
  }

  _canAccess(role) {
    const { user, team } = this.props;
    return canAccess(role, user.id, team.TeamRoles);
  }

  render() {
    const {
      hideTeam, transparent, team, teams, projectProp, user, logout,
    } = this.props;
    const { loading, feedbackModal } = this.state;

    if (!team.id && !teams) {
      return (
        <Container text style={styles.container}>
          <Dimmer active={loading}>
            <Loader />
          </Dimmer>
        </Container>
      );
    }
    return (
      <Menu fixed="top" color="violet" inverted style={transparent ? styles.transparentMenu : { boxShadow: "0px 0px 5px" }}>
        <Menu.Item style={styles.logoContainer} as={Link} to="/user">
          <img src={cbLogo} alt="Chartbrew logo" style={styles.logo} />
        </Menu.Item>
        {!hideTeam
          && (
          <Menu.Menu
            onClick={this.handleItemClick}
          >
            <Dropdown text={team.name} item style={styles.centeredDropdown}>
              <Dropdown.Menu>
                <Dropdown.Header>{"Select a team"}</Dropdown.Header>
                <Dropdown.Divider />
                {teams && teams.map((team) => {
                  return (
                    team.Projects.length > 0
                     && (
                     <Dropdown
                       disabled={team.Projects.length < 1}
                       item
                       key={team.id}
                       text={team.name}>
                       <Dropdown.Menu>
                         {team.Projects.map((project) => {
                           return (
                             <Dropdown.Item
                               onClick={() => this._onTeamChange(team.id, project.id)}
                               disabled={project.id === projectProp.id}
                               key={project.id}>
                               {project.id === projectProp.id
                              && (
                              <span className="label">
                                Active
                              </span>
                              )}
                               <span>
                                 {" "}
                                 {project.name}
                                 {" "}
                               </span>
                             </Dropdown.Item>
                           );
                         })}
                       </Dropdown.Menu>
                     </Dropdown>
                     )
                  );
                }) }
              </Dropdown.Menu>
            </Dropdown>
          </Menu.Menu>
          )}

        <Menu.Menu position="right">
          <Menu.Item
            as="a"
            href={DOCUMENTATION_HOST}
            target="_blank"
            rel="noopener noreferrer"
          >
            <Icon name="book" />
            Documentation
          </Menu.Item>
          <Menu.Item onClick={() => this.setState({ feedbackModal: true })}>
            <Icon name="lightbulb outline" />
            Suggestions
          </Menu.Item>
          <Dropdown
            style={{ paddingTop: 0, paddingBottom: 0 }}
            item
            pointing={transparent}
            trigger={user.icon
              ? <UserAvatar size="32" name={user.icon} color="purple" /> : <span />}
          >
            <Dropdown.Menu>
              <Dropdown.Item as={Link} to="/user">My space</Dropdown.Item>
              <Dropdown.Item as={Link} to="/edit">Profile</Dropdown.Item>

              {!hideTeam && this._canAccess("admin") && <Dropdown.Divider />}
              {!hideTeam && this._canAccess("admin") && <Dropdown.Item as={Link} to={`/manage/${team.id}/settings`}>Team settings</Dropdown.Item>}

              <Dropdown.Divider />
              <Dropdown.Item
                as="a"
                href="https://github.com/razvanilin/chartbrew"
                target="_blank"
                rel="noopener noreferrer"
              >
                <Icon name="github" />
                GitHub
              </Dropdown.Item>

              <Dropdown.Divider />
              <Dropdown.Item onClick={logout}>
                <Icon name="sign out" />
                Sign out
              </Dropdown.Item>
            </Dropdown.Menu>
          </Dropdown>
        </Menu.Menu>

        <Modal
          open={feedbackModal}
          size="small"
          onClose={() => this.setState({ feedbackModal: false })}
        >
          <Modal.Content>
            <FeedbackForm />
          </Modal.Content>
          <Modal.Actions>
            <Button onClick={() => this.setState({ feedbackModal: false })}>
              Cancel
            </Button>
          </Modal.Actions>
        </Modal>
      </Menu>
    );
  }
}

const styles = {
  container: {
    flex: 1,
  },
  centeredDropdown: {
    display: "block",
    textAlign: "center",
    width: 250,
  },
  transparentMenu: {
    backgroundColor: "transparent",
  },
  logo: {
    width: 30,
  },
  logoContainer: {
    paddingTop: 1,
    paddingBottom: 1,
  },
};

Navbar.defaultProps = {
  hideTeam: false,
  transparent: false,
};

Navbar.propTypes = {
  user: PropTypes.object.isRequired,
  team: PropTypes.object.isRequired,
  teams: PropTypes.array.isRequired,
  projectProp: PropTypes.object.isRequired,
  match: PropTypes.object.isRequired,
  getTeam: PropTypes.func.isRequired,
  getProject: PropTypes.func.isRequired,
  changeActiveProject: PropTypes.func.isRequired,
  getProjectCharts: PropTypes.func.isRequired,
  logout: PropTypes.func.isRequired,
  hideTeam: PropTypes.bool,
  transparent: PropTypes.bool,
};

const mapStateToProps = (state) => {
  return {
    user: state.user.data,
    team: state.team.active,
    teams: state.team.data,
    projectProp: state.project.active,
  };
};

const mapDispatchToProps = (dispatch) => {
  return {
    getTeam: id => dispatch(getTeam(id)),
    getProject: id => dispatch(getProject(id)),
    changeActiveProject: id => dispatch(changeActiveProject(id)),
    logout: () => dispatch(logout()),
    getProjectCharts: (projectId) => dispatch(getProjectCharts(projectId)),
  };
};

export default withRouter(connect(mapStateToProps, mapDispatchToProps)(Navbar));
