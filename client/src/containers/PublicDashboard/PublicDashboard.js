/* eslint-disable react/jsx-props-no-spreading */

import React, { useState, useEffect, useCallback } from "react";
import PropTypes from "prop-types";
import { Link } from "react-router-dom";
import {
  Button, Checkbox, Container, Dimmer, Divider, Form, Grid, Header, Icon, Input,
  Label, Loader, Menu, Message, Modal, Popup, TransitionablePortal,
} from "semantic-ui-react";
import { connect } from "react-redux";
import { TwitterPicker } from "react-color";
import { createMedia } from "@artsy/fresnel";
import { Helmet } from "react-helmet";
import { clone } from "lodash";
import { useDropzone } from "react-dropzone";
import { useWindowSize } from "react-use";
import { ToastContainer, toast, Flip } from "react-toastify";
import "react-toastify/dist/ReactToastify.min.css";
import AceEditor from "react-ace";
import "ace-builds/src-min-noconflict/mode-css";
import "ace-builds/src-min-noconflict/theme-tomorrow";

import {
  getPublicDashboard as getPublicDashboardAction,
  getProject as getProjectAction,
  updateProject as updateProjectAction,
  updateProjectLogo as updateProjectLogoAction,
} from "../../actions/project";
import { updateTeam as updateTeamAction } from "../../actions/team";
import { blue, primary, secondary } from "../../config/colors";
import Chart from "../Chart/Chart";
import logo from "../../assets/logo_inverted.png";
import { API_HOST, SITE_HOST } from "../../config/settings";
import canAccess from "../../config/canAccess";

const breakpoints = {
  mobile: 0,
  tablet: 768,
  computer: 1024,
};
const AppMedia = createMedia({ breakpoints });
const { Media } = AppMedia;

const defaultColors = [
  "#FFFFFF", "#000000", "#D9E3F0", "#F47373", "#697689", "#37D67A", primary, secondary, blue,
  "#2CCCE4", "#555555", "#dce775", "#ff8a65", "#ba68c8",
];

function PublicDashboard(props) {
  const {
    getPublicDashboard, match, getProject, updateProject, updateProjectLogo, charts,
    updateTeam, user, teams,
  } = props;

  const [project, setProject] = useState({});
  const [loading, setLoading] = useState(false);
  const [editingTitle, setEditingTitle] = useState(false);
  const [editorVisible, setEditorVisible] = useState(false);
  const [isSaved, setIsSaved] = useState(true);
  const [saveLoading, setSaveLoading] = useState(false);
  const [newChanges, setNewChanges] = useState({
    backgroundColor: "#1F77B4",
    titleColor: "black",
  });
  const [logoPreview, setLogoPreview] = useState(null);
  const [showSettings, setShowSettings] = useState(false);
  const [newBrewName, setNewBrewName] = useState("");
  const [error, setError] = useState("");
  const [helpActive, setHelpActive] = useState(false);
  const [noCharts, setNoCharts] = useState(false);

  const onDrop = useCallback((acceptedFiles) => {
    setNewChanges({ ...newChanges, logo: acceptedFiles });
    setIsSaved(false);

    const reader = new FileReader(); // eslint-disable-line
    reader.onloadend = () => {
      setLogoPreview(reader.result);
    };

    reader.readAsDataURL(acceptedFiles[0]);
  });

  const { getRootProps, getInputProps } = useDropzone({
    accept: "image/*",
    onDrop,
  });

  const { width } = useWindowSize();

  useEffect(() => {
    setLoading(true);
    _fetchProject();
  }, []);

  useEffect(() => {
    if (project.id) {
      setNewChanges({
        backgroundColor: project.backgroundColor || blue,
        titleColor: project.titleColor || "white",
        dashboardTitle: project.dashboardTitle || project.name,
        description: project.description,
        logo: project.logo && `${API_HOST}/${project.logo}`,
        headerCode: project.headerCode || "",
      });

      setNewBrewName(project.brewName);
    }
  }, [project]);

  useEffect(() => {
    if (project.id
      && (newChanges.backgroundColor !== project.backgroundColor
      || newChanges.titleColor !== project.titleColor
      || newChanges.dashboardTitle !== project.dashboardTitle
      || newChanges.description !== project.description
      || ((newChanges.headerCode || project.headerCode !== null)
        && newChanges.headerCode !== project.headerCode))
    ) {
      setIsSaved(false);
    }
  }, [newChanges]);

  const _fetchProject = () => {
    setLoading(true);
    getPublicDashboard(match.params.brewName)
      .then((data) => {
        setProject(data);
        setLoading(false);

        // now get the project (mainly to check if the user can edit)
        getProject(data.id)
          .then(() => {
            setEditorVisible(true);
          })
          .catch(() => {});
      })
      .catch((err) => {
        if (err === 404) {
          setNoCharts(true);
        } else {
          toast.error("Could not get the the dashboard data. Please try refreshing the page.");
        }
      });
  };

  const _isPublic = () => {
    return charts.filter((c) => c.public).length > 0;
  };

  const _onChangeBrewName = (e, data) => {
    setNewBrewName(data.value);
  };

  const _onSaveBrewName = () => {
    if (!newBrewName) return;

    setSaveLoading(true);
    updateProject(project.id, { brewName: newBrewName })
      .then((project) => {
        setSaveLoading(false);
        setIsSaved(true);
        window.location.href = `${SITE_HOST}/b/${project.brewName}`;
      })
      .catch(() => {
        setSaveLoading(false);
        setError("This dashboard URL is already taken. Please try another one.");
      });
  };

  const _onSaveChanges = () => {
    setSaveLoading(true);
    const updateData = clone(newChanges);
    if (updateData.logo) delete updateData.logo;

    updateProject(project.id, updateData)
      .then(async () => {
        if (typeof newChanges.logo === "object" && newChanges.logo !== null) {
          await updateProjectLogo(project.id, newChanges.logo);
        }

        setSaveLoading(false);
        _fetchProject();
        setIsSaved(true);
        toast.success("The dashboard has been updated!");
      })
      .catch(() => {
        toast.error("Oh no! We couldn't update the dashboard. Please try again");
      });
  };

  const _onToggleBranding = () => {
    updateTeam(project.team_id, { showBranding: !project.Team.showBranding })
      .then(() => {
        _fetchProject();
      })
      .catch(() => {});
  };

  const _canAccess = (role) => {
    const team = teams.filter((t) => t.id === project.team_id)[0];
    if (!team) return false;
    return canAccess(role, user.id, team.TeamRoles);
  };

  if (noCharts && user.id) {
    return (
      <div>
        <Container text textAlign="center">
          <Divider section hidden />
          <Header>{"This dashbord does not contain any public charts"}</Header>
          <Divider section hidden />

          <Button
            primary
            content="Go back"
            onClick={() => window.history.back()}
          />
        </Container>
      </div>
    );
  }

  if (noCharts && !user.id) {
    return (
      <div>
        <Container text textAlign="center">
          <Divider section hidden />
          <Header>{"This dashbord does not contain any public charts"}</Header>
          <Divider section hidden />
        </Container>
      </div>
    );
  }

  return (
    <div>
      <Helmet>
        {(newChanges.headerCode || project.headerCode) && (
          <style type="text/css">{newChanges.headerCode || project.headerCode}</style>
        )}
        <style type="text/css">
          {`
            body {
              background-color: ${newChanges.backgroundColor};
            }
          `}
        </style>
      </Helmet>
      {editorVisible && (
        <Menu color="blue" inverted size="large">
          <Menu.Item icon as={Link} to={`/${project.team_id}/${project.id}/dashboard`}>
            <Popup
              trigger={(
                <Icon name="arrow left" />
              )}
              content="Back to your dashboard"
            />
          </Menu.Item>
          {!isSaved && (
            <Menu.Item>
              <Media at="mobile">
                <Button
                  secondary
                  content="Save"
                  size="small"
                  icon="checkmark"
                  loading={saveLoading}
                  onClick={_onSaveChanges}
                />
              </Media>
              <Media greaterThan="mobile">
                <Button
                  secondary
                  content="Save changes"
                  size="small"
                  icon="checkmark"
                  loading={saveLoading}
                  onClick={_onSaveChanges}
                />
              </Media>
            </Menu.Item>
          )}
          <Menu.Menu position="right">
            {_canAccess("editor") && (
              <Popup
                trigger={(
                  <Menu.Item icon>
                    <Icon name="image" />
                  </Menu.Item>
                )}
                on="click"
                position={width < breakpoints.tablet ? "bottom center" : "bottom right"}
              >
                <>
                  <Header size="small">Change background</Header>
                  <TwitterPicker
                    color={newChanges.backgroundColor}
                    onChangeComplete={(color) => {
                      const rgba = `rgba(${color.rgb.r}, ${color.rgb.g}, ${color.rgb.b}, ${color.rgb.a})`;
                      setNewChanges({ ...newChanges, backgroundColor: rgba });
                    }}
                    colors={defaultColors}
                  />
                  <Divider />
                  <Header size="small">Change text color</Header>
                  <TwitterPicker
                    color={newChanges.titleColor}
                    onChangeComplete={(color) => {
                      const rgba = `rgba(${color.rgb.r}, ${color.rgb.g}, ${color.rgb.b}, ${color.rgb.a})`;
                      setNewChanges({ ...newChanges, titleColor: rgba });
                    }}
                    colors={defaultColors}
                  />
                </>
              </Popup>
            )}
            {_canAccess("editor") && (
              <Popup
                trigger={(
                  <Menu.Item icon onClick={() => setEditingTitle(true)}>
                    <Icon name="pencil" />
                  </Menu.Item>
                )}
                content="Edit the dashboard information and style"
              />
            )}
            {_canAccess("admin") && (
              <Popup
                trigger={(
                  <Menu.Item icon onClick={() => setShowSettings(true)}>
                    <Icon name="cogs" />
                  </Menu.Item>
                )}
                content="Dashboard settings"
              />
            )}
          </Menu.Menu>
        </Menu>
      )}

      {charts && charts.length > 0 && _isPublic()
        && (
          <div className="main-container" style={{ padding: 20, position: "relative" }}>
            <Dimmer active={loading}>
              <Loader active={loading}>
                Preparing the dashboard...
              </Loader>
            </Dimmer>
            <Media greaterThan="mobile">
              <Divider hidden />
            </Media>
            <Container text className="title-container">
              {editorVisible && (
                <Popup
                  trigger={(
                    <div className="dashboard-logo-container" {...getRootProps()}>
                      <input {...getInputProps()} />
                      <Media greaterThan="mobile">
                        <img
                          className="dashboard-logo"
                          src={logoPreview || newChanges.logo || logo}
                          height="70"
                          alt={`${project.name} Logo`}
                          style={styles.logoContainer}
                        />
                      </Media>
                      <Media at="mobile">
                        <div style={{ textAlign: "center" }}>
                          <img
                            className="dashboard-logo"
                            src={logoPreview || newChanges.logo}
                            height="70"
                            alt={`${project.name} Logo`}
                            style={styles.logoContainerMobile}
                          />
                        </div>
                      </Media>
                    </div>
                  )}
                  content="Click here to add your own logo"
                  position="bottom left"
                />
              )}

              {!editorVisible && (
                <div className="dashboard-logo-container">
                  <Media greaterThan="mobile">
                    <img
                      className="dashboard-logo"
                      src={project.logo ? `${API_HOST}/${project.logo}` : logo}
                      height="70"
                      alt={`${project.name} Logo`}
                      style={styles.logoContainer}
                    />
                  </Media>
                  <Media at="mobile">
                    <div style={{ textAlign: "center" }}>
                      <img
                        className="dashboard-logo"
                        src={project.logo ? `${API_HOST}/${project.logo}` : logo}
                        height="70"
                        alt={`${project.name} Logo`}
                        style={styles.logoContainerMobile}
                      />
                    </div>
                  </Media>
                </div>
              )}

              <Header
                textAlign="center"
                size="huge"
                style={styles.dashboardTitle(newChanges.titleColor || project.titleColor)}
                className="dashboard-title"
              >
                {newChanges.dashboardTitle || project.dashboardTitle || project.name}
                {!editorVisible && project.description && (
                  <Header.Subheader
                    style={styles.dashboardTitle(project.titleColor)}
                    className="dashboard-sub-title"
                  >
                    {project.description}
                  </Header.Subheader>
                )}
                {editorVisible && newChanges.description && (
                <Header.Subheader
                  style={styles.dashboardTitle(newChanges.titleColor)}
                  className="dashboard-sub-title"
                >
                  {newChanges.description}
                </Header.Subheader>
                )}
              </Header>
            </Container>
            <Divider section hidden />

            <Grid stackable centered style={styles.mainGrid} className="main-chart-grid">
              {charts.map((chart) => {
                if (chart.draft) return (<span style={{ display: "none" }} key={chart.id} />);
                if (!chart.public) return (<span style={{ display: "none" }} key={chart.id} />);

                return (
                  <Grid.Column
                    width={chart.chartSize * 4}
                    key={chart.id}
                    style={styles.chartGrid}
                    className="chart-container"
                  >
                    <Chart
                      isPublic
                      chart={chart}
                      charts={charts}
                      className="chart-card"
                    />
                  </Grid.Column>
                );
              })}
              {project.Team && project.Team.showBranding && (
                <Grid.Column className="footer-content" textAlign="center" style={{ color: newChanges.titleColor }} width={16}>
                  {"Powered by "}
                  <a
                    href={`https://chartbrew.com?ref=${project.brewName}`}
                    target="_blank"
                    rel="noopener noreferrer"
                    style={{ color: newChanges.titleColor, textDecoration: "underline" }}
                  >
                    Chartbrew
                  </a>
                </Grid.Column>
              )}
            </Grid>
          </div>
        )}

      <TransitionablePortal open={editingTitle}>
        <Modal open={editingTitle} onClose={() => setEditingTitle(false)}>
          <Modal.Header>Edit the title and description</Modal.Header>
          <Modal.Content>
            <Form>
              <Form.Field>
                <label>Dashboard title</label>
                <Input
                  placeholder="Enter your dashboard title"
                  value={newChanges.dashboardTitle}
                  onChange={(e, data) => {
                    setNewChanges({ ...newChanges, dashboardTitle: data.value });
                  }}
                />
              </Form.Field>
              <Form.Field>
                <label>Dashboard description</label>
                <Input
                  placeholder="Enter a short description"
                  value={newChanges.description}
                  onChange={(e, data) => {
                    setNewChanges({ ...newChanges, description: data.value });
                  }}
                />
              </Form.Field>
              <Form.Field>
                <Divider section />
                <Header size="small">Custom CSS</Header>
                <label>Some of the main classes on the page:</label>
                <Label.Group>
                  <Label>.main-container</Label>
                  <Label>.title-container</Label>
                  <Label>.dashboard-title</Label>
                  <Label>.dashboard-sub-title</Label>
                  <Label>.chart-grid</Label>
                  <Label>.chart-container</Label>
                  <Label>.chart-card</Label>
                </Label.Group>
                <AceEditor
                  mode="css"
                  theme="tomorrow"
                  height="200px"
                  width="none"
                  value={newChanges.headerCode}
                  onChange={(value) => {
                    setNewChanges({ ...newChanges, headerCode: value });
                  }}
                  name="queryEditor"
                  editorProps={{ $blockScrolling: true }}
                />

                {!helpActive && (
                  <Button
                    className="tertiary"
                    content="See an example"
                    onClick={() => setHelpActive(true)}
                  />
                )}

                {helpActive && (
                  <Message onDismiss={() => setHelpActive(false)}>
                    <p>
                      {"You might have to use "}
                      <Label>{"!important"}</Label>
                      {" for your styles to override existing ones"}
                    </p>
                    <p>
                      <pre>
                        {`.dashboard-title {
  font-size: 4em !important;
}`}
                      </pre>
                    </p>
                  </Message>
                )}
              </Form.Field>
            </Form>
          </Modal.Content>
          <Modal.Actions>
            <Button
              primary
              content="Preview changes"
              onClick={() => setEditingTitle(false)}
            />
          </Modal.Actions>
        </Modal>
      </TransitionablePortal>

      <TransitionablePortal open={showSettings}>
        <Modal open={showSettings} onClose={() => setShowSettings(false)}>
          <Modal.Header>Dashboard settings</Modal.Header>
          <Modal.Content>
            <Form>
              <Form.Field>
                <label>Your dashboard URL</label>
                <Input
                  placeholder="Enter your custom dashboard URL"
                  label={`${SITE_HOST}/b/`}
                  value={newBrewName}
                  onChange={_onChangeBrewName}
                />
                {error && (<Label pointing color="red">{error}</Label>)}
              </Form.Field>
              <Form.Field>
                <Button
                  positive
                  icon="checkmark"
                  content="Save and reload"
                  onClick={_onSaveBrewName}
                  disabled={!newBrewName}
                  loading={saveLoading}
                />
              </Form.Field>
              <Form.Field>
                <Divider section />
                <Checkbox
                  label={project.Team && project.Team.showBranding ? "Chartbrew branding is visible" : "Chartbrew branding is disabled"}
                  toggle
                  checked={project.Team && project.Team.showBranding}
                  onChange={_onToggleBranding}
                />
              </Form.Field>
            </Form>
          </Modal.Content>
          <Modal.Actions>
            <Button
              primary
              content="Close"
              onClick={() => setShowSettings(false)}
            />
          </Modal.Actions>
        </Modal>
      </TransitionablePortal>

      <ToastContainer
        position="top-right"
        autoClose={1500}
        hideProgressBar={false}
        newestOnTop={false}
        closeOnClick
        rtl={false}
        pauseOnVisibilityChange
        draggable
        pauseOnHover
        transition={Flip}
      />
    </div>
  );
}

const styles = {
  container: {
    flex: 1,
    flexGrow: 1,
    backgroundColor: blue,
    height: window.innerHeight,
    paddingBottom: 100,
  },
  mainContent: {
    marginTop: 0,
  },
  dashboardTitle: (color) => ({
    color: color || "black",
  }),
  logoContainer: {
    position: "absolute",
    top: 30,
    left: 20,
  },
  logoContainerMobile: {
    // padding: 20,
    cursor: "pointer",
  },
};

PublicDashboard.propTypes = {
  getPublicDashboard: PropTypes.func.isRequired,
  getProject: PropTypes.func.isRequired,
  updateProject: PropTypes.func.isRequired,
  updateProjectLogo: PropTypes.func.isRequired,
  updateTeam: PropTypes.func.isRequired,
  match: PropTypes.object.isRequired,
  charts: PropTypes.array.isRequired,
  user: PropTypes.object.isRequired,
  teams: PropTypes.array.isRequired,
};

const mapStateToProps = (state) => ({
  charts: state.chart.data,
  user: state.user.data,
  teams: state.team.data,
});

const mapDispatchToProps = (dispatch) => ({
  getPublicDashboard: (brewName) => dispatch(getPublicDashboardAction(brewName)),
  getProject: (projectId) => dispatch(getProjectAction(projectId)),
  updateProject: (projectId, data) => dispatch(updateProjectAction(projectId, data)),
  updateProjectLogo: (projectId, logo) => dispatch(updateProjectLogoAction(projectId, logo)),
  updateTeam: (teamId, data) => dispatch(updateTeamAction(teamId, data)),
});

export default connect(mapStateToProps, mapDispatchToProps)(PublicDashboard);
