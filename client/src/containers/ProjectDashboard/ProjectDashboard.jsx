import React, { useState, useEffect, useRef } from "react";
import PropTypes from "prop-types";
import { useDispatch, useSelector } from "react-redux";
import {
  Button, Spacer, Tooltip, Modal, Chip,
  ModalHeader, ModalBody, ModalContent, AvatarGroup, Avatar, Popover, PopoverTrigger,
  PopoverContent, Listbox, ListboxItem, Divider, Dropdown, DropdownTrigger,
  DropdownMenu, DropdownItem, Kbd, ButtonGroup,
  Tabs,
  Tab,
} from "@heroui/react";
import { Link, useNavigate, useParams } from "react-router-dom";
import { useWindowSize } from "react-use";
import _, { isEqual } from "lodash";
import toast from "react-hot-toast";
import {
  LuCalendarClock,
  LuCopyPlus, LuFileDown, LuLayoutDashboard, LuListFilter,
  LuCirclePlus, LuRefreshCw, LuUser, LuUsers,
  LuEllipsisVertical, LuShare, LuChartPie, LuGrid2X2Plus, LuLetterText,
  LuMonitorSmartphone,
  LuMonitorUp,
  LuArrowDownRight,
} from "react-icons/lu";
import { WidthProvider, Responsive } from "react-grid-layout";
import "react-grid-layout/css/styles.css";
import "react-resizable/css/styles.css";
import { v4 as uuidv4 } from "uuid";

import Chart from "../Chart/Chart";
import AddFilters from "./components/AddFilters";
import {
  getProjectCharts, runQueryWithFilters, runQuery, changeOrder, exportChart, updateChart, selectCharts,
  clearStagedCharts,
  createChart,
  stageChart,
  removeLocalChart,
} from "../../slices/chart";
import canAccess from "../../config/canAccess";
import ChartExport from "./components/ChartExport";
import CreateTemplateForm from "../../components/CreateTemplateForm";
import Row from "../../components/Row";
import Text from "../../components/Text";
import { selectProjectMembers, selectTeam } from "../../slices/team";
import { cols, margin, widthSize } from "../../modules/layoutBreakpoints";
import { selectUser } from "../../slices/user";
import UpdateSchedule from "./components/UpdateSchedule";
import { selectProject } from "../../slices/project";
import SharingSettings from "../PublicDashboard/components/SharingSettings";
import isMac from "../../modules/isMac";
import TextWidget from "../Chart/TextWidget";
import SnapshotSchedule from "./components/SnapshotSchedule";
import DashboardFilters from "./components/DashboardFilters";

const ResponsiveGridLayout = WidthProvider(Responsive, { measureBeforeMount: true });

const breakpoints = {
  mobile: 0,
  tablet: 640,
  computer: 1024,
};

const getFiltersFromStorage = () => {
  try {
    const filters = JSON.parse(window.localStorage.getItem("_cb_filters"));
    return filters || null;
  } catch (e) {
    return null;
  }
};

const getFilterGroupsFromStorage = () => {
  try {
    const filterGroups = JSON.parse(window.localStorage.getItem("_cb_filter_groups"));
    return filterGroups || null;
  } catch (e) {
    return null;
  }
};

/*
  Dashboard container (for the charts)
*/
function ProjectDashboard(props) {
  const { mobile } = props;

  const [filters, setFilters] = useState(getFiltersFromStorage());
  const [filterGroups, setFilterGroups] = useState(getFilterGroupsFromStorage());
  const [showFilters, setShowFilters] = useState(false);
  const [filterLoading, setFilterLoading] = useState(false);
  const [refreshLoading, setRefreshLoading] = useState(false);
  const [viewExport, setViewExport] = useState(false);
  const [exportLoading, setExportLoading] = useState(false);
  const [exportError, setExportError] = useState(false);
  const [templateVisible, setTemplateVisible] = useState(false);
  const [layouts, setLayouts] = useState(null);
  const [editingLayout, setEditingLayout] = useState(false);
  const [scheduleVisible, setScheduleVisible] = useState(false);
  const [showShare, setShowShare] = useState(false);
  const [stagedContent, setStagedContent] = useState({});
  const [previewSize, setPreviewSize] = useState({});
  const [snapshotScheduleVisible, setSnapshotScheduleVisible] = useState(false);

  const params = useParams();
  const dispatch = useDispatch();
  const navigate = useNavigate();

  const team = useSelector(selectTeam);
  const user = useSelector(selectUser);
  const charts = useSelector(selectCharts);
  const project = useSelector(selectProject);
  const chartsLoading = useSelector((state) => state.chart.loading);
  const projectMembers = useSelector((state) => selectProjectMembers(state, params.projectId));

  const { width } = useWindowSize();
  const initLayoutRef = useRef(null);
  const hasRunInitialFiltering = useRef(null);
  const dashboardRef = useRef(null);
  const dashboardParentRef = useRef(null);

  useEffect(() => {
    const handleKeyPress = (event) => {
      // Only trigger if no input/textarea is focused
      if (event.target.tagName.toLowerCase() === "input" || event.target.tagName.toLowerCase() === "textarea") return;

      if ((event.metaKey || event.ctrlKey) && event.key.toLowerCase() === "e") {
        event.preventDefault();
        if (editingLayout) {
          _onCancelChanges();
        } else {
          _onEditLayout();
        }
      }
    };

    document.addEventListener("keydown", handleKeyPress);

    return () => {
      document.removeEventListener("keydown", handleKeyPress);
    };
  }, [editingLayout]);

  useEffect(() => {
    if (!filterLoading && filters && charts.length > 0 && !hasRunInitialFiltering.current) {
      hasRunInitialFiltering.current = true;
      _runFiltering();
    }
  }, [filters, charts]);

  useEffect(() => {
    if (charts && charts.filter((c) => c.project_id === parseInt(params.projectId, 10)).length > 0 && !initLayoutRef.current) {
      initLayoutRef.current = true;
      // set the grid layout
      _prepareLayout();
    }

    charts.forEach((chart) => {
      if (chart.staged) {
        _onEditLayout();
      }
    });
  }, [charts]);

  const _onEditLayout = async () => {
    if (editingLayout) {
      return;
    }

    setEditingLayout(true);

    const dashboardWidth = dashboardRef.current?.offsetWidth;

    let newPreviewSize = {
      size: dashboardWidth,
      breakpoint: "auto",
    };

    // Determine initial breakpoint based on dashboard width
    if (dashboardWidth > widthSize.lg) {
      newPreviewSize = {
        size: dashboardWidth,
        breakpoint: "xl",
      };
    } else if (dashboardWidth > widthSize.md && dashboardWidth <= widthSize.lg) {
      newPreviewSize = {
        size: dashboardWidth,
        breakpoint: "lg",
      };
    } else if (dashboardWidth > widthSize.sm && dashboardWidth <= widthSize.md) {
      newPreviewSize = {
        size: dashboardWidth,
        breakpoint: "md",
      };
    } else if (dashboardWidth > widthSize.xs && dashboardWidth <= widthSize.sm) {
      newPreviewSize = {
        size: dashboardWidth,
        breakpoint: "sm",
      };
    } else if (dashboardWidth <= widthSize.xs) {
      newPreviewSize = {
        size: dashboardWidth,
        breakpoint: "xs",
      };
    }

    setPreviewSize(newPreviewSize);
  };

  const _getUserBreakpoint = () => {
    const dashboardWidth = dashboardParentRef.current?.offsetWidth;
    if (dashboardWidth > widthSize.xxxl) return "xxxl";
    if (dashboardWidth > widthSize.xxl) return "xxl";
    if (dashboardWidth > widthSize.xl) return "xl";
    if (dashboardWidth > widthSize.lg) return "lg";
    if (dashboardWidth > widthSize.md) return "md";
    if (dashboardWidth > widthSize.sm) return "sm";
    return "xs";
  };

  const _onChangePreviewSize = (key) => {
    const dashboardWidth = dashboardParentRef.current?.offsetWidth;
    const breakpointWidth = key === "xxxl" ? 3840 : key === "xxl" ? 2560 : key === "xl" ? 1600 : widthSize[key];
    let newSize;

    // Case 1: Switching to a smaller breakpoint - use breakpoint width
    if (breakpointWidth < dashboardWidth) {
      newSize = breakpointWidth;
    }
    // Case 2: Switching to current screen's breakpoint - use Math.min
    else if (_getUserBreakpoint() === key) {
      newSize = Math.min(dashboardWidth, breakpointWidth);
    }
    // Case 3: Switching to a larger breakpoint - use breakpoint width (will enable scroll)
    else {
      newSize = breakpointWidth;
    }

    setPreviewSize({
      size: newSize,
      breakpoint: key,
    });
  };

  const _prepareLayout = (chartsToProcess = charts) => {
    const newLayouts = Object.keys(widthSize).reduce((acc, key) => {
      acc[key] = [];
      return acc;
    }, {});

    chartsToProcess.forEach((chart) => {
      if (chart?.layout) {
        // First, process all existing breakpoints
        Object.keys(chart.layout).forEach((key) => {
          if (newLayouts[key]) {
            newLayouts[key].push({
              i: `${chart.id}`,
              x: chart.layout[key][0] || 0,
              y: chart.layout[key][1] || 0,
              w: chart.layout[key][2],
              h: chart.layout[key][3],
              minW: 2,
            });
          }
        });
      }
    });

    setLayouts(newLayouts);
  };

  const _onEditFilterGroup = (chartId, selectAll = false, deselectAll = false) => {
    const { projectId } = params;
    const newFilterGroups = _.clone(filterGroups) || {};
    if (!newFilterGroups[projectId]) newFilterGroups[projectId] = [];

    if (selectAll) {
      newFilterGroups[projectId] = charts.filter((c) => c.project_id === parseInt(projectId, 10)).map((c) => c.id);
    } else if (deselectAll) {
      newFilterGroups[projectId] = [];
    } else if (newFilterGroups[projectId].find((c) => c === chartId)) {
      newFilterGroups[projectId] = newFilterGroups[projectId].filter((c) => c !== chartId);
    } else {
      newFilterGroups[projectId].push(chartId);
    }

    setFilterGroups(newFilterGroups);
    window.localStorage.setItem("_cb_filter_groups", JSON.stringify(newFilterGroups));
  };

  const _onAddFilter = (filter) => {
    const { projectId } = params;

    const newFilters = _.clone(filters) || {};
    if (!newFilters[projectId]) newFilters[projectId] = [];

    if (filter.type === "date") {
      newFilters[projectId] = newFilters[projectId].filter((f) => f.type !== "date");
    }

    newFilters[projectId].push(filter);
    setFilters(newFilters);

    window.localStorage.setItem("_cb_filters", JSON.stringify(newFilters));

    setShowFilters(false);
    _onFilterCharts(newFilters);
  };

  const _onAddVariableFilter = (variableFilter) => {
    const { projectId } = params;

    const newFilters = _.clone(filters) || {};
    if (!newFilters[projectId]) newFilters[projectId] = [];

    // Convert variable filter to unified filter format
    const filter = {
      id: uuidv4(),
      type: "variable",
      variable: variableFilter.variable,
      value: variableFilter.value
    };

    newFilters[projectId].push(filter);
    setFilters(newFilters);

    window.localStorage.setItem("_cb_filters", JSON.stringify(newFilters));

    _onFilterCharts(newFilters);
    setShowFilters(false);
  };

  const _onRemoveFilter = (filterId) => {
    const { projectId } = params;
    if (filters && filters[projectId].length === 1) {
      const newFilters = _.cloneDeep(filters);
      delete newFilters[projectId];
      setFilters(newFilters);
      window.localStorage.removeItem("_cb_filters");
      _onFilterCharts({});
      return;
    }

    const index = _.findIndex(filters[projectId], { id: filterId });
    if (!index && index !== 0) return;

    const newFilters = _.cloneDeep(filters);
    newFilters[projectId].splice(index, 1);

    setFilters(newFilters);
    window.localStorage.setItem("_cb_filters", JSON.stringify(newFilters));
    _onFilterCharts(newFilters);
  };

  const _runFiltering = (currentFilters = filters, chartIds = null) => {
    if (!currentFilters?.[params.projectId] || charts.length === 0) return;

    setFilterLoading(true);
    _onFilterCharts(currentFilters, chartIds)
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
      return dispatch(runQuery({
        project_id: refresh.projectId,
        chart_id: refresh.chartId,
        noSource: false,
        skipParsing: false,
        getCache: false,
        filters: refresh.dateFilter,
      }))
      .catch(() => {
        // Continue even if one request fails
        return null;
      });
    });

    return Promise.all(batchPromises)
      .then(() => {
        // Run filters on the batch that just completed
        return Promise.resolve("done");
      })
      .then(() => {
        return _throttleRefreshes(refreshes, index + batchSize, batchSize);
      });
  };

  const _onFilterCharts = (currentFilters = filters, chartIds = null) => {
    const { projectId } = params;

    if (!currentFilters || !currentFilters[projectId]) {
      dispatch(getProjectCharts({ project_id: projectId }));
      setFilterLoading(false);
      return Promise.resolve("done");
    }

    const refreshPromises = [];
    const queries = [];

    // Filter charts based on chartIds if provided
    const chartsToProcess = chartIds 
      ? charts.filter(chart => chartIds.includes(chart.id))
      : charts;
    
    chartsToProcess.forEach((chart) => {
      if (currentFilters && currentFilters[projectId]) {
        setFilterLoading(true);
        
        // Get all conditions from the chart's datasets
        let identifiedConditions = [];
        chart.ChartDatasetConfigs.forEach((cdc) => {
          if (Array.isArray(cdc.Dataset?.conditions)) {
            identifiedConditions = [...identifiedConditions, ...cdc.Dataset.conditions];
          }
        });

        // Separate filters by type
        const variableFilters = currentFilters[projectId].filter(f => f.type === "variable");
        const dateFilters = currentFilters[projectId].filter(f => f.type === "date");
        const otherFilters = currentFilters[projectId].filter(f => f.type !== "variable" && f.type !== "date");

        // Handle variable filters by matching against chart conditions
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

        // Only make an API call if there are non-date filters to apply
        if (allFilters.length > 0) {
          refreshPromises.push(
            dispatch(runQueryWithFilters({
              project_id: projectId,
              chart_id: chart.id,
              filters: allFilters,
            }))
          );
        }

        // Handle date filters for selected charts
        if (dateFilters.length > 0 && filterGroups?.[projectId]?.find((c) => c === chart.id)) {
          queries.push({
            projectId,
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

  const _checkIfAnyKindOfFiltersAreAvailable = () => {
    return filters?.[params.projectId]?.length > 0;
  };

  const _onRefreshData = () => {
    const { projectId } = params;

    const queries = [];
    setRefreshLoading(true);
    for (let i = 0; i < charts.filter(c => !c.staged || c.type === "markdown").length; i++) {
      const queryOpt = {
        projectId,
        chartId: charts[i].id,
      };
      if (filterGroups?.[projectId]?.find((c) => c === charts[i].id)) {
        queryOpt.dateFilter = filters?.[projectId]?.find((o) => o.type === "date");
      }

      queries.push(queryOpt);
    }

    return _throttleRefreshes(queries, 0)
      .then(() => {
        setRefreshLoading(false);
        // Apply variable filters after refresh is complete
        if (_checkIfAnyKindOfFiltersAreAvailable()) {
          _runFiltering();
        }
      })
      .catch(() => {
        setRefreshLoading(false);
      });
  };

  const _onShowFilters = () => {
    setShowFilters(true);
  };

  const _onChangeOrder = (chartId, type, index) => {
    let otherId;
    switch (type) {
      case "up":
        otherId = charts[index - 1].id;
        break;
      case "down":
        otherId = charts[index + 1].id;
        break;
      case "top":
        otherId = "top";
        break;
      case "bottom":
        otherId = "bottom";
        break;
      default:
        break;
    }
    dispatch(changeOrder({
      project_id: params.projectId,
      chart_id: chartId,
      otherId,
    }));
  };

  const _canAccess = (role) => {
    return canAccess(role, user.id, team.TeamRoles);
  };

  const _openExport = () => {
    setViewExport(true);
  };

  const _onExport = (ids) => {
    setExportLoading(true);
    setExportError(false);
    const appliedFilters = (filters && filters[params.projectId]) || null;
    return dispatch(exportChart({
      project_id: params.projectId,
      chartIds: ids,
      filters: appliedFilters
    }))
      .then(() => {
        setExportLoading(false);
        setViewExport(false);
      })
      .catch(() => {
        setExportLoading(false);
        setExportError(true);
      });
  };

  const _canExport = () => {
    if (!team || !team.TeamRoles) return false;

    let canExport = false;
    team.TeamRoles.map((teamRole) => {
      if (teamRole.team_id === parseInt(params.teamId, 10)
        && teamRole.user_id === user.id
        && (teamRole.canExport || teamRole.role === "teamOwner")
      ) {
        canExport = true;
      }
      return teamRole;
    });

    return canExport;
  };

  const _onUpdateExport = (chartId, disabled) => {
    dispatch(updateChart({
      project_id: params.projectId,
      chart_id: chartId,
      data: { disabledExport: disabled },
      justUpdates: true
    }));
  };

  const _onChangeLayout = (layout, allLayouts, toComplete = false) => {
    const updatedCharts = charts.map(chart => {
      const updatedLayout = {};

      Object.keys(allLayouts).forEach(breakpoint => {
        const layoutItem = allLayouts[breakpoint].find(item => item.i === `${chart.id}`);
        if (layoutItem || layoutItem === 0) {
          updatedLayout[breakpoint] = [layoutItem.x, layoutItem.y, layoutItem.w, layoutItem.h];
        }
      });

      return { ...chart, layout: updatedLayout };
    });

    if (toComplete) {
      updatedCharts.forEach((chart, index) => {
        // only allow chart updates if the layout has all the breakpoints
        const chartBreakpoints = Object.keys(chart.layout);
        const allBreakpoints = Object.keys(widthSize);

        if (chartBreakpoints.length === allBreakpoints.length) {
          // only update the layout if it has changed
          if (!isEqual(chart.layout, charts[index].layout)) {
            dispatch(updateChart({
              project_id: params.projectId,
              chart_id: chart.id,
              data: { layout: chart.layout },
              justUpdates: true
            }));
          }
        }
      });
    }

    setLayouts(allLayouts);    
  };

  const _onCancelChanges = async () => {
    await dispatch(clearStagedCharts());

    // should set the layouts to the original chart layouts
    const newLayouts = Object.keys(widthSize).reduce((acc, key) => {
      acc[key] = [];
      return acc;
    }, {});

    charts.forEach((chart) => {
      if (chart.layout) {
        Object.keys(chart.layout).forEach((key) => {
          newLayouts[key].push({
            i: `${chart.id}`,
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
    setEditingLayout(false);
  }

  const _onGetChartHeight = (chart) => {
    const currentBreakpoint = Object.keys(layouts).find(breakpoint => {
      return layouts[breakpoint].find(item => item.i === `${chart.id}`);
    });

    if (currentBreakpoint) {
      const layoutItem = layouts[currentBreakpoint].find(item => item.i === `${chart.id}`);
      return layoutItem.h * 150;
    }

    return 150;
  };

  const _onSaveChanges = async () => {
    // create all the staged charts
    const createPromises = charts.map((chart) => {
      if (chart.staged) {
        const newChart = {
          name: chart.name,
          type: chart.type,
          layout: chart.layout,
          content: stagedContent?.[chart.id] || chart.content,
          staged: false,
          onReport: true,
          draft: false,
        };
        
        dispatch(removeLocalChart({ id: chart.id }));
        return dispatch(createChart({
          project_id: params.projectId,
          data: newChart,
        }));
      }
      return null;
    }).filter(Boolean);

    if (createPromises.length > 0) {
      const createdCharts = await Promise.all(createPromises);
      const tempCharts = createdCharts.map((chart) => chart.payload);
      _prepareLayout([...charts, ...tempCharts]);
    } else {
      _onChangeLayout(null, layouts, true);
    }

    setStagedContent({});
    setEditingLayout(false);
  };

  const _onAddMarkdown = async () => {
    const newChart = {
      id: uuidv4(),
      project_id: parseInt(params.projectId, 10),
      type: "markdown",
      name: "Markdown",
      layout: {
        xxs: [0, 0, 4, 2],
        xs: [0, 0, 4, 2],
        sm: [0, 0, 2, 2],
        md: [0, 0, 3, 2],
        lg: [0, 0, 3, 2],
        xl: [0, 0, 3, 2],
        xxl: [0, 0, 3, 2],
      },
      staged: true,
    };

    await dispatch(stageChart(newChart));

    setStagedContent({
      ...stagedContent,
      [newChart.id]: newChart.content,
    });

    _prepareLayout([...charts, newChart]);
  };

  return (
    <div className={`w-full ${editingLayout && "bg-background dark:bg-content3 overflow-x-auto"}`}>
      {charts && charts.length > 0
        && (
          <div ref={dashboardParentRef}>
            <div
              className={"bg-content1 w-full border-b-1 border-solid border-content3"}
              size="xl"
              style={mobile ? styles.actionBarMobile : styles.actionBar}
            >
              <div className="flex flex-row justify-between gap-1 w-full">
                <div className="flex flex-row items-center gap-1">
                  {projectMembers?.length > 0 && (
                    <>
                      <div className="hidden sm:flex sm:flex-row border-r-1 border-solid border-content3">
                        <Popover>
                          <PopoverTrigger>
                            <div className="cursor-pointer">
                              <AvatarGroup max={3} isBordered size="sm" className="cursor-pointer pointer-events-none">
                                {projectMembers.map((member) => (
                                  <Avatar
                                    key={member.id}
                                    name={member.name}
                                    showFallback={<LuUser />}
                                  />
                                ))}
                              </AvatarGroup>
                            </div>
                          </PopoverTrigger>
                          <PopoverContent className="pt-4">
                            {_canAccess("teamAdmin") && (
                              <div className="w-full">
                                <Button
                                  endContent={<LuUsers />}
                                  color="primary"
                                  size="sm"
                                  as={Link}
                                  to={`/${params.teamId}/team/members`}
                                  fullWidth
                                  className="hover:text-foreground"
                                >
                                  Edit access
                                </Button>
                                <Spacer y={2} />
                                <Divider />
                                <Spacer y={2} />
                              </div>
                            )}
                            <Text>
                              {"Users with project access"}
                            </Text>
                            <Listbox aria-label="Select a user">
                              {projectMembers.map((member) => (
                                <ListboxItem
                                  key={member.id}
                                  textValue={member.name}
                                  description={member.email}
                                  endContent={(
                                    <Chip size="sm" variant="flat">
                                      {member.TeamRoles?.find((r) => r.team_id === parseInt(params.teamId, 10))?.role}
                                    </Chip>
                                  )}
                                >
                                  {member.name}
                                </ListboxItem>
                              ))}
                            </Listbox>
                          </PopoverContent>
                        </Popover>
                        <Spacer x={3} />
                      </div>
                      <Spacer x={1} />
                    </>
                  )}
                  <Tooltip content="Add dashboard filters" placement="bottom">
                    <Button
                      variant="ghost"
                      isIconOnly
                      isLoading={filterLoading}
                      onPress={_onShowFilters}
                      size="sm"
                    >
                      <LuListFilter size={18} />
                    </Button>
                  </Tooltip>
                  <div style={mobile ? {} : { paddingLeft: 4 }}>
                    <DashboardFilters
                      filters={filters}
                      projectId={params.projectId}
                      onRemoveFilter={_onRemoveFilter}
                    />
                  </div>
                </div>
                {!editingLayout && (
                  <div className="flex flex-row items-center gap-1">
                    <Dropdown aria-label="Add widget">
                      <DropdownTrigger>
                        <Button
                          variant="ghost"
                          size="sm"
                          onPress={() => navigate(`/${params.teamId}/${params.projectId}/chart`)}
                          startContent={<LuGrid2X2Plus size={18} />}
                        >
                          {"Add widget"}
                        </Button>
                      </DropdownTrigger>
                      <DropdownMenu>
                        <DropdownItem
                          startContent={<LuChartPie />}
                          onPress={() => {
                            navigate(`/${params.teamId}/${params.projectId}/chart`);
                          }}
                        >
                          Add chart
                        </DropdownItem>
                        <DropdownItem
                          startContent={<LuLetterText />}
                          onPress={() => _onAddMarkdown()}
                          endContent={<Chip size="sm" radius="sm" variant="flat" color="secondary">New!</Chip>}
                        >
                          Add text
                        </DropdownItem>
                      </DropdownMenu>
                    </Dropdown>
                    <ButtonGroup className="hidden sm:flex">
                      <Button
                        variant="ghost"
                        onPress={() => _onRefreshData()}
                        isLoading={refreshLoading}
                        size="sm"
                      >
                        Refresh charts
                      </Button>
                      {_canAccess("projectEditor") && (
                        <Tooltip content="Schedule data updates for this dashboard" placement="bottom">
                          <Button
                            variant="ghost"
                            isIconOnly
                            onPress={() => setScheduleVisible(true)}
                            size="sm"
                          >
                            <LuCalendarClock
                              className={`${project.updateSchedule?.frequency ? "text-primary" : ""}`}
                              size={22}
                            />
                          </Button>
                        </Tooltip>
                      )}
                    </ButtonGroup>
                    <Tooltip content="Refresh all charts" placement="bottom-end">
                      <Button
                        variant="ghost"
                        isIconOnly
                        onPress={() => _onRefreshData()}
                        isLoading={refreshLoading}
                        size="sm"
                        className="flex sm:hidden"
                      >
                        <LuRefreshCw size={24} />
                      </Button>
                    </Tooltip>
                    <Dropdown aria-label="Dashboard actions">
                      <DropdownTrigger>
                        <Button
                          variant="ghost"
                          isIconOnly
                          size="sm"
                        >
                          <LuEllipsisVertical size={20} />
                        </Button>
                      </DropdownTrigger>
                      <DropdownMenu>
                        <DropdownItem
                          startContent={<LuLayoutDashboard />}
                          onPress={() => _onEditLayout()}
                          endContent={<Kbd keys={[isMac ? "command" : "ctrl", "e"]}>E</Kbd>}
                        >
                          {"Edit layout"}
                        </DropdownItem>
                        <DropdownItem
                          startContent={<LuShare />}
                          onPress={() => setShowShare(true)}
                        >
                          {"Share dashboard"}
                        </DropdownItem>
                        {_canAccess("projectEditor") && (
                          <DropdownItem
                            startContent={<LuMonitorUp />}
                            onPress={() => setSnapshotScheduleVisible(true)}
                          >
                            {"Schedule deliveries"}
                          </DropdownItem>
                        )}
                        {_canAccess("teamAdmin") && (
                          <DropdownItem
                            startContent={<LuCopyPlus />} 
                            onPress={() => setTemplateVisible(true)}
                          >
                            {"Create a template"}
                          </DropdownItem>
                        )}
                        {_canExport() && (
                          <DropdownItem
                            startContent={<LuFileDown />}
                            onPress={() => _openExport()}
                          >
                            {"Export to Excel"}
                          </DropdownItem>
                        )}
                      </DropdownMenu>
                    </Dropdown>
                  </div>
                )}
                
                {editingLayout && (
                  <div className="flex flex-row items-center gap-1">
                    <Button
                      color="primary"
                      size="sm"
                      onPress={() => _onSaveChanges()}
                    >
                      Save changes
                    </Button>
                    <Button
                      variant="bordered"
                      size="sm"
                      onPress={_onCancelChanges}
                    >
                      Cancel
                    </Button>
                  </div>
                )}
              </div>
            </div>
          </div>
        )}
      <div
        className={`bg-content2 w-full relative ${editingLayout ? "border-2 border-divider rounded-2xl" : ""}`}
        style={{
          ...styles.container(width < breakpoints.tablet),
          ...(editingLayout && previewSize?.breakpoint && {
            width: previewSize.size,
            margin: "0 auto",
            boxSizing: "border-box",
            marginTop: 5,
            overflowX: previewSize.size > dashboardRef.current?.offsetWidth ? "auto" : "hidden",
          }),
          ...(editingLayout && {
            paddingBottom: 100,
          }),
        }}
        ref={dashboardRef}
      >
        {charts.length === 0 && !chartsLoading && (
          <div className="flex flex-col justify-center pt-10">
            <Row justify="center" align="center">
              <span className="text-xl font-bold">
                Welcome to your dashboard
              </span>
            </Row>
            <Spacer y={1} />
            {_canAccess("projectAdmin") && (
              <>
                <Row justify="center" align="center">
                  <span>
                    {"It looks empty over here. Let's create a chart to get started."}
                  </span>
                </Row>
                <Spacer y={4} /><Row justify="center" align="center">
                  <Button
                    endContent={<LuCirclePlus size={24} />}
                    size="lg"
                    color="primary"
                    onPress={() => navigate(`/${params.teamId}/${params.projectId}/chart`)}
                  >
                    Create a chart
                  </Button>
                </Row>
              </>
            )}
          </div>
        )}

        {layouts && charts.filter((c) => `${c.project_id}` === params.projectId).length > 0 && (
          <ResponsiveGridLayout
            className="layout dashboard-tutorial"
            layouts={layouts}
            margin={margin}
            breakpoints={widthSize}
            cols={cols}
            rowHeight={150}
            onLayoutChange={_onChangeLayout}
            resizeHandle={(
              <div className="react-resizable-handle react-resizable-handle-se">
                <LuArrowDownRight className="text-primary" size={20} />
              </div>
            )}
            isDraggable={editingLayout}
            isResizable={editingLayout}
          >
            {charts.map((chart, index) => (
              <div key={chart.id} className={editingLayout ? "border-2 border-dashed border-primary rounded-2xl" : ""}>
                {chart.type === "markdown" ? (
                  <TextWidget
                    chart={chart}
                    onEditLayout={() => _onEditLayout()}
                    editingLayout={editingLayout}
                    onCancelChanges={_onCancelChanges}
                    onSaveChanges={() => _onSaveChanges()}
                    onEditContent={(content) => setStagedContent({
                      ...stagedContent,
                      [chart.id]: content,
                    })}
                  />
                ) : (
                  <Chart
                    key={chart.id}
                    chart={chart}
                    charts={charts}
                    onChangeOrder={(chartId, type) => _onChangeOrder(chartId, type, index)}
                    height={() => _onGetChartHeight(chart)}
                    editingLayout={editingLayout}
                    onEditLayout={() => _onEditLayout()}
                  />
                )}
              </div>
            ))}
          </ResponsiveGridLayout>
        )}
      </div>
      
      <AddFilters
        charts={charts}
        projectId={params.projectId}
        onAddFilter={_onAddFilter}
        open={showFilters}
        onClose={() => setShowFilters(false)}
        filterGroups={filterGroups?.[params?.projectId] || []}
        onEditFilterGroup={_onEditFilterGroup}
        onAddVariableFilter={_onAddVariableFilter}
        filters={filters}
      />

      <Modal isOpen={viewExport} closeButton onClose={() => setViewExport(false)} size="2xl" scrollBehavior="outside">
        <ModalContent>
          <ModalHeader>
            <Text size="h3">Export to Excel (.xlsx)</Text>
          </ModalHeader>
          <ModalBody>
            <ChartExport
              charts={charts}
              onExport={_onExport}
              loading={exportLoading}
              error={exportError}
              onUpdate={(chartId, disabled) => _onUpdateExport(chartId, disabled)}
              showDisabled={_canAccess("projectEditor")}
            />
          </ModalBody>
        </ModalContent>
      </Modal>

      <UpdateSchedule
        isOpen={scheduleVisible}
        onClose={() => setScheduleVisible(false)}
        timezone={project.timezone}
        openSnapshotSchedule={() => setSnapshotScheduleVisible(true)}
      />

      <SnapshotSchedule
        isOpen={snapshotScheduleVisible}
        onClose={() => setSnapshotScheduleVisible(false)}
        timezone={project.timezone}
      />

      <CreateTemplateForm
        teamId={params.teamId}
        projectId={params.projectId}
        onClose={(isComplete) => {
          if (isComplete) toast.success("✨ The template was saved successfully");
          setTemplateVisible(false);
        }}
        visible={templateVisible}
      />

      <SharingSettings
        open={showShare}
        onClose={() => setShowShare(false)}
        project={project}
        // error={error}
        // onSaveBrewName={_onSaveBrewName}
        // brewLoading={saveLoading}
        // onToggleBranding={_onToggleBranding}
        // onTogglePublic={_onTogglePublic}
        // onTogglePassword={_onTogglePassword}
        // onSavePassword={_onSavePassword}
      />

      {editingLayout && (
        <div className="dark fixed bottom-0 left-0 right-0 z-50 border-t-1 border-solid border-content3">
          <div className="bg-background p-4 flex justify-center items-center animate-appearance-in">
            <div className="flex gap-4 items-center flex-wrap">
              <div className="flex gap-2 items-center">
                <Tooltip content="See how this dashboard looks on different devices. You can edit the layout on each device from here." size="sm" className="max-w-xs">
                  <span className="text-foreground">
                    <LuMonitorSmartphone />
                  </span>
                </Tooltip>
                <Tabs
                  size="sm"
                  variant="bordered"
                  selectedKey={previewSize?.breakpoint}
                  onSelectionChange={(key) => _onChangePreviewSize(key)}
                >
                  <Tab key="xxxl" title="4K" />
                  <Tab key="xxl" title="2K" />
                  <Tab key="xl" title="Large screen" />
                  <Tab key="lg" title="Desktop" />
                  <Tab key="md" title="Laptop" />
                  <Tab key="sm" title="Tablet" />
                  <Tab key="xs" title="Mobile" />
                </Tabs>
              </div>

              <Divider orientation="vertical" className="h-8" />

              <div className="flex gap-2">
                <Button
                  color="primary"
                  onPress={() => _onSaveChanges()}
                  size="sm"
                >
                  Save changes
                </Button>
                <Button
                  variant="bordered"
                  onPress={_onCancelChanges}
                  size="sm"
                >
                  Cancel
                </Button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

const styles = {
  container: (mobile) => ({
    flex: 1,
    padding: mobile ? 0 : 6,
    paddingTop: 6,
    paddingLeft: mobile ? 0 : 6,
  }),
  actionBar: {
    padding: 10,
    borderRadius: 0,
    boxShadow: "none",
    width: "100%",
  },
  actionBarMobile: {
    boxShadow: "none",
    padding: 5,
  },
  addChartBtn: {
    boxShadow: "0 1px 10px 0 #d4d4d5, 0 0 0 1px #d4d4d5",
  },
  refreshBtn: {
    position: "fixed",
    bottom: 25,
    right: 25,
  },
  chartGrid: (mobile) => ({
    padding: mobile ? 0 : 10,
    paddingTop: 10,
    paddingBottom: 10,
  }),
  mainGrid: (mobile) => ({
    padding: mobile ? 0 : 10,
    paddingTop: 10,
    paddingBottom: 10,
  }),
  addCard: {
    paddingTop: 50,
  },
};

ProjectDashboard.defaultProps = {
  mobile: false,
};

ProjectDashboard.propTypes = {
  mobile: PropTypes.bool,
};

export default ProjectDashboard;
