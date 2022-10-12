/* eslint-disable react/jsx-props-no-spreading */

import React, { useState, useEffect, useCallback } from "react";
import PropTypes from "prop-types";
import { Link as LinkDom } from "react-router-dom";
import {
  Button, Container, Grid, Input, Loading, Row, Spacer, Text,
  Navbar, Tooltip, Popover, Divider, Modal, Badge, Link, useTheme,
} from "@nextui-org/react";
import {
  ChevronLeftCircle, CloseSquare, Edit, EditSquare, Image2, People, Show, TickSquare
} from "react-iconly";
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
import "ace-builds/src-min-noconflict/theme-one_dark";

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
import SharingSettings from "./components/SharingSettings";

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
  const [error, setError] = useState("");
  const [noCharts, setNoCharts] = useState(false);
  const [preview, setPreview] = useState(false);
  const [passwordRequired, setPasswordRequired] = useState(false);
  const [notAuthorized, setNotAuthorized] = useState(false);
  const [reportPassword, setReportPassword] = useState("");

  const { isDark } = useTheme();

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
    _fetchProject(window.localStorage.getItem("reportPassword"));
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
        logoLink: project.logoLink,
      });
    }
  }, [project]);

  useEffect(() => {
    if (project.id
      && (newChanges.backgroundColor !== project.backgroundColor
      || newChanges.titleColor !== project.titleColor
      || newChanges.dashboardTitle !== project.dashboardTitle
      || newChanges.description !== project.description
      || newChanges.logoLink !== project.logoLink
      || ((newChanges.headerCode || project.headerCode !== null)
        && newChanges.headerCode !== project.headerCode))
    ) {
      setIsSaved(false);
    }
  }, [newChanges]);

  const _fetchProject = (password) => {
    if (password) window.localStorage.setItem("reportPassword", password);

    setLoading(true);
    getPublicDashboard(match.params.brewName, password)
      .then((data) => {
        setProject(data);
        setLoading(false);
        setNotAuthorized(false);
        setPasswordRequired(false);

        // now get the project (mainly to check if the user can edit)
        getProject(data.id)
          .then((authenticatedProject) => {
            if (authenticatedProject.password) {
              setProject({ ...data, password: authenticatedProject.password });
            }
            setEditorVisible(true);
          })
          .catch(() => {});
      })
      .catch((err) => {
        setLoading(false);
        if (err === 403) {
          if (passwordRequired) {
            toast.error("The password you entered is incorrect.");
          }
          setPasswordRequired(true);
        }
        if (err === 401) {
          setNotAuthorized(true);
          window.location.pathname = "/login";
        }
        if (err === 404) {
          setNoCharts(true);
          toast.error("No charts found for this report.");
        }
      });
  };

  const _isOnReport = () => {
    return charts.filter((c) => c.onReport).length > 0;
  };

  const _onSaveBrewName = (newBrewName) => {
    if (!newBrewName) return;

    if (newBrewName.indexOf("/") > -1) {
      setError("The route contains invalid characters. Try removing the '/'");
      return;
    }

    setSaveLoading(true);
    const processedName = encodeURI(newBrewName);
    updateProject(project.id, { brewName: processedName })
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
        toast.success("The report has been updated!");
      })
      .catch(() => {
        toast.error("Oh no! We couldn't update the dashboard. Please try again");
      });
  };

  const _onTogglePublic = () => {
    updateProject(project.id, { public: !project.public })
      .then(() => {
        _fetchProject();
        toast.success("The report has been updated!");
      })
      .catch(() => { });
  };

  const _onTogglePassword = () => {
    updateProject(project.id, { passwordProtected: !project.passwordProtected })
      .then(() => {
        _fetchProject();
        toast.success("The report has been updated!");
      })
      .catch(() => { });
  };

  const _onSavePassword = (value) => {
    updateProject(project.id, { password: value })
      .then(() => {
        _fetchProject();
        toast.success("The report has been updated!");
      })
      .catch(() => { });
  };

  const _onToggleBranding = () => {
    updateTeam(project.team_id, { showBranding: !project.Team.showBranding })
      .then(() => {
        _fetchProject();
        toast.success("The branding settings are saved!");
      })
      .catch(() => {});
  };

  const _canAccess = (role) => {
    const team = teams.filter((t) => t.id === project.team_id)[0];
    if (!team) return false;
    return canAccess(role, user.id, team.TeamRoles);
  };

  if (loading && !project.id && !noCharts) {
    return (
      <Container style={styles.container}>
        <Spacer y={4} />
        <Row align="center" justify="center">
          <Loading type="points" color="currentColor" size="xl" />
        </Row>
        <Spacer y={1} />
        <Row align="center" justify="center">
          <Text size="1.4em" css={{ color: "$accents7" }}>Loading the dashboard...</Text>
        </Row>
      </Container>
    );
  }

  if (notAuthorized || passwordRequired) {
    return (
      <div>
        <Helmet>
          {(newChanges.headerCode || project.headerCode) && (
            <style type="text/css">{newChanges.headerCode || project.headerCode}</style>
          )}
          <style type="text/css">
            {`
            // body {
            //   background-color: ${blue};
            // }
          `}
          </style>
        </Helmet>

        {passwordRequired && (
          <Container css={{ mt: 100, maxWidth: 500 }} justify="center">
            <Row justify="center">
              <Text h3>
                Please enter the password to access this report
              </Text>
            </Row>
            <Spacer y={1} />

            <Row>
              <Input
                placeholder="Enter the password here"
                value={reportPassword}
                type="password"
                onChange={(e, data) => setReportPassword(data.value)}
                size="lg"
                fullWidth
                bordered
              />
            </Row>
            <Spacer y={0.5} />
            <Row>
              <Button
                primary
                loading={loading}
                onClick={() => _fetchProject(reportPassword)}
                size="lg"
                shadow
                auto
              >
                Access
              </Button>
            </Row>
          </Container>
        )}

        <ToastContainer
          position="bottom-center"
          autoClose={1500}
          hideProgressBar={false}
          newestOnTop={false}
          closeOnClick
          rtl={false}
          pauseOnVisibilityChange
          draggable
          pauseOnHover
          transition={Flip}
          theme={isDark ? "dark" : "light"}
        />
      </div>
    );
  }

  if (noCharts && user.id) {
    return (
      <div>
        <Container justify="center" css={{ mt: 100 }}>
          <Row justify="center">
            <Text h3>
              {"This report does not contain any charts"}
            </Text>
          </Row>
          <Spacer y={0.3} />
          <Row justify="center">
            <Text b>
              {"Head back to your dashboard and add charts to the report from the individual chart settings menu."}
            </Text>
          </Row>
          <Spacer y={1} />
          <Row justify="center">
            <Button
              onClick={() => window.history.back()}
              auto
              size="lg"
            >
              Go back
            </Button>
          </Row>
        </Container>
      </div>
    );
  }

  if (noCharts && !user.id) {
    return (
      <div>
        <Container css={{ mt: 100 }}>
          <Row justify="center">
            <Text h3>{"This dashbord does not contain any public charts"}</Text>
          </Row>
          <Spacer y={2} />
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
      {editorVisible && !preview && (
        <Navbar shouldHideOnScroll isBordered variant="sticky" isCompact maxWidth={"xl"}>
          <Navbar.Content>
            <Tooltip content="Back to your dashboard" placement="rightStart">
              <Navbar.Link>
                <LinkDom to={`/${project.team_id}/${project.id}/dashboard`}>
                  <Button
                    icon={<ChevronLeftCircle />}
                    bordered
                    css={{ minWidth: "fit-content" }}
                  />
                </LinkDom>
              </Navbar.Link>
            </Tooltip>
            {!isSaved && (
              <Navbar.Item>
                <Button
                  color="secondary"
                  size="sm"
                  icon={<TickSquare />}
                  disabled={saveLoading}
                  onClick={_onSaveChanges}
                  auto
                >
                  Save
                </Button>
              </Navbar.Item>
            )}
          </Navbar.Content>
          <Navbar.Content>
            {_canAccess("editor") && (
              <Tooltip content="Preview as a visitor" placement="bottom">
                <Navbar.Link onClick={() => setPreview(true)}>
                  <Show />
                  <Text hideIn={"xs"} css={{ pl: 3 }}>Preview</Text>
                </Navbar.Link>
              </Tooltip>
            )}
            {_canAccess("editor") && (
              <Popover>
                <Popover.Trigger>
                  <Navbar.Link>
                    <Image2 />
                    <Text hideIn="xs" css={{ pl: 3 }}>Appearance</Text>
                  </Navbar.Link>
                </Popover.Trigger>
                <Popover.Content>
                  <Container css={{ pt: 20, pb: 20 }}>
                    <Row>
                      <Text b>Change background</Text>
                    </Row>
                    <Spacer y={0.3} />
                    <Row>
                      <div>
                        <TwitterPicker
                          color={newChanges.backgroundColor}
                          onChangeComplete={(color) => {
                            const rgba = `rgba(${color.rgb.r}, ${color.rgb.g}, ${color.rgb.b}, ${color.rgb.a})`;
                            setNewChanges({ ...newChanges, backgroundColor: rgba });
                          }}
                          colors={defaultColors}
                        />
                      </div>
                    </Row>

                    <Spacer y={0.5} />
                    <Divider />
                    <Spacer y={0.5} />

                    <Row>
                      <Text b>Change text color</Text>
                    </Row>
                    <Spacer y={0.3} />
                    <Row>
                      <TwitterPicker
                        color={newChanges.titleColor}
                        onChangeComplete={(color) => {
                          const rgba = `rgba(${color.rgb.r}, ${color.rgb.g}, ${color.rgb.b}, ${color.rgb.a})`;
                          setNewChanges({ ...newChanges, titleColor: rgba });
                        }}
                        colors={defaultColors}
                      />
                    </Row>
                  </Container>
                </Popover.Content>
              </Popover>
            )}
            {_canAccess("editor") && (
              <Tooltip content="Edit the dashboard information and style" placement="bottom">
                <Navbar.Link onClick={() => setEditingTitle(true)}>
                  <Edit />
                  <Text hideIn={"xs"} css={{ pl: 3 }}>Report settings</Text>
                </Navbar.Link>
              </Tooltip>
            )}
            {_canAccess("admin") && (
              <Tooltip content="Sharing settings" placement="bottom">
                <Navbar.Link onClick={() => setShowSettings(true)}>
                  <People />
                  <Text hideIn={"xs"} css={{ pl: 3 }}>Sharing</Text>
                </Navbar.Link>
              </Tooltip>
            )}
          </Navbar.Content>
        </Navbar>
      )}

      {preview && (
        <Button
          onClick={() => setPreview(false)}
          icon={<CloseSquare />}
          style={styles.previewBtn}
          css={{ minWidth: "fit-content" }}
        />
      )}

      {charts && charts.length > 0 && _isOnReport() && (
        <div className="main-container" style={styles.mainContainer(width < breakpoints.tablet)}>
          {loading && (
            <Container style={styles.container}>
              <Spacer y={4} />
              <Row align="center" justify="center">
                <Loading type="points" color="currentColor" size="xl" />
              </Row>
              <Spacer y={1} />
              <Row align="center" justify="center">
                <Text size="1.4em" css={{ color: "$accents7" }}>Loading the dashboard...</Text>
              </Row>
            </Container>
          )}
          <Media greaterThan="mobile">
            <Spacer y={2} />
          </Media>
          <Container className="title-container" css={{ pl: 0, pr: 0 }} fluid>
            {editorVisible && !preview && (
              <>
                <Row justify="flex-start">
                  <Media greaterThan="mobile">
                    <div className="dashboard-logo-container">
                      <img
                        className="dashboard-logo"
                        src={logoPreview || newChanges.logo || logo}
                        height="70"
                        alt={`${project.name} Logo`}
                        style={styles.logoContainer}
                      />
                      <Badge color="primary" css={{ cursor: "pointer", mt: -10, ml: -10 }} {...getRootProps()}>
                        <EditSquare size="small" />
                        <input {...getInputProps()} />
                      </Badge>
                    </div>
                  </Media>
                </Row>
                <Row justify="center">
                  <Media at="mobile">
                    <div style={{ textAlign: "center" }}>
                      <img
                        className="dashboard-logo"
                        src={logoPreview || newChanges.logo || logo}
                        height="70"
                        alt={`${project.name} Logo`}
                        style={styles.logoContainerMobile}
                      />
                    </div>
                  </Media>
                </Row>
              </>
            )}

            {(!editorVisible || preview) && (
              <Row justify="center">
                <Media at="mobile">
                  <Spacer y={2} />
                </Media>
              </Row>
            )}

            {(!editorVisible || preview) && (
              <>
                <Row className="dashboard-logo-container" justify="flex-start">
                  <Media greaterThan="mobile">
                    <a
                      href={newChanges.logoLink || project.logoLink || "#"}
                      target="_blank"
                      rel="noreferrer"
                      style={{ ...styles.logoContainer, zIndex: 10 }}
                    >
                      <img
                        className="dashboard-logo"
                        src={project.logo ? `${API_HOST}/${project.logo}` : logo}
                        height="70"
                        alt={`${project.name} Logo`}
                      />
                    </a>
                  </Media>
                </Row>
                <Row justify="center" className="dashboard-logo-container">
                  <Media at="mobile">
                    <div style={{ textAlign: "center" }}>
                      <a
                        href={newChanges.logoLink || project.logoLink || "#"}
                        target="_blank"
                        rel="noreferrer"
                      >
                        <img
                          className="dashboard-logo"
                          src={project.logo ? `${API_HOST}/${project.logo}` : logo}
                          height="70"
                          alt={`${project.name} Logo`}
                          style={styles.logoContainerMobile}
                        />
                      </a>
                    </div>
                  </Media>
                </Row>
              </>
            )}

            <Row justify="center" align="center">
              <Text
                b
                size="2.4em"
                style={styles.dashboardTitle(newChanges.titleColor || project.titleColor)}
                className="dashboard-title"
              >
                {newChanges.dashboardTitle || project.dashboardTitle || project.name}
              </Text>
            </Row>
            <Spacer y={0.2} />
            {!editorVisible && project.description && (
              <Row justify="center" align="center">
                <Text
                  size="1.5em"
                  style={styles.dashboardTitle(project.titleColor)}
                  className="dashboard-sub-title"
                >
                  {project.description}
                </Text>
              </Row>
            )}
            {editorVisible && newChanges.description && (
              <Row justify="center" align="center">
                <Text
                  size="1.2em"
                  style={styles.dashboardTitle(newChanges.titleColor)}
                  className="dashboard-sub-title"
                >
                  {newChanges.description}
                </Text>
              </Row>
            )}
          </Container>
          <Spacer y={2} />

          <Grid.Container gap={1.5} className="main-chart-grid">
            {charts.map((chart) => {
              if (chart.draft) return (<span style={{ display: "none" }} key={chart.id} />);
              if (!chart.onReport) return (<span style={{ display: "none" }} key={chart.id} />);

              return (
                <Grid
                  xs={12}
                  sm={chart.chartSize * 4 > 12 ? 12 : chart.chartSize * 4}
                  md={chart.chartSize * 3 > 12 ? 12 : chart.chartSize * 3}
                  key={chart.id}
                  className="chart-container"
                  css={{ minHeight: 400, overflowY: "hidden" }}
                >
                  <Chart
                    isPublic
                    chart={chart}
                    charts={charts}
                    className="chart-card"
                  />
                </Grid>
              );
            })}
            {project.Team && project.Team.showBranding && (
              <Grid xs={12} className="footer-content" justify="center" css={{ mt: 20 }}>
                <Link
                  css={{ color: newChanges.titleColor, ai: "flex-start" }}
                  href={"https://chartbrew.com?ref=chartbrew_os_report"}
                  target="_blank"
                  rel="noopener noreferrer"
                >
                  <Text css={{ color: newChanges.titleColor }}>
                    Powered by
                  </Text>
                  <Spacer x={0.2} />
                  <Text css={{ color: newChanges.titleColor }}>
                    <strong>Chart</strong>
                  </Text>
                  <Text css={{ color: newChanges.titleColor }}>
                    brew
                  </Text>
                </Link>
              </Grid>
            )}
          </Grid.Container>
        </div>
      )}

      <Modal open={editingTitle} onClose={() => setEditingTitle(false)} width={600}>
        <Modal.Header><Text h4>Edit the title and description</Text></Modal.Header>
        <Modal.Body>
          <Container>
            <Row>
              <Input
                label="Dashboard title"
                placeholder="Enter your dashboard title"
                value={newChanges.dashboardTitle}
                onChange={(e) => {
                  setNewChanges({ ...newChanges, dashboardTitle: e.target.value });
                }}
                bordered
                fullWidth
              />
            </Row>
            <Spacer y={0.5} />
            <Row>
              <Input
                label="Dashboard description"
                placeholder="Enter a short description"
                value={newChanges.description}
                onChange={(e) => {
                  setNewChanges({ ...newChanges, description: e.target.value });
                }}
                bordered
                fullWidth
              />
            </Row>
            <Spacer y={0.5} />
            <Row>
              <Input
                label="Company website URL"
                placeholder="https://example.com"
                value={newChanges.logoLink}
                onChange={(e) => {
                  setNewChanges({ ...newChanges, logoLink: e.target.value });
                }}
                bordered
                fullWidth
              />
            </Row>
            <Spacer y={0.5} />
            <Divider />
            <Spacer y={0.5} />
            <Row>
              <Text b>Custom CSS</Text>
            </Row>
            <Spacer y={0.5} />
            <Row>
              <Text size={14}>Some of the main classes on the page:</Text>
            </Row>
            <Spacer y={0.2} />
            <Row wrap="wrap">
              <Badge>.main-container</Badge>
              <Badge>.title-container</Badge>
              <Badge>.dashboard-title</Badge>
              <Badge>.dashboard-sub-title</Badge>
              <Badge>.chart-grid</Badge>
              <Badge>.chart-container</Badge>
              <Badge>.chart-card</Badge>
            </Row>
            <Spacer y={0.5} />
            <Row>
              <div style={{ width: "100%" }}>
                <AceEditor
                  mode="css"
                  theme={isDark ? "one_dark" : "tomorrow"}
                  height="200px"
                  width="none"
                  value={newChanges.headerCode}
                  style={{ borderRadius: 10 }}
                  onChange={(value) => {
                    setNewChanges({ ...newChanges, headerCode: value });
                  }}
                  name="queryEditor"
                  editorProps={{ $blockScrolling: true }}
                />
              </div>
            </Row>
          </Container>
        </Modal.Body>
        <Modal.Footer>
          <Button
            primary
            onClick={() => setEditingTitle(false)}
          >
            Preview changes
          </Button>
        </Modal.Footer>
      </Modal>

      <SharingSettings
        open={showSettings}
        onClose={() => setShowSettings(false)}
        project={project}
        error={error}
        onSaveBrewName={_onSaveBrewName}
        brewLoading={saveLoading}
        onToggleBranding={_onToggleBranding}
        onTogglePublic={_onTogglePublic}
        onTogglePassword={_onTogglePassword}
        onSavePassword={_onSavePassword}
      />

      <ToastContainer
        position="bottom-center"
        autoClose={1500}
        hideProgressBar={false}
        newestOnTop={false}
        closeOnClick
        rtl={false}
        pauseOnVisibilityChange
        draggable
        pauseOnHover
        transition={Flip}
        theme={isDark ? "dark" : "light"}
      />
    </div>
  );
}

const styles = {
  container: {
    flex: 1,
    flexGrow: 1,
    // backgroundColor: blue,
    height: window.innerHeight,
    paddingBottom: 100,
  },
  mainContent: {
    marginTop: 0,
  },
  dashboardTitle: (color) => ({
    color: color || "black",
    textAlign: "center",
  }),
  logoContainer: {
    position: "absolute",
    top: 0,
    left: 0,
    cursor: "pointer",
  },
  logoContainerMobile: {
    // padding: 20,
    cursor: "pointer",
  },
  previewBtn: {
    position: "absolute",
    top: 20,
    right: 20,
    zIndex: 10,
  },
  mainContainer: (mobile) => ({
    padding: mobile ? 0 : 20,
    paddingTop: 20,
    paddingBottom: 20,
    position: "relative",
  })
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
  getPublicDashboard: (brewName, password) => (
    dispatch(getPublicDashboardAction(brewName, password))
  ),
  getProject: (projectId) => dispatch(getProjectAction(projectId)),
  updateProject: (projectId, data) => dispatch(updateProjectAction(projectId, data)),
  updateProjectLogo: (projectId, logo) => dispatch(updateProjectLogoAction(projectId, logo)),
  updateTeam: (teamId, data) => dispatch(updateTeamAction(teamId, data)),
});

export default connect(mapStateToProps, mapDispatchToProps)(PublicDashboard);
