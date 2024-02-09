import React, { useState, useEffect, useCallback, useRef } from "react";
import PropTypes from "prop-types";
import { Link as LinkDom, useParams } from "react-router-dom";
import {
  Button,
  Input,
  Spacer,
  Navbar,
  Tooltip,
  Popover,
  Divider,
  Modal,
  Link,
  Image,
  CircularProgress,
  NavbarContent,
  PopoverTrigger,
  PopoverContent,
  ModalContent,
  ModalHeader,
  ModalBody,
  ModalFooter,
  Chip,
  NavbarItem,
  NavbarBrand,
} from "@nextui-org/react";
import { connect, useDispatch, useSelector } from "react-redux";
import { TwitterPicker } from "react-color";
import { Helmet } from "react-helmet";
import { clone } from "lodash";
import { useDropzone } from "react-dropzone";
import { ToastContainer, toast, Flip } from "react-toastify";
import "react-toastify/dist/ReactToastify.min.css";
import {
  LuArrowLeftSquare,
  LuCheckCircle,
  LuChevronLeft,
  LuClipboardEdit,
  LuEye,
  LuImagePlus,
  LuPalette,
  LuRefreshCw,
  LuShare,
  LuXCircle,
} from "react-icons/lu";
import { WidthProvider, Responsive } from "react-grid-layout";
import "react-grid-layout/css/styles.css";
import "react-resizable/css/styles.css";

import AceEditor from "react-ace";
import "ace-builds/src-min-noconflict/mode-css";
import "ace-builds/src-min-noconflict/theme-tomorrow";
import "ace-builds/src-min-noconflict/theme-one_dark";

import {
  getPublicDashboard,
  getProject,
  updateProject,
  updateProjectLogo,
} from "../../slices/project";
import { selectTeams, updateTeam } from "../../slices/team";
import { runQueryOnPublic, selectCharts } from "../../slices/chart";
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
import ReportSettings from "./components/ReportSettings";


const ResponsiveGridLayout = WidthProvider(Responsive, {
  measureBeforeMount: true,
});

const defaultColors = [
  "#FFFFFF",
  "#000000",
  "#D9E3F0",
  "#F47373",
  "#697689",
  "#37D67A",
  primary,
  secondary,
  blue,
  "#2CCCE4",
  "#555555",
  "#dce775",
  "#ff8a65",
  "#ba68c8",
];

function PublicDashboard(props) {
  const { user } = props;

  const [project, setProject] = useState({});
  const [loading, setLoading] = useState(true);
  const [editingTitle, setEditingTitle] = useState(false);
  const [editorVisible, setEditorVisible] = useState(false);
  const [isSaved, setIsSaved] = useState(true);
  const [saveLoading, setSaveLoading] = useState(false);
  const [newChanges, setNewChanges] = useState({
    backgroundColor: "#FFFFFF",
    titleColor: "#000000",
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
  const [layouts, setLayouts] = useState(null);
  const [logoAspectRatio, setLogoAspectRatio] = useState(1);

  const teams = useSelector(selectTeams);
  const charts = useSelector(selectCharts);

  const isDark = useThemeDetector();
  const params = useParams();
  const dispatch = useDispatch();
  const initLayoutRef = useRef(null);

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
    if (project?.id) {
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
    if (
      project.id &&
      (newChanges.backgroundColor !== project.backgroundColor ||
        newChanges.titleColor !== project.titleColor ||
        newChanges.dashboardTitle !== project.dashboardTitle ||
        newChanges.description !== project.description ||
        newChanges.logoLink !== project.logoLink ||
        ((newChanges.headerCode || project.headerCode !== null) &&
          newChanges.headerCode !== project.headerCode))
    ) {
      setIsSaved(false);
    }
  }, [newChanges]);

  useEffect(() => {
    if (charts && charts.length > 0 && !initLayoutRef.current) {
      initLayoutRef.current = true;
      // set the grid layout
      const newLayouts = { xxs: [], xs: [], sm: [], md: [], lg: [] };
      charts.forEach((chart) => {
        if (chart.layout) {
          Object.keys(chart.layout).forEach((key) => {
            newLayouts[key].push({
              i: chart.id.toString(),
              x: chart.layout[key][0] || 0,
              y: chart.layout[key][1] || 0,
              w: chart.layout[key][2],
              h: chart.layout[key][3],
              minW: 2,
            });
          });
        }
      });

      setLayouts(newLayouts);
    }
  }, [charts]);

  const _fetchProject = (password) => {
    if (password) window.localStorage.setItem("reportPassword", password);

    setLoading(true);
    dispatch(getPublicDashboard({ brewName: params.brewName, password })).then(
      (data) => {
        if (data.error) {
          if (data.error.message === "403") {
            if (passwordRequired) {
              toast.error("The password you entered is incorrect.");
            }
            setPasswordRequired(true);
          } else if (data.error.message === 401) {
            setNotAuthorized(true);
            window.location.pathname = "/login";
          } else {
            setNoCharts(true);
          }

          setLoading(false);
        } else {
          setProject(data.payload);
          setLoading(false);
          setNotAuthorized(false);
          setPasswordRequired(false);

          // now get the project (mainly to check if the user can edit)
          dispatch(getProject({ project_id: data.payload?.id }))
            .then((projectData) => {
              if (!projectData.payload) throw new Error(404);
              const authenticatedProject = projectData.payload;

              if (authenticatedProject.password) {
                setProject({
                  ...data.payload,
                  password: authenticatedProject.password,
                });
              }

              setEditorVisible(true);
            })
            .catch(() => {});
        }
      }
    );
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
    dispatch(
      updateProject({
        project_id: project.id,
        data: { brewName: processedName },
      })
    )
      .then((project) => {
        setSaveLoading(false);
        setIsSaved(true);
        window.location.href = `${SITE_HOST}/b/${project.payload.brewName}`;
      })
      .catch(() => {
        setSaveLoading(false);
        setError(
          "This dashboard URL is already taken. Please try another one."
        );
      });
  };

  const _onSaveChanges = () => {
    setSaveLoading(true);
    const updateData = clone(newChanges);
    if (updateData.logo) delete updateData.logo;

    dispatch(updateProject({ project_id: project.id, data: updateData }))
      .then(async () => {
        if (typeof newChanges.logo === "object" && newChanges.logo !== null) {
          await dispatch(
            updateProjectLogo({ project_id: project.id, logo: newChanges.logo })
          );
        }

        setSaveLoading(false);
        _fetchProject();
        setIsSaved(true);
        toast.success("The report has been updated!");
      })
      .catch(() => {
        toast.error(
          "Oh no! We couldn't update the dashboard. Please try again"
        );
      });
  };

  const _onTogglePublic = (value) => {
    dispatch(updateProject({ project_id: project.id, data: { public: value } }))
      .then(() => {
        _fetchProject();
        toast.success("The report has been updated!");
      })
      .catch(() => {});
  };

  const _onTogglePassword = (value) => {
    dispatch(
      updateProject({
        project_id: project.id,
        data: { passwordProtected: value },
      })
    )
      .then(() => {
        _fetchProject();
        toast.success("The report has been updated!");
      })
      .catch(() => {});
  };

  const _onSavePassword = (value) => {
    dispatch(
      updateProject({ project_id: project.id, data: { password: value } })
    )
      .then(() => {
        _fetchProject();
        toast.success("The report has been updated!");
      })
      .catch(() => {});
  };

  const _onToggleBranding = () => {
    dispatch(
      updateTeam({
        team_id: project.team_id,
        data: { showBranding: !project.Team.showBranding },
      })
    )
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
        dispatch(
          runQueryOnPublic({ project_id: project.id, chart_id: charts[i].id })
        )
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
    const canReallyAccess = canAccess(role, user.id, team.TeamRoles);
    return canReallyAccess;
  };

  const _onLoadLogo = ({ target: img }) => {
    const aspectRatio = img.naturalWidth / img.naturalHeight;
    setLogoAspectRatio(aspectRatio);
  };

  if (loading && !project?.id && !noCharts) {
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
          {(newChanges?.headerCode || project?.headerCode) && (
            <style type="text/css">
              {newChanges.headerCode || project.headerCode}
            </style>
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
          <div className="container mx-auto max-w-xl p-16">
            <Row justify="center">
              <Text size="h3">
                Please enter the password to access this report
              </Text>
            </Row>
            <Spacer y={2} />

            <Row>
              <Input
                placeholder="Enter the password here"
                value={reportPassword}
                type="password"
                onChange={(e) => setReportPassword(e.target.value)}
                size="lg"
                fullWidth
                variant="bordered"
              />
            </Row>
            <Spacer y={2} />
            <Row>
              <Button
                color="primary"
                loading={loading}
                onClick={() => _fetchProject(reportPassword)}
                size="lg"
              >
                Access report
              </Button>
            </Row>
          </div>
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
            <Text size="h1">{"This report does not contain any charts"}</Text>
          </Row>
          <Spacer y={1} />
          <Row justify="center">
            <Text b>
              {
                "Head back to your dashboard and add charts to the report from the individual chart settings menu."
              }
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
              css={{
                filter: "drop-shadow(1px 5px 5px rgba(0, 0, 0, 0.5))",
                p: 15,
              }}
            />
          </Row>
        </Container>
      </div>
    );
  }

  if (noCharts && !user.id) {
    return (
      <div>
        <div className="container mx-auto pt-16">
          <Row justify="center">
            <Text size="h3">
              {"This dashboard does not contain any public charts"}
            </Text>
          </Row>
          <Spacer y={2} />
        </div>
      </div>
    );
  }

  return (
    <div>
      <Helmet>
        {(newChanges?.headerCode || project?.headerCode) && (
          <style type="text/css">
            {newChanges.headerCode || project.headerCode}
          </style>
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
        <aside
          className="fixed top-0 left-0 z-40 w-96 h-screen"
          aria-label="Sidebar"
        >
          <div className="h-full flex flex-row px-3 py-2 bg-gray-50 dark:bg-gray-800">
            <div className="flex flex-col gap-4 p-2 w-16">
              <div>
                <Tooltip content="Back to your dashboard" placement="right-end">
                  <LinkDom to={`/${project.team_id}/${project.id}/dashboard`}>
                    <Link className="text-foreground cursor-pointer">
                      <LuArrowLeftSquare size={26} />
                    </Link>
                  </LinkDom>
                </Tooltip>
              </div>

              <Divider />

              <div>
                <Tooltip content="Preview dashboard" placement="right-end">
                  <Link
                    className="text-foreground cursor-pointer"
                    onClick={() => setPreview(true)}
                  >
                    <LuEye size={26} />
                  </Link>
                </Tooltip>
              </div>

              {project?.id && _canAccess("projectAdmin") && (
                <>
                  <div>
                    <Tooltip content="Change logo" placement="right-end">
                      <Link className="text-foreground cursor-pointer">
                        <div {...getRootProps()}>
                          <input {...getInputProps()} />
                          <LuImagePlus size={26} />
                        </div>
                      </Link>
                    </Tooltip>
                  </div>
                  <div>
                    <Popover placement="right-end">
                      <PopoverTrigger>
                        <Link className="text-foreground cursor-pointer">
                          <LuPalette size={26} />
                        </Link>
                      </PopoverTrigger>
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
                                  setNewChanges({
                                    ...newChanges,
                                    backgroundColor: color.hex.toUpperCase(),
                                  });
                                }}
                                colors={defaultColors}
                                triangle="hide"
                                styles={{
                                  default: { card: { boxShadow: "none" } },
                                }}
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
                                setNewChanges({
                                  ...newChanges,
                                  titleColor: color.hex.toUpperCase(),
                                });
                              }}
                              colors={defaultColors}
                              triangle="hide"
                              styles={{
                                default: { card: { boxShadow: "none" } },
                              }}
                            />
                          </Row>
                        </div>
                      </PopoverContent>
                    </Popover>
                  </div>

                  <div>
                    <Tooltip content="Report settings" placement="right-end">
                      <Link
                        className="text-foreground cursor-pointer"
                        onClick={() => setEditingTitle(true)}
                      >
                        <LuClipboardEdit size={26} />
                      </Link>
                    </Tooltip>
                  </div>

                  <div>
                    <Tooltip content="Sharing settings" placement="right-end">
                      <Link
                        className="text-foreground cursor-pointer"
                        onClick={() => setShowSettings(true)}
                      >
                        <LuShare size={26} />
                      </Link>
                    </Tooltip>
                  </div>
                </>
              )}
            </div>
            <div className="h-screen py-4 overflow-y-auto bg-white border-l border-r w-86 z-[50] rouned-xl">
              <ReportSettings />
            </div>
          </div>
        </aside>
      )}

      <Modal
        isOpen={editingTitle}
        onClose={() => setEditingTitle(false)}
        size="2xl"
      >
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
                  setNewChanges({
                    ...newChanges,
                    dashboardTitle: e.target.value,
                  });
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
            <Button color="primary" onClick={() => setEditingTitle(false)}>
              Preview changes
            </Button>
          </ModalFooter>
        </ModalContent>
      </Modal>

      <div className={editorVisible && !preview ? "ml-96" : ""}>
        <div className="">
          <Navbar
            isBordered
            maxWidth={"full"}
            isBlurred={false}
            className={"flex-grow-0 justify-between z-20"}
            style={{
              backgroundColor:
                newChanges.backgroundColor ||
                project.backgroundColor ||
                "#FFFFFF",
            }}
          >
            <NavbarBrand>
              <div className="flex items-center gap-4">
                {editorVisible && !preview && (
                  <div
                    className="dashboard-logo-container"
                    style={{ height: 45, width: 45 * logoAspectRatio }}
                  >
                    <img
                      onLoad={_onLoadLogo}
                      className="dashboard-logo"
                      src={logoPreview || newChanges.logo || logo}
                      alt={`${project.name} Logo`}
                      height={45}
                      width={45 * logoAspectRatio}
                    />
                  </div>
                )}

                {(!editorVisible || preview) && (
                  <div className="dashboard-logo-container">
                    <a
                      href={newChanges.logoLink || project.logoLink || "#"}
                      target="_blank"
                      rel="noreferrer"
                    >
                      <img
                        className="dashboard-logo"
                        src={
                          project.logo ? `${API_HOST}/${project.logo}` : logo
                        }
                        height={45}
                        width={45 * logoAspectRatio}
                        alt={`${project.name} Logo`}
                      />
                    </a>
                  </div>
                )}

                <div className="flex flex-col">
                  <span
                    className="text-lg font-bold"
                    style={{
                      color:
                        newChanges.titleColor ||
                        project.titleColor ||
                        "#000000",
                    }}
                  >
                    {newChanges.dashboardTitle ||
                      project.dashboardTitle ||
                      project.name}
                  </span>
                  {!editorVisible && project.description && (
                    <span
                      className="dashboard-sub-title"
                      style={{
                        color:
                          newChanges.titleColor ||
                          project.titleColor ||
                          "#000000",
                      }}
                    >
                      {project.description}
                    </span>
                  )}
                  {editorVisible && newChanges.description && (
                    <span
                      className="dashboard-sub-title"
                      style={{
                        color:
                          newChanges.titleColor ||
                          project.titleColor ||
                          "#000000",
                      }}
                    >
                      {newChanges.description}
                    </span>
                  )}
                </div>
              </div>
            </NavbarBrand>
            <NavbarContent justify="end">
              {!isSaved && !preview && (
                <div className="hidden sm:block">
                  <Button
                    color="success"
                    endContent={<LuCheckCircle />}
                    isLoading={saveLoading}
                    onClick={_onSaveChanges}
                  >
                    Save changes
                  </Button>
                </div>
              )}
              {preview && (
                <NavbarItem>
                  <Button
                    onClick={() => setPreview(false)}
                    endContent={<LuXCircle />}
                    color="primary"
                    variant="faded"
                  >
                    Exit preview
                  </Button>
                </NavbarItem>
              )}

              {project?.Team?.allowReportRefresh && (
                <NavbarItem className="hidden sm:block">
                  <Button
                    onClick={() => _onRefreshCharts()}
                    endContent={<LuRefreshCw />}
                    isLoading={refreshLoading}
                    size="sm"
                    color="primary"
                  >
                    Refresh charts
                  </Button>
                </NavbarItem>
              )}
            </NavbarContent>
          </Navbar>

          {charts && charts.length > 0 && _isOnReport() && (
            <div className="main-container relative p-2 pt-4 pb-10 md:pt-4 md:pb-10 md:pl-4 md:pr-4">
              {loading && (
                <Container style={styles.container}>
                  <Spacer y={4} />
                  <Row align="center" justify="center">
                    <CircularProgress size="lg" aria-label="Loading" />
                  </Row>
                </Container>
              )}

              {layouts && charts?.length > 0 && (
                <div className="w-full">
                  <ResponsiveGridLayout
                    className="layout"
                    layouts={layouts}
                    breakpoints={{
                      lg: 1200,
                      md: 996,
                      sm: 768,
                      xs: 480,
                      xxs: 0,
                    }}
                    cols={{ lg: 12, md: 10, sm: 8, xs: 6, xxs: 4 }}
                    onLayoutChange={() => {}}
                    rowHeight={150}
                    isDraggable={false}
                    isResizable={false}
                  >
                    {charts
                      .filter((c) => !c.draft && c.onReport)
                      .map((chart) => (
                        <div key={chart.id}>
                          <Chart
                            isPublic
                            chart={chart}
                            charts={charts}
                            className="chart-card"
                            showExport={project.Team?.allowReportExport}
                            password={
                              project.password ||
                              window.localStorage.getItem("reportPassword")
                            }
                          />
                        </div>
                      ))}
                  </ResponsiveGridLayout>
                </div>
              )}

              {project.Team && project.Team.showBranding && (
                <div className="footer-content mt-4 pr-4 flex justify-end">
                  <Link
                    className={`flex items-start !text-[${
                      newChanges.titleColor || "black"
                    }]`}
                    href={"https://chartbrew.com?ref=chartbrew_report"}
                    target="_blank"
                    rel="noopener noreferrer"
                  >
                    <span
                      className="text-sm"
                      style={{
                        color:
                          newChanges.titleColor ||
                          project.titleColor ||
                          "#000000",
                      }}
                    >
                      {"Powered by "}
                    </span>
                    <Spacer x={1} />
                    <span
                      className="text-sm"
                      style={{
                        color:
                          newChanges.titleColor ||
                          project.titleColor ||
                          "#000000",
                      }}
                    >
                      <strong>{"Chart"}</strong>
                    </span>
                    <span
                      className="text-sm"
                      style={{
                        color:
                          newChanges.titleColor ||
                          project.titleColor ||
                          "#000000",
                      }}
                    >
                      {"brew"}
                    </span>
                  </Link>
                </div>
              )}
            </div>
          )}
        </div>
      </div>

      {project && (
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
  }),
};

PublicDashboard.propTypes = {
  user: PropTypes.object.isRequired,
};

const mapStateToProps = (state) => ({
  user: state.user.data,
});

const mapDispatchToProps = () => ({});

export default connect(mapStateToProps, mapDispatchToProps)(PublicDashboard);
