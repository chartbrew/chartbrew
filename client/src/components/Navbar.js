import React, { useEffect, useState } from "react";
import PropTypes from "prop-types";
import { connect } from "react-redux";
import { withRouter } from "react-router";
import { Link } from "react-router-dom";
import {
  Menu, Dropdown, Dimmer, Container, Loader, Icon, Modal, Button, Image, TransitionablePortal,
} from "semantic-ui-react";
import UserAvatar from "react-user-avatar";

import { getTeam } from "../actions/team";
import { logout } from "../actions/user";
import { getProject, changeActiveProject } from "../actions/project";
import { getProjectCharts } from "../actions/chart";
import FeedbackForm from "./FeedbackForm";
import cbLogo from "../assets/logo_inverted.png";
import canAccess from "../config/canAccess";
import { DOCUMENTATION_HOST } from "../config/settings";
/*
  Description
*/

function Navbar(props) {
  const [loading, setLoading] = useState(true);
  const [changelogPadding, setChangelogPadding] = useState(true);
  const [feedbackModal, setFeedbackModal] = useState();
  const [teamOwned, setTeamOwned] = useState({});

  const {
    match, getTeam, getProject, changeActiveProject, getProjectCharts,
    hideTeam, transparent, team, teams, projectProp, user, logout,
  } = props;

  useEffect(() => {
    _onTeamChange(match.params.teamId, match.params.projectId);
    setTimeout(() => {
      try {
        Headway.init(HW_config);
        setChangelogPadding(false);
      } catch (e) {
        // ---
      }
    }, 1000);
  }, []);

  useEffect(() => {
    if (teams.length > 0) {
      teams.map((t) => {
        t.TeamRoles.map((tr) => {
          if (tr.user_id === user.id && tr.role === "owner") {
            setTeamOwned(t);
          }
          return tr;
        });
        return t;
      });
    }
  }, [teams]);

  const _onTeamChange = (teamId, projectId) => {
    setLoading(true);
    getTeam(teamId)
      .then(() => {
        setLoading(false);
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
        // props.history.push(`/${teamId}/${projectId}/dashboard`);
        setLoading(false);
      })
      .catch(() => {});
  };

  const _canAccess = (role, teamData) => {
    if (teamData) {
      return canAccess(role, user.id, teamData.TeamRoles);
    }
    return canAccess(role, user.id, team.TeamRoles);
  };

  const handleItemClick = () => {
    // TODO
  };

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
    <Menu fixed="top" color="violet" inverted style={transparent ? styles.transparentMenu : { }}>
      <Menu.Item style={styles.logoContainer} as={Link} to="/user">
        <Image centered as="img" src={cbLogo} alt="Chartbrew logo" style={styles.logo} />
      </Menu.Item>
      {!hideTeam
        && (
        <Menu.Menu
          onClick={handleItemClick}
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
                             onClick={() => _onTeamChange(team.id, project.id)}
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
          className="changelog-trigger"
          as="a"
          style={{ paddingTop: 0, paddingBottom: 0, paddingLeft: 0 }}
          title="Changelog"
        >
          <div className="changelog-badge">
            {changelogPadding && <span style={{ paddingLeft: 16, paddingRight: 16 }} />}
          </div>
          Updates
        </Menu.Item>
        <Menu.Item
          as="a"
          href={DOCUMENTATION_HOST}
          target="_blank"
          rel="noopener noreferrer"
        >
          <Icon name="book" />
          Documentation
        </Menu.Item>
        <Menu.Item onClick={() => setFeedbackModal(true)}>
          <Icon name="lightbulb outline" />
          Suggestions
        </Menu.Item>
        <Dropdown
          style={{ paddingTop: 0, paddingBottom: 0 }}
          item
          floating={transparent}
          trigger={user.icon
            ? <UserAvatar size="32" name={user.icon} color="purple" /> : <span />}
        >
          <Dropdown.Menu>
            <Dropdown.Item as={Link} to="/user">My space</Dropdown.Item>
            <Dropdown.Item as={Link} to="/edit">Profile</Dropdown.Item>

            {_canAccess("admin", teamOwned) && <Dropdown.Divider />}
            {_canAccess("admin", teamOwned) && <Dropdown.Item as={Link} to={`/manage/${team.id || teamOwned.id}/settings`}>Team settings</Dropdown.Item>}

            <Dropdown.Divider />
            <Dropdown.Item
              as="a"
              href="https://chartbrew.com/blog/tag/tutorial/"
              target="_blank"
              rel="noopener noreferrer"
            >
              <Icon name="student" />
              Tutorials
            </Dropdown.Item>
            <Dropdown.Item
              as="a"
              href="https://github.com/razvanilin/chartbrew"
              target="_blank"
              rel="noopener noreferrer"
            >
              <Icon name="github" />
              GitHub
            </Dropdown.Item>
            <Dropdown.Item
              as="a"
              href="https://discord.gg/KwGEbFk"
              target="_blank"
              rel="noopener noreferrer"
            >
              <Icon name="discord" />
              Discord
            </Dropdown.Item>
            <Dropdown.Item
              as="a"
              href="https://join.slack.com/t/chartbrew/shared_invite/enQtODU3MzYzNTkwOTMwLTZiOTA5YzczODUzZGFiZmQyMGI1ZGVmZGI4YTVmOTBkMTI0YzQ2ZjJjOGI5NzQ0NmNmYzRmMDk3MmY4YmI4MTI"
              target="_blank"
              rel="noopener noreferrer"
            >
              <Icon name="slack" />
              Slack
            </Dropdown.Item>

            <Dropdown.Divider />
            <Dropdown.Item onClick={logout}>
              <Icon name="sign out" />
              Sign out
            </Dropdown.Item>
          </Dropdown.Menu>
        </Dropdown>
      </Menu.Menu>

      <TransitionablePortal open={feedbackModal}>
        <Modal
          open={feedbackModal}
          size="small"
          onClose={() => setFeedbackModal(false)}
        >
          <Modal.Content>
            <FeedbackForm />
          </Modal.Content>
          <Modal.Actions>
            <Button onClick={() => setFeedbackModal(false)}>
              Cancel
            </Button>
          </Modal.Actions>
        </Modal>
      </TransitionablePortal>
    </Menu>
  );
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
    width: 70,
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
