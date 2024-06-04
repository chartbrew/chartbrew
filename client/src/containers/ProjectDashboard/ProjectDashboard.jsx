import React, { useState, useEffect, Fragment, useRef } from "react";
import PropTypes from "prop-types";
import { connect, useDispatch, useSelector } from "react-redux";
import {
  Button, Spacer, Link as LinkNext, Tooltip, Modal, Chip,
  ModalHeader, ModalBody, ModalContent, AvatarGroup, Avatar, Popover, PopoverTrigger,
  PopoverContent, Listbox, ListboxItem, Divider,
} from "@nextui-org/react";
import { Link, useNavigate, useParams } from "react-router-dom";
import { useWindowSize } from "react-use";
import _, { isEqual } from "lodash";
import { ToastContainer, toast, Flip } from "react-toastify";
import "react-toastify/dist/ReactToastify.min.css";
import moment from "moment";
import {
  LuCopyPlus, LuFileDown, LuLayoutDashboard, LuListFilter,
  LuPlusCircle, LuRefreshCw, LuUser, LuUsers2, LuVariable, LuXCircle,
} from "react-icons/lu";
import { WidthProvider, Responsive } from "react-grid-layout";
import "react-grid-layout/css/styles.css";
import "react-resizable/css/styles.css";

import Chart from "../Chart/Chart";
import { cleanErrors as cleanErrorsAction } from "../../actions/error";
import Filters from "./components/Filters";
import { operators } from "../../modules/filterOperations";
import {
  getProjectCharts, runQueryWithFilters, runQuery, changeOrder, exportChart, updateChart, selectCharts,
} from "../../slices/chart";
import canAccess from "../../config/canAccess";
import ChartExport from "./components/ChartExport";
import CreateTemplateForm from "../../components/CreateTemplateForm";
import useThemeDetector from "../../modules/useThemeDetector";
import Row from "../../components/Row";
import Text from "../../components/Text";
import { selectProjectMembers, selectTeam } from "../../slices/team";
import { TbChevronDownRight } from "react-icons/tb";
import { widthSize } from "../../modules/layoutBreakpoints";
import { selectUser } from "../../slices/user";
import gridBreakpoints from "../../config/gridBreakpoints";

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

const getVariablesFromStorage = () => {
  try {
    const variables = JSON.parse(window.localStorage.getItem("_cb_variables"));
    return variables || null;
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
  const {
    cleanErrors, mobile,
  } = props;

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
  const [variables, setVariables] = useState(getVariablesFromStorage());

  const params = useParams();
  const dispatch = useDispatch();
  const navigate = useNavigate();

  const team = useSelector(selectTeam);
  const user = useSelector(selectUser);
  const charts = useSelector(selectCharts);
  const chartsLoading = useSelector((state) => state.chart.loading);
  const projectMembers = useSelector((state) => selectProjectMembers(state, params.projectId));

  const { width } = useWindowSize();
  const isDark = useThemeDetector();
  const initLayoutRef = useRef(null);

  useEffect(() => {
    cleanErrors();
  }, []);

  useEffect(() => {
    if (!filterLoading && filters && initLayoutRef.current) {
      _runFiltering();
    }
  }, [filters, initLayoutRef.current]);

  useEffect(() => {
    if (variables?.[params.projectId] && initLayoutRef.current) {
      _checkVariablesForFilters(variables[params.projectId]);
    }
  }, [variables]);

  useEffect(() => {
    if (charts && charts.filter((c) => c.project_id === parseInt(params.projectId, 10)).length > 0 && !initLayoutRef.current) {
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
  };

  const _onAddVariableFilter = (variableFilter) => {
    const { projectId } = params;

    const newVariables = _.clone(variables) || {};
    if (!newVariables[projectId]) newVariables[projectId] = [];

    newVariables[projectId].push(variableFilter);
    setVariables(newVariables);

    window.localStorage.setItem("_cb_variables", JSON.stringify(newVariables));

    _checkVariablesForFilters(newVariables[projectId]);
    setShowFilters(false);
  };

  const _checkVariablesForFilters = (variables) => {
    if (!variables || variables.length === 0) return;

    charts.forEach((chart) => {
      // check if there are any filters in the search params
      // if so, add them to the conditions
      let identifiedConditions = [];
      chart.ChartDatasetConfigs.forEach((cdc) => {
        if (Array.isArray(cdc.Dataset?.conditions)) {
          identifiedConditions = [...identifiedConditions, ...cdc.Dataset.conditions];
        }
      });

      // now check if any filters have the same variable name
      let newConditions = [];
      variables.forEach((variable) => {
        const found = identifiedConditions.find((c) => c.variable === variable.variable);
        if (found) {
          newConditions.push({
            ...found,
            value: variable.value,
          });
        }
      });

      if (newConditions.length > 0) {
        dispatch(runQueryWithFilters({
          project_id: chart.project_id,
          chart_id: chart.id,
          filters: newConditions,
        }));
      }
    });
  };

  const _onRemoveFilter = (filterId) => {
    const { projectId } = params;
    if (filters && filters[projectId].length === 1) {
      const newFilters = _.cloneDeep(filters);
      delete newFilters[projectId];
      setFilters(newFilters);
      window.localStorage.removeItem("_cb_filters");
      _runFiltering({});
      return;
    }

    const index = _.findIndex(filters[projectId], { id: filterId });
    if (!index && index !== 0) return;

    const newFilters = _.cloneDeep(filters);
    newFilters[projectId].splice(index, 1);

    setFilters(newFilters);
    window.localStorage.setItem("_cb_filters", JSON.stringify(newFilters));
  };

  const _onRemoveVariable = (variable) => {
    const { projectId } = params;
    const index = _.findIndex(variables[projectId], { variable });
    if (!index && index !== 0) return;

    const newVariables = _.cloneDeep(variables);
    newVariables[projectId].splice(index, 1);

    setVariables(newVariables);
    window.localStorage.setItem("_cb_variables", JSON.stringify(newVariables));

    _checkVariablesForFilters([{
      variable: variable,
      remove: true,
    }]);
  };

  const _runFiltering = (currentFilters = filters) => {
    setFilterLoading(true);
    setTimeout(() => {
      _onFilterCharts(currentFilters)
        .then(() => {
          _checkVariablesForFilters(variables[params.projectId]);
        });
    }, 500);
  };

  const _throttleRefreshes = (refreshes, index) => {
    if (index >= refreshes.length) return Promise.resolve("done");

    return dispatch(runQuery({
      project_id: refreshes[index].projectId,
      chart_id: refreshes[index].chartId,
      noSource: false,
      skipParsing: false,
      getCache: false,
      filters: refreshes[index].dateFilter,
    }))
      .then(() => {
        return _throttleRefreshes(refreshes, index + 1);
      })
      .catch(() => {
        return _throttleRefreshes(refreshes, index + 1);
      });
  };

  const _onFilterCharts = (currentFilters = filters) => {
    const { projectId } = params;

    if (!currentFilters || !currentFilters[projectId]) {
      dispatch(getProjectCharts({ project_id: projectId }));
      setFilterLoading(false);
      return Promise.resolve("done");
    }

    const refreshPromises = [];
    const queries = [];
    for (let i = 0; i < charts.length; i++) {
      if (currentFilters && currentFilters[projectId]) {
        setFilterLoading(true);
        // first, discard the charts on which the filters don't apply
        if (_chartHasFilter(charts[i])) {
          refreshPromises.push(
            dispatch(runQueryWithFilters({
              project_id: projectId,
              chart_id: charts[i].id,
              filters: currentFilters[projectId]
            }))
          );
        }

        if (currentFilters?.[projectId]?.length > 0
          && currentFilters?.[projectId]?.find((o) => o.type === "date")
          && filterGroups?.[projectId]?.find((c) => c === charts[i].id)
        ) {
          queries.push({
            projectId,
            chartId: charts[i].id,
            dateFilter: currentFilters?.[projectId]?.find((o) => o.type === "date"),
          });
        }
      }
    }

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

  const _onRefreshData = () => {
    const { projectId } = params;

    const queries = [];
    setRefreshLoading(true);
    for (let i = 0; i < charts.length; i++) {
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
        if (filters && filters[projectId]
          && filters[projectId].length > 0
          && filters[projectId].find((o) => o.type !== "date")
        ) {
          _onFilterCharts()
            .then(() => {
              _checkVariablesForFilters(variables[params.projectId]);
            });
        }
        setRefreshLoading(false);
      })
      .catch(() => {
        setRefreshLoading(false);
      });
  };

  const _chartHasFilter = (chart) => {
    let found = false;
    if (chart.ChartDatasetConfigs) {
      chart.ChartDatasetConfigs.forEach((cdc) => {
        if (cdc.Dataset?.fieldsSchema) {
          Object.keys(cdc.Dataset.fieldsSchema).forEach((key) => {
            if (_.find(filters[params.projectId], (o) => o.field === key)) {
              found = true;
            }
          });
        }
      });
    }

    return found;
  };

  const _getOperator = (operator) => {
    const found = _.find(operators, (o) => o.value === operator);
    return (found && found.key) || "";
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

  const _onChangeLayout = (layout, allLayouts) => {
    const updatedCharts = charts.map(chart => {
      const updatedLayout = {};

      Object.keys(allLayouts).forEach(breakpoint => {
        const layoutItem = allLayouts[breakpoint].find(item => item.i === chart.id.toString());
        if (layoutItem || layoutItem === 0) {
          updatedLayout[breakpoint] = [layoutItem.x, layoutItem.y, layoutItem.w, layoutItem.h];
        }
      });

      return { ...chart, layout: updatedLayout };
    });

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

    setLayouts(allLayouts);    
  };

  const _onGetChartHeight = (chart) => {
    const currentBreakpoint = Object.keys(layouts).find(breakpoint => {
      return layouts[breakpoint].find(item => item.i === chart.id.toString());
    });

    if (currentBreakpoint) {
      const layoutItem = layouts[currentBreakpoint].find(item => item.i === chart.id.toString());
      return layoutItem.h * 150;
    }

    return 150;
  };

  return (
    <div className="w-full">
      {charts && charts.length > 0
        && (
          <div>
            <div
              className={"bg-content1 w-full border-b-1 border-solid border-content3"}
              size="xl"
              style={mobile ? styles.actionBarMobile : styles.actionBar}
            >
              <Row justify="space-between" align="center" className={"w-full"}>
                <Row justify="flex-start" align="center">
                  {projectMembers?.length > 0 && (
                    <>
                      <div className="hidden sm:flex sm:flex-row border-r-1 border-solid border-content3">
                        <Popover>
                          <PopoverTrigger>
                            <AvatarGroup max={3} isBordered size="sm" className="cursor-pointer">
                              {projectMembers.map((member) => (
                                <Avatar
                                  key={member.id}
                                  name={member.name}
                                  showFallback={<LuUser />}
                                />
                              ))}
                            </AvatarGroup>
                          </PopoverTrigger>
                          <PopoverContent className="pt-4">
                            {_canAccess("teamAdmin") && (
                              <div className="w-full">
                                <Button
                                  endContent={<LuUsers2 />}
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
                            <Listbox>
                              {projectMembers.map((member) => (
                                <ListboxItem
                                  key={member.id}
                                  textValue={member.name}
                                  description={member.email}
                                  endContent={(
                                    <Chip size="sm">
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
                        <Spacer x={2} />
                      </div>
                      <Spacer x={2} />
                    </>
                  )}
                  <Button
                    variant="ghost"
                    startContent={<LuListFilter />}
                    isLoading={filterLoading}
                    onClick={_onShowFilters}
                    size="sm"
                    className="hidden sm:flex"
                  >
                    {"Add filter"}
                  </Button>
                  <Button
                    isIconOnly
                    onClick={_onShowFilters}
                    isLoading={filterLoading}
                    variant="ghost"
                    size="sm"
                    className="flex sm:hidden"
                  >
                    <LuListFilter size={24} />
                  </Button>
                  <Spacer x={1} />
                  <div style={mobile ? {} : { paddingLeft: 10 }} className="hidden sm:flex-row sm:flex gap-1">
                    <>
                      {filters
                        && filters[params.projectId]
                        && filters[params.projectId].map((filter) => (
                          <Fragment key={filter.id}>
                            {filter.type === "date" && (
                              <Chip
                                color="primary"
                                variant={"faded"}
                                radius="sm"
                                endContent={(
                                  <LinkNext onClick={() => _onRemoveFilter(filter.id)} className="text-default-500">
                                    <LuXCircle />
                                  </LinkNext>
                                )}
                              >
                                {`${moment.utc(filter.startDate).format("YYYY/MM/DD")} - ${moment.utc(filter.endDate).format("YYYY/MM/DD")}`}
                              </Chip>
                            )}
                            {filter.type !== "date" && filter.field && (
                              <Chip
                                color="primary"
                                variant={"flat"}
                                radius="sm"
                                endContent={(
                                  <LinkNext onClick={() => _onRemoveFilter(filter.id)} className="text-default">
                                    <LuXCircle />
                                  </LinkNext>
                                )}
                              >
                                <span>{`${filter.field.substring(filter.field.lastIndexOf(".") + 1)}`}</span>
                                <strong>{` ${_getOperator(filter.operator)} `}</strong>
                                <span>{`${filter.value}`}</span>
                              </Chip>
                            )}
                          </Fragment>
                        ))}

                      {variables
                        && variables[params.projectId]
                        && variables[params.projectId].map((variable) => (
                          <Chip
                            color="primary"
                            variant={"faded"}
                            radius="sm"
                            endContent={(
                              <LinkNext onClick={() => _onRemoveVariable(variable.variable)} className="text-default-500">
                                <LuXCircle />
                              </LinkNext>
                            )}
                            key={variable.variable}
                            startContent={<LuVariable />}
                          >
                            {`${variable.variable} - ${variable.value}`}
                          </Chip>
                        ))}
                    </>
                  </div>
                </Row>
                <Row justify="flex-end" align="center">
                  {_canAccess("teamAdmin") && (
                    <>
                      <Tooltip content="Create a template from this dashboard" placement="bottom">
                        <Button
                          variant="light"
                          isIconOnly
                          onClick={() => setTemplateVisible(true)}
                          size="sm"
                          className="dashboard-template-tutorial"
                        >
                          <LuCopyPlus size={22} />
                        </Button>
                      </Tooltip>
                    </>
                  )}
                  {_canExport() && (
                    <>
                      <Spacer x={0.5} />
                      <Tooltip content="Export charts to Excel" placement="bottom">
                        <Button
                          variant="light"
                          isIconOnly
                          onClick={_openExport}
                          className="dashboard-export-tutorial"
                          size="sm"
                        >
                          <LuFileDown size={22} />
                        </Button>
                      </Tooltip>
                    </>
                  )}
                  {!mobile && (
                    <>
                      <Spacer x={0.5} />
                      <Tooltip content="Edit dashboard layout" placement="bottom-end">
                        <Button
                          variant="light"
                          isIconOnly
                          onClick={() => setEditingLayout(!editingLayout)}
                          color={editingLayout ? "primary" : "default"}
                          size="sm"
                          className="dashboard-layout-tutorial"
                        >
                          <LuLayoutDashboard size={22} />
                        </Button>
                      </Tooltip>
                    </>
                  )}

                  <>
                    <Spacer x={2} />
                    <Tooltip content="Refresh data" placement="bottom-start">
                      <Button
                        variant="ghost"
                        onClick={() => _onRefreshData()}
                        isLoading={refreshLoading}
                        size="sm"
                        endContent={<LuRefreshCw />}
                        className="hidden sm:flex"
                      >
                        Refresh charts
                      </Button>
                    </Tooltip>
                    <Tooltip content="Refresh all charts" placement="bottom-end">
                      <Button
                        variant="ghost"
                        isIconOnly
                        onClick={() => _onRefreshData()}
                        isLoading={refreshLoading}
                        size="sm"
                        className="flex sm:hidden"
                      >
                        <LuRefreshCw size={24} />
                      </Button>
                    </Tooltip>
                  </>
                </Row>
              </Row>
            </div>
          </div>
        )}
      <div className="bg-content2 w-full" style={styles.container(width < breakpoints.tablet)}>
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
                    endContent={<LuPlusCircle size={24} />}
                    size="lg"
                    color="primary"
                    onClick={() => navigate(`/${params.teamId}/${params.projectId}/chart`)}
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
            margin={{ lg: [12, 12], md: [12, 12], sm: [12, 12], xs: [12, 12], xxs: [12, 12] }}
            breakpoints={gridBreakpoints}
            cols={{ lg: 12, md: 10, sm: 8, xs: 6, xxs: 4 }}
            rowHeight={150}
            onLayoutChange={_onChangeLayout}
            resizeHandle={(
              <div className="react-resizable-handle react-resizable-handle-se">
                <TbChevronDownRight className="text-primary" size={20} />
              </div>
            )}
            isDraggable={editingLayout}
            isResizable={editingLayout}
          >
            {charts.map((chart, index) => (
              <div key={chart.id} className={editingLayout ? "border-2 border-dashed border-primary rounded-2xl" : ""}>
                <Chart
                  key={chart.id}
                  chart={chart}
                  charts={charts}
                  onChangeOrder={(chartId, type) => _onChangeOrder(chartId, type, index)}
                  height={() => _onGetChartHeight(chart)}
                  editingLayout={editingLayout}
                  onEditLayout={() => setEditingLayout(!editingLayout)}
                />
              </div>
            ))}
          </ResponsiveGridLayout>
        )}
      </div>
      
      <Filters
        charts={charts}
        projectId={params.projectId}
        onAddFilter={_onAddFilter}
        open={showFilters}
        onClose={() => setShowFilters(false)}
        filterGroups={filterGroups?.[params?.projectId] || []}
        onEditFilterGroup={_onEditFilterGroup}
        onAddVariableFilter={_onAddVariableFilter}
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

      <CreateTemplateForm
        teamId={params.teamId}
        projectId={params.projectId}
        onClose={(isComplete) => {
          if (isComplete) toast.success("✨ The template was saved successfully");
          setTemplateVisible(false);
        }}
        visible={templateVisible}
      />

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
        theme={isDark ? "dark" : "light"}
      />
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
  cleanErrors: PropTypes.func.isRequired,
  onPrint: PropTypes.func.isRequired,
  mobile: PropTypes.bool,
};

const mapStateToProps = () => {
  return {
  };
};

const mapDispatchToProps = (dispatch) => {
  return {
    cleanErrors: () => dispatch(cleanErrorsAction()),
  };
};

export default connect(mapStateToProps, mapDispatchToProps)(ProjectDashboard);
