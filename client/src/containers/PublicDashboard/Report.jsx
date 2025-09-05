import React, { useState, useEffect, useCallback, useRef } from "react";
import { Link as LinkDom, useParams, useSearchParams } from "react-router-dom";
import {
  Button, Input, Spacer, Navbar, Tooltip, Popover, Divider, Modal,
  Link, Image, CircularProgress, PopoverTrigger, PopoverContent, ModalContent, ModalHeader, ModalBody, ModalFooter, Chip, NavbarBrand,
  Spinner,
  Form,
} from "@heroui/react";
import { useDispatch, useSelector } from "react-redux";
import { TwitterPicker } from "react-color";
import { Helmet } from "react-helmet-async";
import { clone } from "lodash";
import { useDropzone } from "react-dropzone";
import toast from "react-hot-toast";
import {
  LuSquareArrowLeft,
  LuCircleCheck, LuChevronLeft, LuEye, LuImagePlus, LuPalette,
  LuRefreshCw, LuShare, LuCircleX,
  LuClipboardPen,
  LuListFilter,
} from "react-icons/lu";
import { WidthProvider, Responsive } from "react-grid-layout";
import "react-grid-layout/css/styles.css";
import "react-resizable/css/styles.css";

import AceEditor from "react-ace";
import "ace-builds/src-min-noconflict/mode-css";
import "ace-builds/src-min-noconflict/theme-tomorrow";
import "ace-builds/src-min-noconflict/theme-one_dark";

import {
  getReport, getProject, updateProject, updateProjectLogo,
} from "../../slices/project";
import { selectTeams } from "../../slices/team";
import { getProjectCharts, runQueryOnPublic, runQueryWithFilters, selectCharts, shouldSkipFiltering } from "../../slices/chart";
import { blue, primary, secondary } from "../../config/colors";
import Chart from "../Chart/Chart";
import logo from "../../assets/logo_inverted.png";
import { API_HOST } from "../../config/settings";
import canAccess from "../../config/canAccess";
import SharingSettings from "./components/SharingSettings";
import instructionDashboard from "../../assets/instruction-dashboard-report.png";
import Text from "../../components/Text";
import Row from "../../components/Row";
import Container from "../../components/Container";
import { useTheme } from "../../modules/ThemeContext";
import TextWidget from "../Chart/TextWidget";
import { cols, margin, widthSize } from "../../modules/layoutBreakpoints";
import { selectUser } from "../../slices/user";
import DashboardFilters from "../ProjectDashboard/components/DashboardFilters";
import useInterval from "../../modules/useInterval";

const ResponsiveGridLayout = WidthProvider(Responsive, { measureBeforeMount: true });

const defaultColors = [
  "#FFFFFF", "#000000", "#D9E3F0", "#F47373", "#697689", "#37D67A", primary, secondary, blue,
  "#2CCCE4", "#555555", "#dce775", "#ff8a65", "#ba68c8",
];

function Report() {
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
  const [noCharts, setNoCharts] = useState(false);
  const [preview, setPreview] = useState(false);
  const [passwordRequired, setPasswordRequired] = useState(false);
  const [notAuthorized, setNotAuthorized] = useState(false);
  const [reportPassword, setReportPassword] = useState("");
  const [refreshLoading, setRefreshLoading] = useState(false);
  const [layouts, setLayouts] = useState(null);
  const [logoAspectRatio, setLogoAspectRatio] = useState(1);
  const [dashboardFilters, setDashboardFilters] = useState([]);
  const [filterLoading, setFilterLoading] = useState(false);

  const teams = useSelector(selectTeams);
  const charts = useSelector(selectCharts);
  const user = useSelector(selectUser);

  const [searchParams] = useSearchParams();
  const { setTheme, isDark } = useTheme();
  const params = useParams();
  const dispatch = useDispatch();
  const initLayoutRef = useRef(null);

  const removeStyling = searchParams.get("removeStyling") === "true";
  const removeHeader = searchParams.get("removeHeader") === "true";

  // Get minimum auto-update frequency from all charts for dashboard-level refresh
  const getMinAutoUpdateFreq = () => {
    if (!charts || charts.length === 0) return 0;
    const autoUpdateTimes = charts
      .filter(chart => chart.autoUpdate > 0)
      .map(chart => chart.autoUpdate);
    
    if (autoUpdateTimes.length === 0) return 0;
    return Math.min(...autoUpdateTimes);
  };

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

  // Dashboard-level auto-refresh for public dashboards
  // This preserves URL variables and SharePolicy filtering
  useInterval(async () => {
    if (!refreshLoading && project?.id) {
      // Extract all query parameters to pass to the backend (preserving URL variables)
      const allQueryParams = {};
      searchParams.forEach((value, key) => {
        allQueryParams[key] = value;
      });

      setRefreshLoading(true);      
      
      try {
        const data = await dispatch(getReport({ 
          brewName: params.brewName, 
          password: window.localStorage.getItem("reportPassword"), 
          token: searchParams.get("token"),
          queryParams: allQueryParams
        }));

        // Update project data if successful (without changing editor visibility)
        if (data && !data.error && data.payload) {
          setProject(prevProject => ({ ...prevProject, ...data.payload }));
        }
      } catch (error) {
        console.error("Dashboard auto-refresh failed:", error);
      } finally {
        setRefreshLoading(false);
      }
    }
  }, getMinAutoUpdateFreq() > 0 ? getMinAutoUpdateFreq() * 1000 : 60000);

  useEffect(() => {
    setLoading(true);
    _fetchProject(window.localStorage.getItem("reportPassword"));

    if (searchParams.get("theme") === "light" || searchParams.get("theme") === "dark") {
      setTheme(searchParams.get("theme"));
    } else {
      setTheme("system");
    }
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

      _checkSearchParamsForFilters();
      _checkSearchParamsForFields();

      // get and format the dashboard filters
      if (project.DashboardFilters) {
        const formattedFilters = project.DashboardFilters.filter(f => f.onReport).map((f) => ({
          ...f?.configuration,
          id: f.id,
          onReport: f.onReport,
        }));

        setDashboardFilters({ [project.id]: formattedFilters });
        
        // Run filtering for dashboard filters (these are interactive filters, separate from URL variables)
        if (formattedFilters.length > 0) {
          _runFiltering({ [project.id]: formattedFilters });
        }
      }
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

  useEffect(() => {
    if (charts && charts.length > 0 && !initLayoutRef.current) {
      initLayoutRef.current = true;
      // set the grid layout
      const newLayouts = Object.keys(widthSize).reduce((acc, key) => {
        acc[key] = [];
        return acc;
      }, {});

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
    
    // Extract all query parameters to pass to the backend
    const allQueryParams = {};
    searchParams.forEach((value, key) => {
      allQueryParams[key] = value;
    });

    dispatch(getReport({ 
      brewName: params.brewName, 
      password, 
      token: searchParams.get("token"),
      queryParams: allQueryParams
    }))
      .then((data) => {
        if (data.error) {
          if (data.error.message === "403") {
            if (passwordRequired) {
              toast.error("The password you entered is incorrect.");
            }
            setPasswordRequired(true);
          } else if (data.error.message === "401") {
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
              if (!projectData.payload) throw new Error(projectData.error.status);

              setProject({ ...projectData.payload });
              setEditorVisible(true);
            })
            .catch(() => {});
          }
      });
  };

  const _checkSearchParamsForFilters = () => {
    // URL variables are now handled by the backend based on SharePolicy
    // This function is kept for potential future dashboard filter handling
    // but URL variables processing is no longer needed here
    return;
  };

  const _checkSearchParamsForFields = () => {
    // Field filters from URL are now handled by the backend based on SharePolicy
    // This function is kept for potential future dashboard filter handling
    // but URL field processing is no longer needed here
    return;
  };

  const _isOnReport = () => {
    return charts.filter((c) => c.onReport).length > 0;
  };

  const _onSaveChanges = () => {
    setSaveLoading(true);
    const updateData = clone(newChanges);
    if (updateData.logo) delete updateData.logo;

    dispatch(updateProject({ project_id: project.id, data: updateData }))
      .then(async () => {
        if (typeof newChanges.logo === "object" && newChanges.logo !== null) {
          await dispatch(updateProjectLogo({ project_id: project.id, logo: newChanges.logo }));
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

  const _onRefreshCharts = () => {
    setRefreshLoading(true);
    const refreshPromises = [];
    for (let i = 0; i < charts.length; i++) {
      refreshPromises.push(
        dispatch(runQueryOnPublic({ project_id: project.id, chart_id: charts[i].id }))
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



  const _runFiltering = (currentFilters = dashboardFilters, chartIds = null) => {
    if (!currentFilters?.[project.id] || charts.length === 0) return;

    setFilterLoading(true);
    _onFilterCharts(currentFilters, chartIds)
      .then(() => {
        setDashboardFilters(currentFilters);
        setFilterLoading(false);
      })
      .catch(() => {
        setFilterLoading(false);
      });
  };

  const _onFilterCharts = (currentFilters = dashboardFilters, chartIds = null) => {
    if (!currentFilters || !currentFilters[project.id]) {
      dispatch(getProjectCharts({ project_id: project.id }));
      setFilterLoading(false);
      return Promise.resolve("done");
    }

    const refreshPromises = [];
    const queries = [];

    // Prepare filter arrays for optimization check
    const currentFilterArray = currentFilters[project.id] || [];

    // Filter charts based on chartIds if provided
    const chartsToProcess = chartIds 
      ? charts.filter(chart => chartIds.includes(chart.id))
      : charts;

    // Only process charts that actually need filtering
    const chartsNeedingFiltering = chartsToProcess.filter(chart => 
      !shouldSkipFiltering(chart, currentFilterArray, {})
    );

    if (chartsNeedingFiltering.length === 0) {
      // All charts already have the correct filter state, no API calls needed
      setFilterLoading(false);
      return Promise.resolve("done");
    }
    
    chartsNeedingFiltering.forEach((chart) => {
      if (currentFilters && currentFilters[project.id]) {
        setFilterLoading(true);
        
        // Get all conditions from the chart's datasets
        let identifiedConditions = [];
        chart.ChartDatasetConfigs.forEach((cdc) => {
          if (Array.isArray(cdc.Dataset?.conditions)) {
            identifiedConditions = [...identifiedConditions, ...cdc.Dataset.conditions];
          }
        });

        // Separate filters by type
        const variableFilters = currentFilters[project.id].filter(f => f.type === "variable" && f.value);
        const dateFilters = currentFilters[project.id].filter(f => f.type === "date" && f.startDate && f.endDate);
        const otherFilters = currentFilters[project.id].filter(f => f.type !== "variable" && f.type !== "date");

        // Handle dashboard variable filters (these are interactive filters, not URL variables)
        let newConditions = [];
        variableFilters.forEach((variableFilter) => {
          const found = identifiedConditions.find((c) => c.variable === variableFilter.variable);
          if (found) {
            newConditions.push({
              ...found,
              value: variableFilter.value,
            });
          }
        });

        // Combine non-date filters into a single array
        const allFilters = [...newConditions, ...otherFilters];

        // Only make an API call if there are filters to apply
        if (allFilters.length > 0) {
          refreshPromises.push(
            dispatch(runQueryWithFilters({
              project_id: project.id,
              chart_id: chart.id,
              filters: allFilters,
            }))
          );
        }

        // Handle date filters for selected charts
        if (dateFilters.length > 0 && dateFilters[0].charts?.includes(chart.id)) {
          queries.push({
            projectId: project.id,
            chartId: chart.id,
            dateFilter: dateFilters[0], // We only use the first date filter since we only allow one
          });
        }
      }
    });

    return Promise.all(refreshPromises)
      .then(() => {
        if (queries.length > 0) {
          return _throttleRefreshes(queries, 0);
        }
        return "done";
      })
      .then(() => {
        setFilterLoading(false);
      })
      .catch(() => {
        setFilterLoading(false);
      });
  };

  const _throttleRefreshes = (refreshes, index, batchSize = 5) => {
    if (index >= refreshes.length) return Promise.resolve("done");

    // Get the next batch of refreshes to process
    const batch = refreshes.slice(index, index + batchSize);
    const batchPromises = batch.map((refresh) => {
      return dispatch(runQueryWithFilters({
        project_id: refresh.projectId,
        chart_id: refresh.chartId,
        filters: refresh.dateFilter,
      }))
      .catch(() => {
        // Continue even if one request fails
        return null;
      });
    });

    return Promise.all(batchPromises)
      .then(() => {
        return _throttleRefreshes(refreshes, index + batchSize, batchSize);
      });
  };

  const _onApplyFilterValue = (filters) => {
    // URL variables are now handled by the backend, just apply dashboard filters
    _runFiltering(filters);
  };

  const _onRemoveFilter = () => {
    // No need to do anything here since we don't store filters in localStorage
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
          <title>
            {newChanges.dashboardTitle || project.dashboardTitle || project.name || "Chartbrew dashboard"}
          </title>
          <meta name="description" content={project.description || newChanges.description || "Chartbrew dashboard"} />
          <meta name="robots" content="noindex" />
          <meta name="og:title" content={newChanges.dashboardTitle || project.dashboardTitle || project.name || "Chartbrew dashboard"} />
          <meta name="og:description" content={project.description || newChanges.description || "Chartbrew dashboard"} />

          {(newChanges?.headerCode || project?.headerCode) && !removeStyling && (
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
          <div className="container mx-auto max-w-xl p-16">
            <div>
              <h3 className="text-xl font-bold font-tw">
                Please enter the password to access this report
              </h3>
            </div>
            <Spacer y={2} />

            <Form
              onSubmit={(e) => {
                e.preventDefault();
                _fetchProject(reportPassword);
              }}
            >
              <Input
                placeholder="Enter the password here"
                value={reportPassword}
                type="password"
                onChange={(e) => setReportPassword(e.target.value)}
                size="lg"
                fullWidth
                variant="bordered"
              />
              <Button 
                color="primary"
                loading={loading}
                onPress={() => {}}
                type="submit"
              >
                Access report
              </Button>
            </Form>
          </div>
        )}
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
              onPress={() => window.history.back()}
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
        <div className="container mx-auto pt-16">
          <div className="flex flex-col items-center justify-center">
            <Image src={logo} height={50} width={50} radius="none" alt="Chartbrew logo" />
            <Spacer y={2} />
            <h3 className="text-xl font-bold font-tw">{"This report is not available"}</h3>
            <p className="text-sm">{"This report is not available because it has no charts or it is not public."}</p>
          </div>
          <Spacer y={2} />
        </div>
      </div>
    );
  }

  return (
    <div className="dashboard-container">
      <Helmet>
        <title>
          {newChanges.dashboardTitle || project.dashboardTitle || project.name || "Chartbrew dashboard"}
        </title>
        <meta name="description" content={project.description || newChanges.description || "Chartbrew dashboard"} />
        <meta name="robots" content="noindex" />
        <meta name="og:title" content={newChanges.dashboardTitle || project.dashboardTitle || project.name || "Chartbrew dashboard"} />
        <meta name="og:description" content={project.description || newChanges.description || "Chartbrew dashboard"} />
        <meta name="og:image" content={project.logo ? `${API_HOST}/${project.logo}` : logo} />
        <meta name="og:url" content={window.location.href} />
        <meta name="og:type" content="website" />
        <meta name="og:site_name" content={project.name || "Chartbrew dashboard"} />
        <meta name="og:locale" content="en_US" />
        {(newChanges?.headerCode || project?.headerCode) && !removeStyling && (
          <style type="text/css">{newChanges.headerCode || project.headerCode}</style>
        )}
        <style type="text/css">
          {`
            html, body {
              background-color: ${removeStyling ? (isDark ? "#000000" : "#FFFFFF") : (newChanges.backgroundColor)} !important;
            }
          `}
        </style>
      </Helmet>

      {editorVisible && !preview && (
        <aside className="fixed top-0 left-0 z-40 w-16 h-screen" aria-label="Sidebar">
          <div className="h-full px-3 py-2 overflow-y-auto bg-gray-50 dark:bg-gray-800">
            <div className="flex flex-col gap-4 p-2">
              <div>
                <Tooltip content="Back to your dashboard" placement="right-end">
                  <LinkDom to={`/${project.team_id}/${project.id}/dashboard`}>
                    <Link className="text-foreground cursor-pointer">
                      <LuSquareArrowLeft size={26} className="text-foreground" />
                    </Link>
                  </LinkDom>
                </Tooltip>
              </div>

              <Divider />

              <div>
                <Tooltip content="Preview dashboard" placement="right-end">
                  <Link className="text-foreground cursor-pointer" onPress={() => setPreview(true)}>
                    <LuEye size={26} className="text-foreground" />
                  </Link>
                </Tooltip>
              </div>

              {project?.id && _canAccess("projectEditor") && (
                <>
                  <div>
                    <Tooltip content="Change logo" placement="right-end">
                      <Link className="text-foreground cursor-pointer">
                        <div {...getRootProps()}>
                          <input {...getInputProps()} />
                          <LuImagePlus size={26} className="text-foreground" />
                        </div>
                      </Link>
                    </Tooltip>
                  </div>
                  <div>
                    <Popover placement="right-end">
                      <PopoverTrigger>
                        <Link className="text-foreground cursor-pointer">
                          <LuPalette size={26} className="text-foreground" />
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
                                  setNewChanges({ ...newChanges, backgroundColor: color.hex.toUpperCase() });
                                }}
                                colors={defaultColors}
                                triangle="hide"
                                styles={{default: { card: { boxShadow: "none" } }}}
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
                              triangle="hide"
                              styles={{ default: { card: { boxShadow: "none" } } }}
                            />
                          </Row>
                        </div>
                      </PopoverContent>
                    </Popover>
                  </div>

                  <div>
                    <Tooltip content="Report settings" placement="right-end">
                      <Link className="text-foreground cursor-pointer" onPress={() => setEditingTitle(true)}>
                        <LuClipboardPen size={26} className="text-foreground" />
                      </Link>
                    </Tooltip>
                  </div>

                  <div>
                    <Tooltip content="Sharing settings" placement="right-end">
                      <Link className="text-foreground cursor-pointer" onPress={() => setShowSettings(true)}>
                        <LuShare size={26} className="text-foreground" />
                      </Link>
                    </Tooltip>
                  </div>
                </>
              )}
            </div>
          </div>
        </aside>
      )}

      <div className={editorVisible && !preview ? "ml-16" : ""}>
        {!removeHeader && (
          <Navbar
            isBordered
            maxWidth={"full"}
            isBlurred={false}
            className={"header grow-0 justify-between"}
            style={{ backgroundColor: removeStyling ? (isDark ? "#000000" : "#FFFFFF") : (newChanges.backgroundColor || project.backgroundColor || "#FFFFFF") }}
          >
            <NavbarBrand>
              <div className="flex flex-row items-center gap-4">
                {editorVisible && !preview && (
                  <div className="dashboard-logo-container" style={{ height: 45, width: 45 * logoAspectRatio }}>
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
                  <div className="dashboard-logo-container" style={{ height: 45, width: 45 * logoAspectRatio }}>
                    <a
                      href={newChanges.logoLink || project.logoLink || "#"}
                      target="_blank"
                      rel="noreferrer"
                    >
                      <img
                        onLoad={_onLoadLogo}
                        className="dashboard-logo"
                        src={project.logo ? `${API_HOST}/${project.logo}` : logo}
                        alt={`${project.name} Logo`}
                        height={45}
                        width={45 * logoAspectRatio}
                      />
                    </a>
                  </div>
                )}

                <div className="flex flex-col max-w-[calc(100vw-100px)]">
                  <span
                    className="text-lg font-bold truncate"
                    style={{ color: removeStyling ? (isDark ? "#FFFFFF" : "#000000") : (newChanges.titleColor || project.titleColor || "#000000") }}
                  >
                    {newChanges.dashboardTitle || project.dashboardTitle || project.name}
                  </span>
                  {!editorVisible && project.description && (
                    <span
                      className="dashboard-sub-title truncate"
                      style={{ color: removeStyling ? (isDark ? "#FFFFFF" : "#000000") : (newChanges.titleColor || project.titleColor || "#000000") }}
                    >
                      {project.description}
                    </span>
                  )}
                  {editorVisible && newChanges.description && (
                    <span
                      className="dashboard-sub-title truncate"
                      style={{ color: removeStyling ? (isDark ? "#FFFFFF" : "#000000") : (newChanges.titleColor || project.titleColor || "#000000") }}
                    >
                      {newChanges.description}
                    </span>
                  )}
                </div>
              </div>
            </NavbarBrand>
          </Navbar>
        )}

        <div className="absolute top-4 right-4 z-50">
          {!isSaved && !preview && project?.id && _canAccess("projectEditor") && (
            <div className="hidden sm:block">
              <Button
                color="success"
                endContent={<LuCircleCheck />}
                isLoading={saveLoading}
                onPress={_onSaveChanges}
              >
                Save changes
              </Button>
            </div>
          )}
          {preview && (
            <div>
              <Button
                onPress={() => setPreview(false)}
                endContent={<LuCircleX />}
                color="primary"
                variant="faded"
              >
                Exit preview
              </Button>
            </div>
          )}

          {project?.Team?.allowReportRefresh && (
            <div className="hidden sm:block">
              <Button
                onPress={() => _onRefreshCharts()}
                endContent={<LuRefreshCw />}
                isLoading={refreshLoading}
                size="sm"
                color="primary"
              >
                Refresh charts
              </Button>
            </div>
          )}
        </div>

        {charts && charts.length > 0 && _isOnReport() && (
          <div className="main-container relative p-2 pt-4 pb-10 md:pt-4 md:pb-10 md:pl-4 md:pr-4">
            {loading && charts.length === 0 && (
              <Container style={styles.container}>
                <Spacer y={4} />
                <Row align="center" justify="center">
                  <CircularProgress size="lg" aria-label="Loading" />
                </Row>
              </Container>
            )}

            {dashboardFilters?.[project.id]?.length > 0 && (
              <div className="flex flex-col sm:flex-row gap-2 items-start sm:items-center bg-background p-2 mx-2 rounded-lg border-1 border-divider">
                {!filterLoading && (
                  <div className="flex flex-row items-center gap-2">
                    <LuListFilter size={22} />
                    <div className="block sm:hidden text-sm">Filters</div>
                  </div>
                )}
                {filterLoading && (
                  <Spinner size="sm" aria-label="Loading" />
                )}
                <DashboardFilters
                  filters={dashboardFilters}
                  projectId={project.id}
                  onRemoveFilter={_onRemoveFilter}
                  onApplyFilterValue={_onApplyFilterValue}
                  onReport
                />
              </div>
            )}

            {layouts && charts?.length > 0 && (
              <div className="w-full">
                <ResponsiveGridLayout
                  className="layout"
                  layouts={layouts}
                  breakpoints={widthSize}
                  cols={cols}
                  margin={margin}
                  onLayoutChange={() => {}}
                  rowHeight={150}
                  isDraggable={false}
                  isResizable={false}
                >
                  {charts.filter((c) => !c.draft && c.onReport).map((chart) => (
                    <div key={chart.id}>
                      {chart.type === "markdown" ? (
                        <TextWidget
                          isPublic
                          chart={chart}
                          onEditLayout={() => {}}
                          editingLayout={false}
                          onCancelChanges={() => {}}
                          onSaveChanges={() => {}}
                          onEditContent={() => {}}
                        />
                      ) : (
                        <Chart
                          isPublic
                          chart={chart}
                          charts={charts}
                          className="chart-card"
                          showExport={project.Team?.allowReportExport}
                          password={project.password || window.localStorage.getItem("reportPassword")}
                        />
                      )}
                    </div>
                  ))}
                </ResponsiveGridLayout>
              </div>
            )}

            {project.Team && project.Team.showBranding && (
              <div className="footer-content mt-4 pr-4 flex justify-end">
                <Link
                  className={`flex items-start !text-[${removeStyling ? "#000000" : (newChanges.titleColor || project.titleColor || "#000000")}]`}
                  href={"https://chartbrew.com?ref=chartbrew_report"}
                  target="_blank"
                  rel="noopener noreferrer"
                >
                  <span className="text-sm" style={{ color: removeStyling ? "#000000" : (newChanges.titleColor || project.titleColor || "#000000") }}>
                    {"Powered by "}
                  </span> 
                  <Spacer x={1} />
                  <span className="text-sm" style={{ color: removeStyling ? "#000000" : (newChanges.titleColor || project.titleColor || "#000000") }}>
                    <strong>{"Chart"}</strong>
                  </span>
                  <span className="text-sm" style={{ color: removeStyling ? "#000000" : (newChanges.titleColor || project.titleColor || "#000000") }}>
                    {"brew"}
                  </span>
                </Link>
              </div>
            )}
          </div>
        )}
      </div>

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
              onPress={() => setEditingTitle(false)}
            >
              Preview changes
            </Button>
          </ModalFooter>
        </ModalContent>
      </Modal>

      {project && (
        <SharingSettings
          open={showSettings}
          onClose={() => setShowSettings(false)}
          onReport={true}
        />
      )}
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

export default Report;
