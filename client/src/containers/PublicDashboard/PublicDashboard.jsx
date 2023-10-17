import React, { useState, useEffect, useCallback } from "react";
import PropTypes from "prop-types";
import { Link as LinkDom, useParams } from "react-router-dom";
import {
  Button, Input, Spacer, Navbar, Tooltip, Popover, Divider, Modal, Badge,
  Link, Image, CircularProgress, NavbarContent, PopoverTrigger, PopoverContent, ModalContent, ModalHeader, ModalBody, ModalFooter, Chip, NavbarItem,
} from "@nextui-org/react";
import { connect, useDispatch, useSelector } from "react-redux";
import { TwitterPicker } from "react-color";
import { createMedia } from "@artsy/fresnel";
import { Helmet } from "react-helmet";
import { clone } from "lodash";
import { useDropzone } from "react-dropzone";
import { ToastContainer, toast, Flip } from "react-toastify";
import "react-toastify/dist/ReactToastify.min.css";
import {
  LuCheck, LuChevronLeft, LuClipboardEdit, LuEye, LuPalette, LuPencilLine,
  LuRefreshCw, LuShare, LuXCircle,
} from "react-icons/lu";

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
import { selectTeams, updateTeam } from "../../slices/team";
import { runQueryOnPublic as runQueryOnPublicAction } from "../../actions/chart";
import { blue, primary, secondary } from "../../config/colors";
import Chart from "../Chart/Chart";
import logo from "../../assets/logo_inverted.png";
import { API_HOST, SITE_HOST } from "../../config/settings";
import canAccess from "../../config/canAccess";
import SharingSettings from "./components/SharingSettings";
import instructionDashboard from "../../assets/instruction-dashboard-report.png";
import Text from "../../components/Text";
import Row from "../../components/Row";
import Container from "../../components/Container";
import useThemeDetector from "../../modules/useThemeDetector";

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
    getPublicDashboard, getProject, updateProject, updateProjectLogo, charts,
    user, runQueryOnPublic,
  } = props;

  const [project, setProject] = useState({});
  const [loading, setLoading] = useState(true);
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
  const [refreshLoading, setRefreshLoading] = useState(false);

  const teams = useSelector(selectTeams);

  const isDark = useThemeDetector();
  const params = useParams();
  const dispatch = useDispatch();

  const onDrop = useCallback((acceptedFiles) => {
    setNewChanges({ ...newChanges, logo: acceptedFiles });
    setIsSaved(false);

    const reader = new FileReader();
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
    getPublicDashboard(params.brewName, password)
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
    dispatch(updateTeam({ team_id: project.team_id, data: { showBranding: !project.Team.showBranding } }))
      .then(() => {
        _fetchProject();
        toast.success("The branding settings are saved!");
      })
      .catch(() => {});
  };

  const _onRefreshCharts = () => {
    setRefreshLoading(true);
    const refreshPromises = [];
    for (let i = 0; i < charts.length; i++) {
      refreshPromises.push(
        runQueryOnPublic(project.id, charts[i].id)
      );
    }

    return Promise.all(refreshPromises)
      .then(() => {
        setRefreshLoading(false);
      })
      .catch(() => {
        setRefreshLoading(false);
      });
  };

  const _canAccess = (role) => {
    const team = teams.filter((t) => t.id === project.team_id)[0];
    if (!team) return false;
    return canAccess(role, user.id, team.TeamRoles);
  };

  if (loading && !project.id && !noCharts) {
    return (
      <>
        <Helmet>
          <style type="text/css">
            {`
            body, html {
              background-color: transparent;
            }

            #root {
              background-color: transparent;
            }
          `}
          </style>
        </Helmet>
        <div style={styles.container} className="items-center">
          <Spacer y={4} />
          <Row align="center" justify="center">
            <CircularProgress size="lg" aria-label="Loading" />
          </Row>
        </div>
      </>
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
              <Text size="h3">
                Please enter the password to access this report
              </Text>
            </Row>
            <Spacer y={1} />

            <Row>
              <Input
                placeholder="Enter the password here"
                value={reportPassword}
                type="password"
                onChange={(e) => setReportPassword(e.target.value)}
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
        <Container justify="center" className={"mt-20"}>
          <Row justify="center">
            <Text size="h1">
              {"This report does not contain any charts"}
            </Text>
          </Row>
          <Spacer y={1} />
          <Row justify="center">
            <Text b>
              {"Head back to your dashboard and add charts to the report from the individual chart settings menu."}
            </Text>
          </Row>
          <Spacer y={4} />
          <Row justify="center">
            <Button
              onClick={() => window.history.back()}
              color="primary"
              size="lg"
              startContent={<LuChevronLeft />}
            >
              Go back
            </Button>
          </Row>
          <Spacer y={1} />
          <Row justify="center">
            <Image
              src={instructionDashboard}
              height={500}
              width={1000}
              css={{ filter: "drop-shadow(1px 5px 5px rgba(0, 0, 0, 0.5))", p: 15 }}
            />
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
            <Text size="h3">{"This dashbord does not contain any public charts"}</Text>
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
            html, body {
              background-color: ${newChanges.backgroundColor} !important;
            }
          `}
        </style>
      </Helmet>
      {editorVisible && !preview && (
        <Navbar shouldHideOnScroll isBordered maxWidth={"full"}>
          <NavbarContent>
            <Tooltip content="Back to your dashboard" placement="rightStart">
              <NavbarItem>
                <LinkDom to={`/${project.team_id}/${project.id}/dashboard`}>
                  <Button
                    isIconOnly
                    variant="bordered"
                  >
                    <LuChevronLeft />
                  </Button>
                </LinkDom>
              </NavbarItem>
            </Tooltip>
            {!isSaved && (
              <NavbarItem>
                <Button
                  color="secondary"
                  size="sm"
                  endContent={<LuCheck />}
                  isLoading={saveLoading}
                  onClick={_onSaveChanges}
                >
                  Save
                </Button>
              </NavbarItem>
            )}
          </NavbarContent>
          <NavbarContent className="gap-8 sm:gap-8" justify="end">
            {_canAccess("projectAdmin") && (
              <NavbarItem>
                <Link className="text-foreground flex gap-1 items-center cursor-pointer" onClick={() => setPreview(true)}>
                  <LuEye />
                  <Text className={"hidden sm:block"}>Preview</Text>
                </Link>
              </NavbarItem>
            )}
            {_canAccess("projectAdmin") && (
              <Popover>
                <NavbarItem>
                  <PopoverTrigger>
                    <Link className="text-foreground flex gap-1 items-center">
                      <LuPalette />
                      <Text className={"hidden sm:block"}>Style</Text>
                    </Link>
                  </PopoverTrigger>
                </NavbarItem>
                <PopoverContent>
                  <div className="p-4">
                    <Row>
                      <Text b>Change background</Text>
                    </Row>
                    <Spacer y={1} />
                    <Row>
                      <div>
                        <TwitterPicker
                          color={newChanges.backgroundColor}
                          onChangeComplete={(color) => {
                            setNewChanges({ ...newChanges, backgroundColor: color.hex.toUpperCase() });
                          }}
                          colors={defaultColors}
                        />
                      </div>
                    </Row>

                    <Spacer y={2} />
                    <Divider />
                    <Spacer y={2} />

                    <Row>
                      <Text b>Change text color</Text>
                    </Row>
                    <Spacer y={1} />
                    <Row>
                      <TwitterPicker
                        color={newChanges.titleColor}
                        onChangeComplete={(color) => {
                          setNewChanges({ ...newChanges, titleColor: color.hex.toUpperCase() });
                        }}
                        colors={defaultColors}
                      />
                    </Row>
                  </div>
                </PopoverContent>
              </Popover>
            )}
            {_canAccess("projectAdmin") && (
              <NavbarItem>
                <Link className="text-foreground flex gap-1 items-center" onClick={() => setEditingTitle(true)}>
                    <LuClipboardEdit />
                    <Text className={"hidden sm:block"}>Report settings</Text>
                  </Link>
              </NavbarItem>
            )}
            {_canAccess("projectAdmin") && (
              <NavbarItem>
                <Link className="text-foreground flex gap-1 items-center" onClick={() => setShowSettings(true)}>
                  <LuShare />
                  <Text className={"hidden sm:block"}>Sharing</Text>
                </Link>
              </NavbarItem>
            )}
          </NavbarContent>
        </Navbar>
      )}

      {preview && (
        <Button
          onClick={() => setPreview(false)}
          isIconOnly
          style={styles.previewBtn}
          color="primary"
          variant="faded"
        >
          <LuXCircle />
        </Button>
      )}

      <Media greaterThan="mobile">
        {project?.Team?.allowReportRefresh && (
          <Button
            onClick={() => _onRefreshCharts()}
            endContent={<LuRefreshCw />}
            isLoading={refreshLoading}
            style={styles.refreshBtn(editorVisible)}
            size="sm"
            color="primary"
          >
            Refresh charts
          </Button>
        )}
      </Media>

      {charts && charts.length > 0 && _isOnReport() && (
        <div className="main-container relative p-2 pt-10 pb-10 md:pt-10 md:pb-10 md:pl-4 md:pr-4">
          {loading && (
            <Container style={styles.container}>
              <Spacer y={4} />
              <Row align="center" justify="center">
                <CircularProgress size="lg" aria-label="Loading" />
              </Row>
            </Container>
          )}
          <Media greaterThan="mobile">
            <Spacer y={8} />
          </Media>
          <div className="title-container">
            {editorVisible && !preview && (
              <>
                <Spacer y={2} />
                <Row justify="flex-start">
                  <Media greaterThan="mobile">
                    <div className="dashboard-logo-container">
                      <img
                        className="dashboard-logo max-w-[200px] max-h-[100px]"
                        src={logoPreview || newChanges.logo || logo}
                        alt={`${project.name} Logo`}
                        style={styles.logoContainer}
                      />
                      <Badge
                        color="primary"
                        className={"cursor-pointer mt-[-40px] ml-[-10px]"}
                        content={<LuPencilLine className="p-1" size={24} />}
                        variant="faded"
                        {...getRootProps()}
                      >
                        <input {...getInputProps()} />
                      </Badge>
                    </div>
                  </Media>
                </Row>
                <Row justify="center">
                  <Media at="mobile">
                    <div style={{ textAlign: "center" }}>
                      <img
                        className="dashboard-logo max-w-[200px] max-h-[100px]"
                        src={logoPreview || newChanges.logo || logo}
                        alt={`${project.name} Logo`}
                        style={styles.logoContainerMobile}
                      />
                    </div>
                    <Spacer y={8} />
                  </Media>
                </Row>
              </>
            )}

            {(!editorVisible || preview) && (
              <Row justify="center">
                <Media at="mobile">
                  <Spacer y={4} />
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
                        className="dashboard-logo max-w-[200px] max-h-[100px]"
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
                          className="dashboard-logo max-w-[200px] max-h-[100px]"
                          src={project.logo ? `${API_HOST}/${project.logo}` : logo}
                          height="70"
                          alt={`${project.name} Logo`}
                          style={styles.logoContainerMobile}
                        />
                      </a>
                    </div>
                    <Spacer y={8} />
                  </Media>
                </Row>
              </>
            )}

            <Row justify="center" align="center">
              <Text
                b
                className={`dashboard-title text-[2.4em] text-[${newChanges.titleColor || project.titleColor || "#000000"}]`}
              >
                {newChanges.dashboardTitle || project.dashboardTitle || project.name}
              </Text>
            </Row>
            <Spacer y={0.2} />
            {!editorVisible && project.description && (
              <Row justify="center" align="center">
                <Text
                  className={`dashboard-sub-title text-[1.5em] text-[${project.titleColor || "#000000"}}]`}
                >
                  {project.description}
                </Text>
              </Row>
            )}
            {editorVisible && newChanges.description && (
              <Row justify="center" align="center">
                <Text
                  className={`dashboard-sub-title text-[1.2em] text-[${newChanges.titleColor || "#000000"}}]`}
                >
                  {newChanges.description}
                </Text>
              </Row>
            )}
            {project.Team?.allowReportRefresh && (
              <>
                <Spacer y={2} />
                <Row justify="center">
                  <Media at="mobile">
                    <Button
                      onClick={() => _onRefreshCharts()}
                      endContent={<LuRefreshCw />}
                      disabled={refreshLoading}
                      size="sm"
                      color="primary"
                    >
                      Refresh charts
                    </Button>
                  </Media>
                </Row>
              </>
            )}
          </div>
          <Spacer y={10} />

          <div className="main-chart-grid grid grid-cols-12 gap-4">
            {charts.map((chart) => {
              if (chart.draft) return (<span style={{ display: "none" }} key={chart.id} />);
              if (!chart.onReport) return (<span style={{ display: "none" }} key={chart.id} />);

              return (
                <div
                  className={`min-h-[400px] overflow-y-hidden col-span-12 md:col-span-${chart.chartSize * 4 > 12 ? 12 : chart.chartSize * 4} lg:col-span-${chart.chartSize * 3 > 12 ? 12 : chart.chartSize * 3}`}
                  key={chart.id}
                >
                  <Chart
                    isPublic
                    chart={chart}
                    charts={charts}
                    className="chart-card"
                    showExport={project.Team?.allowReportExport}
                    password={project.password || window.localStorage.getItem("reportPassword")}
                  />
                </div>
              );
            })}
            {project.Team && project.Team.showBranding && (
              <div className="col-span-12 footer-content mt-10 flex justify-center">
                <Link
                  className={`flex items-start !text-[${newChanges.titleColor || "black"}]`}
                  href={"https://chartbrew.com?ref=chartbrew_os_report"}
                  target="_blank"
                  rel="noopener noreferrer"
                >
                  <Text className={`text-[${newChanges.titleColor}]`}>
                    Powered by
                  </Text>
                  <Spacer x={0.6} />
                  <Text className={`text-[${newChanges.titleColor}]`}>
                    <strong>Chart</strong>
                  </Text>
                  <Text className={`text-[${newChanges.titleColor}]`}>
                    brew
                  </Text>
                </Link>
              </div>
            )}
          </div>
        </div>
      )}

      <Modal isOpen={editingTitle} onClose={() => setEditingTitle(false)} size="2xl">
        <ModalContent>
          <ModalHeader>
            <Text size="h4">Edit the title and description</Text>
          </ModalHeader>
          <ModalBody>
            <Row>
              <Input
                label="Dashboard title"
                placeholder="Enter your dashboard title"
                value={newChanges.dashboardTitle}
                onChange={(e) => {
                  setNewChanges({ ...newChanges, dashboardTitle: e.target.value });
                }}
                variant="bordered"
                fullWidth
              />
            </Row>
            <Row>
              <Input
                label="Dashboard description"
                placeholder="Enter a short description"
                value={newChanges.description}
                onChange={(e) => {
                  setNewChanges({ ...newChanges, description: e.target.value });
                }}
                variant="bordered"
                fullWidth
              />
            </Row>
            <Row>
              <Input
                label="Company website URL"
                placeholder="https://example.com"
                value={newChanges.logoLink}
                onChange={(e) => {
                  setNewChanges({ ...newChanges, logoLink: e.target.value });
                }}
                variant="bordered"
                fullWidth
              />
            </Row>
            <Spacer y={1} />
            <Divider />
            <Spacer y={1} />
            <Row>
              <Text b>Custom CSS</Text>
            </Row>
            <Row>
              <Text size={"sm"}>Some of the main classes on the page:</Text>
            </Row>
            <Row wrap="wrap" className={"gap-1"}>
              <Chip>.main-container</Chip>
              <Chip>.title-container</Chip>
              <Chip>.dashboard-title</Chip>
              <Chip>.dashboard-sub-title</Chip>
              <Chip>.chart-grid</Chip>
              <Chip>.chart-container</Chip>
              <Chip>.chart-card</Chip>
            </Row>
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
                  className="rounded-md border-1 border-solid border-content3"
                />
              </div>
            </Row>
          </ModalBody>
          <ModalFooter>
            <Button
              color="primary"
              onClick={() => setEditingTitle(false)}
            >
              Preview changes
            </Button>
          </ModalFooter>
        </ModalContent>
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
  refreshBtn: (isMenuVisible) => ({
    position: "absolute",
    top: isMenuVisible ? 90 : 20,
    right: 20,
    zIndex: 10,
  }),
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
  charts: PropTypes.array.isRequired,
  user: PropTypes.object.isRequired,
  runQueryOnPublic: PropTypes.func.isRequired,
};

const mapStateToProps = (state) => ({
  charts: state.chart.data,
  user: state.user.data,
});

const mapDispatchToProps = (dispatch) => ({
  getPublicDashboard: (brewName, password) => (
    dispatch(getPublicDashboardAction(brewName, password))
  ),
  getProject: (projectId) => dispatch(getProjectAction(projectId)),
  updateProject: (projectId, data) => dispatch(updateProjectAction(projectId, data)),
  updateProjectLogo: (projectId, logo) => dispatch(updateProjectLogoAction(projectId, logo)),
  runQueryOnPublic: (projectId, chartId) => dispatch(runQueryOnPublicAction(projectId, chartId)),
});

export default connect(mapStateToProps, mapDispatchToProps)(PublicDashboard);
