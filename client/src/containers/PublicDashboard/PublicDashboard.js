/* eslint-disable react/jsx-props-no-spreading */

import React, { useState, useEffect, useCallback } from "react";
import PropTypes from "prop-types";
import { Link } from "react-router-dom";
import {
  Button, Container, Dimmer, Divider, Form, Grid, Header, Icon, Input,
  Loader, Menu, Modal, Popup, TransitionablePortal,
} from "semantic-ui-react";
import { connect } from "react-redux";
import { SketchPicker } from "react-color";
import { createMedia } from "@artsy/fresnel";
import { Helmet } from "react-helmet";
import { clone } from "lodash";
import { useDropzone } from "react-dropzone";
import { ToastContainer, toast, Flip } from "react-toastify";
import "react-toastify/dist/ReactToastify.min.css";

import {
  getPublicDashboard as getPublicDashboardAction,
  getProject as getProjectAction,
  updateProject as updateProjectAction,
  updateProjectLogo as updateProjectLogoAction,
} from "../../actions/project";
import { blue } from "../../config/colors";
import Chart from "../Chart/Chart";
import logo from "../../assets/logo_inverted.png";
import { API_HOST } from "../../config/settings";

const AppMedia = createMedia({
  breakpoints: {
    mobile: 0,
    tablet: 768,
    computer: 1024,
  },
});
const { Media } = AppMedia;

function PublicDashboard(props) {
  const {
    getPublicDashboard, match, getProject, updateProject, updateProjectLogo, charts,
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
      });
    }
  }, [project]);

  useEffect(() => {
    if (project.id
      && (newChanges.backgroundColor !== project.backgroundColor
      || newChanges.titleColor !== project.titleColor
      || newChanges.dashboardTitle !== project.dashboardTitle
      || newChanges.description !== project.description)
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
      .catch(() => {
        toast.error("Could not get the the dashboard data. Please try refreshing the page.");
      });
  };

  const _isPublic = () => {
    return charts.filter((c) => c.public).length > 0;
  };

  const _onChangeTitleColor = () => {
    if (newChanges.titleColor === "black") {
      setNewChanges({ ...newChanges, titleColor: "white" });
    } else {
      setNewChanges({ ...newChanges, titleColor: "black" });
    }
  };

  const _onSaveChanges = () => {
    setSaveLoading(true);
    const updateData = clone(newChanges);
    if (updateData.logo) delete updateData.logo;

    updateProject(project.id, updateData)
      .then(async () => {
        if (typeof newChanges.logo === "object") {
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

  return (
    <div>
      <Helmet>
        <style>
          {`
            body {
              background-color: ${newChanges.backgroundColor};
            }
            
            .dashboard-logo-container {
              position: absolute;
              top: 30px;
              left: 20px;
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
            <Popup
              trigger={(
                <Menu.Item icon>
                  <Icon name="image" />
                </Menu.Item>
              )}
              on="click"
              position="bottom right"
            >
              <>
                <Header size="small">Change background</Header>
                <SketchPicker
                  color={newChanges.backgroundColor}
                  onChangeComplete={(color) => {
                    const rgba = `rgba(${color.rgb.r}, ${color.rgb.g}, ${color.rgb.b}, ${color.rgb.a})`;
                    setNewChanges({ ...newChanges, backgroundColor: rgba });
                  }}
                />
              </>
            </Popup>
            <Menu.Item icon onClick={() => setEditingTitle(true)}>
              <Popup
                trigger={(
                  <Icon name="pencil" />
                )}
                content="Edit the dashboard title and description"
              />
            </Menu.Item>
            <Menu.Item icon onClick={_onChangeTitleColor}>
              <Popup
                trigger={(
                  <Icon name="adjust" />
                )}
                content="Toggle white/black title"
              />
            </Menu.Item>
          </Menu.Menu>
        </Menu>
      )}

      {charts && charts.length > 0 && _isPublic()
        && (
          <div style={{ padding: 20, position: "relative" }}>
            <Dimmer active={loading}>
              <Loader active={loading}>
                Preparing the dashboard...
              </Loader>
            </Dimmer>
            <Container text>
              {editorVisible && (
                <Popup
                  trigger={(
                    <div className="dashboard-logo-container" {...getRootProps()}>
                      <input {...getInputProps()} />
                      <img
                        className="dashboard-logo"
                        src={logoPreview || newChanges.logo}
                        height="50"
                        alt={`${project.name} Logo`}
                        style={{ cursor: "pointer" }}
                        />
                    </div>
                  )}
                  content="Click here to add your own logo"
                  position="bottom left"
                />
              )}

              {!editorVisible && (
                <div className="dashboard-logo-container">
                  <img
                    className="dashboard-logo"
                    src={project.logo ? `${API_HOST}/${project.logo}` : logo}
                    height="50"
                    alt={`${project.name} Logo`}
                  />
                </div>
              )}

              <Header
                textAlign="center"
                size="huge"
                style={styles.dashboardTitle(newChanges.titleColor || project.titleColor)}
              >
                {newChanges.dashboardTitle || project.dashboardTitle || project.name}
                {!editorVisible && project.description && (
                  <Header.Subheader style={styles.dashboardTitle(project.titleColor)}>
                    {project.description}
                  </Header.Subheader>
                )}
                {editorVisible && newChanges.description && (
                <Header.Subheader style={styles.dashboardTitle(newChanges.titleColor)}>
                  {newChanges.description}
                </Header.Subheader>
                )}
              </Header>
            </Container>
            <Divider hidden />

            <Grid stackable centered style={styles.mainGrid}>
              {charts.map((chart) => {
                if (chart.draft) return (<span style={{ display: "none" }} key={chart.id} />);
                if (!chart.public) return (<span style={{ display: "none" }} key={chart.id} />);

                return (
                  <Grid.Column width={chart.chartSize * 4} key={chart.id} style={styles.chartGrid}>
                    <Chart
                      isPublic
                      chart={chart}
                      charts={charts}
                    />
                  </Grid.Column>
                );
              })}
              {project.Team && project.Team.showBranding && (
                <Grid.Column textAlign="center" style={{ color: newChanges.titleColor }} width={16}>
                  {"Powered by "}
                  <a href="https://chartbrew.com" target="_blank" rel="noopener noreferrer">Chartbrew</a>
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
};

PublicDashboard.propTypes = {
  getPublicDashboard: PropTypes.func.isRequired,
  getProject: PropTypes.func.isRequired,
  updateProject: PropTypes.func.isRequired,
  updateProjectLogo: PropTypes.func.isRequired,
  match: PropTypes.object.isRequired,
  charts: PropTypes.array.isRequired,
};

const mapStateToProps = (state) => ({
  charts: state.chart.data,
});

const mapDispatchToProps = (dispatch) => ({
  getPublicDashboard: (brewName) => dispatch(getPublicDashboardAction(brewName)),
  getProject: (projectId) => dispatch(getProjectAction(projectId)),
  updateProject: (projectId, data) => dispatch(updateProjectAction(projectId, data)),
  updateProjectLogo: (projectId, logo) => dispatch(updateProjectLogoAction(projectId, logo)),
});

export default connect(mapStateToProps, mapDispatchToProps)(PublicDashboard);
