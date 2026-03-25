import React, { useState } from "react"
import PropTypes from "prop-types"
import { Dropdown, Modal, Button } from "@heroui/react"
import { LuCircleMinus, LuCircleX, LuEllipsisVertical, LuIterationCw, LuPencil, LuTvMinimal, LuUsers } from "react-icons/lu"
import { useDispatch, useSelector } from "react-redux"
import toast from "react-hot-toast"

import VariableFilter from "./VariableFilter"
import DateRangeFilter from "./DateRangeFilter"
import EditDateRangeFilter from "./EditDateRangeFilter"
import EditVariableFilter from "./EditVariableFilter"
import EditFieldFilter from "./EditFieldFilter"
import FieldFilter from "./FieldFilter"
import { selectCharts } from "../../../slices/chart"
import { createDashboardFilter, deleteDashboardFilter, selectProject, updateDashboardFilter } from "../../../slices/project"
import canAccess from "../../../config/canAccess"
import { selectUser } from "../../../slices/user"
import { selectTeam } from "../../../slices/team"

function DashboardFilters({ 
  filters,
  projectId, 
  onRemoveFilter,
  onApplyFilterValue,
  onReport = false,
}) {
  const [editingFilter, setEditingFilter] = useState(null);
  const [filterToRemove, setFilterToRemove] = useState(null);

  const charts = useSelector(selectCharts);
  const user = useSelector(selectUser);
  const team = useSelector(selectTeam);
  const project = useSelector(selectProject);
  const dashboardFilters = project?.DashboardFilters || [];
  const projectFilters = filters?.[projectId] || []

  const dispatch = useDispatch();

  const _onApplyFilterValue = (filter, value) => {
    if (onReport) {
      onApplyFilterValue({ [projectId]: [{ ...filter, value }] });
      return;
    }

    const storedFilters = JSON.parse(window.localStorage.getItem("_cb_filters") || "{}");
    const projectFilters = storedFilters[projectId] || [];
    
    const updatedFilters = projectFilters.map((f) => {
      if (f.id === filter.id) {
        return { ...f, value };
      }
      return f;
    });

    storedFilters[projectId] = updatedFilters;
    window.localStorage.setItem("_cb_filters", JSON.stringify(storedFilters));

    onApplyFilterValue(storedFilters);
  }

  const _handleDateRangeChange = (filter, dateRange) => {
    const updatedFilter = {
      ...filter,
      ...dateRange,
    };

    const updatedFilters = {
      ...filters,
      [projectId]: filters[projectId].map(f => 
        f.id === updatedFilter.id ? updatedFilter : f
      ),
    };

    if (!onReport) {
      window.localStorage.setItem("_cb_filters", JSON.stringify(updatedFilters));
    }
    onApplyFilterValue(updatedFilters);
  }

  const _handleFieldFilterChange = (newFilter) => {
    const updatedFilters = {
      ...filters,
      [projectId]: filters[projectId].map(f => 
        f.id === newFilter.id ? newFilter : f
      ),
    };

    if (!onReport) {
      window.localStorage.setItem("_cb_filters", JSON.stringify(updatedFilters));
    }
    onApplyFilterValue(updatedFilters);
  };

  const _handleEditFilter = (filter) => {
    setEditingFilter(filter);
  }

  const _handleSaveFilter = () => {
    if (!editingFilter) return;

    const updatedFilters = {
      ...filters,
      [projectId]: filters[projectId].map(f => 
        f.id === editingFilter.id ? editingFilter : f
      ),
    };

    if (!onReport) {
      window.localStorage.setItem("_cb_filters", JSON.stringify(updatedFilters));
    }

    onApplyFilterValue(updatedFilters);
    setEditingFilter(null);
  }

  const _handleFilterChange = (newFilter) => {
    setEditingFilter(newFilter);
  };

  const _onClearFilterValue = (filter) => {
    const updatedFilters = {
      ...filters,
      [projectId]: filters[projectId].map(f => {
        if (f.type === "date") {
          return { ...f, startDate: "", endDate: "" };
        }
        return f.id === filter.id ? { ...f, value: "" } : f;
      }),
    };

    if (!onReport) {
      window.localStorage.setItem("_cb_filters", JSON.stringify(updatedFilters));
    }
    onApplyFilterValue(updatedFilters);
  }

  const _saveForEveryone = async (filter, onReport = false) => {
    const response = await dispatch(createDashboardFilter({
      project_id: projectId,
      configuration: filter,
      onReport,
      dashboard_filter_id: filter.id,
    }));

    if (response.error) {
      toast.error("Failed to save the filter for everyone. Please try again.");
    } else {
      toast.success("Filter saved for everyone successfully.");
    }
  };

  const _updateReportVisibility = async (filter, onReport) => {
    let response;
    if (dashboardFilters.findIndex(f => f.id === filter.id) === -1) {
      response = await _saveForEveryone(filter, onReport);
    } else {
      response = await dispatch(updateDashboardFilter({
        project_id: projectId,
        dashboard_filter_id: filter.id,
        data: { onReport },
      }));
    }

    if (response.error) {
      toast.error("Failed to update the filter. Please try again.");
    } else {
      toast.success("Filter updated successfully.");
    }
  };

  const _removeFromEveryone = async (filter) => {
    const response = await dispatch(deleteDashboardFilter({
      project_id: projectId,
      dashboard_filter_id: filter.id,
    }));

    if (response.error) {
      toast.error("Failed to remove the filter from everyone. Please try again.");
    } else {
      toast.success("Filter removed from everyone successfully.");
    }
  };

  const _getFieldOptions = () => {
    const tempFieldOptions = [];
    charts.map((chart) => {
      if (chart.ChartDatasetConfigs) {
        chart.ChartDatasetConfigs.forEach((cdc) => {
          if (cdc.Dataset?.fieldsSchema) {
            Object.keys(cdc.Dataset?.fieldsSchema).forEach((key) => {
              const type = cdc.Dataset?.fieldsSchema[key];
              if (tempFieldOptions.findIndex(f => f.key === key) !== -1) return;
              tempFieldOptions.push({
                key,
                text: key && key.replace("root[].", "").replace("root.", ""),
                value: key,
                type,
                chart_id: chart.id,
                label: {
                  content: type || "unknown",
                  color: type === "date" ? "warning"
                    : type === "number" ? "success"
                      : type === "string" ? "primary"
                        : type === "boolean" ? "warning"
                          : "neutral"
                },
              });
            });
          }
        });
      }
      return chart;
    });

    return tempFieldOptions;
  };

  const _getStateFilter = (filterId) => {
    return dashboardFilters.find(f => f.id === filterId);
  };

  const _onRevertToServerDefault = (filter) => {
    const stateFilter = _getStateFilter(filter.id);
    
    if (onReport) {
      onApplyFilterValue({ [projectId]: [{ ...stateFilter.configuration, id: filter.id, onReport: stateFilter.onReport }] });
      return;
    }

    const storedFilters = JSON.parse(window.localStorage.getItem("_cb_filters") || "{}");

    if (storedFilters[project.id]) {
      const filterIndex = storedFilters[project.id].findIndex(f => f.id === filter.id);
      if (filterIndex !== -1) {
        storedFilters[project.id][filterIndex] = {
          ...stateFilter.configuration,
          id: filter.id,
          onReport: stateFilter.onReport
        };
        window.localStorage.setItem("_cb_filters", JSON.stringify(storedFilters));
        onApplyFilterValue(storedFilters);
      }
    }
  }

  const _onRemoveFilter = (filterId, confirmed = false) => {
    if (_getStateFilter(filterId) && !confirmed) {
      setFilterToRemove(filterId);
      return;
    } else if (_getStateFilter(filterId) && confirmed) {
      _removeFromEveryone(filterId);
    }

    onRemoveFilter(filterId);
  }

  const _canAccess = (role) => {
    return canAccess(role, user.id, team.TeamRoles);
  };

  return (
    <>
      <div>
        <div className="flex flex-row flex-wrap gap-1 min-w-min">
          {projectFilters.map((filter) => (
            <div className="flex flex-row items-center" key={filter.id}>
              <div className="cursor-pointer flex flex-row gap-1 items-center">
                {filter.type === "date" && (
                  <DateRangeFilter
                    startDate={filter.startDate}
                    endDate={filter.endDate}
                    onChange={(dates) => _handleDateRangeChange(filter, dates)}
                  />
                )}
                {filter.type === "field" && filter.field && (
                  <FieldFilter filter={filter} onApply={(newFilter) => _handleFieldFilterChange(newFilter)} />
                )}
                {filter.type === "variable" && (
                  <VariableFilter
                    filter={filter}
                    onApply={(value) => _onApplyFilterValue(filter, value)}
                  />
                )}
              </div>
              {!onReport && (
                <Dropdown size="sm">
                  <Dropdown.Trigger>
                    <div className="cursor-pointer"><LuEllipsisVertical /></div>
                  </Dropdown.Trigger>
                  <Dropdown.Popover>
                    <Dropdown.Menu>
                      <Dropdown.Item id="edit-filter" onPress={() => _handleEditFilter(filter)} startContent={<LuPencil />} textValue="Edit filter">
                        Edit filter
                      </Dropdown.Item>
                      {_canAccess("projectEditor") && dashboardFilters.findIndex(f => f.id === filter.id) === -1 && (
                        <Dropdown.Item id="save-everyone" onPress={() => _saveForEveryone(filter)} startContent={<LuUsers />} textValue="Save for everyone">
                          Save for everyone
                        </Dropdown.Item>
                      )}
                      {_canAccess("projectEditor") && dashboardFilters.findIndex(f => f.id === filter.id) !== -1 && (
                        <Dropdown.Item id="remove-everyone" startContent={<LuUsers />} onPress={() => _removeFromEveryone(filter)} textValue="Remove from everyone">
                          Remove from everyone
                        </Dropdown.Item>
                      )}
                      {_canAccess("projectEditor") && _getStateFilter(filter.id)?.onReport && (
                        <Dropdown.Item id="hide-report" onPress={() => _updateReportVisibility(filter, false)} startContent={<LuTvMinimal />} textValue="Hide from report">
                          Hide from report
                        </Dropdown.Item>
                      )}
                      {_canAccess("projectEditor") && !_getStateFilter(filter.id)?.onReport && (
                        <Dropdown.Item id="show-report" onPress={() => _updateReportVisibility(filter, true)} startContent={<LuTvMinimal />} textValue="Show on report">
                          Show on report
                        </Dropdown.Item>
                      )}
                      {_getStateFilter(filter.id) && (
                        <Dropdown.Item id="revert-default" onPress={() => _onRevertToServerDefault(filter)} startContent={<LuIterationCw />} textValue="Revert to server default">
                          Revert to server default
                        </Dropdown.Item>
                      )}
                      <Dropdown.Item id="clear-value" onPress={() => _onClearFilterValue(filter)} startContent={<LuCircleMinus />} showDivider textValue="Clear filter value">
                        Clear filter value
                      </Dropdown.Item>
                      <Dropdown.Item id="remove-filter" onPress={() => _onRemoveFilter(filter.id)} startContent={<LuCircleX className="text-danger" />} variant="danger" textValue="Remove filter">
                        Remove filter
                      </Dropdown.Item>
                    </Dropdown.Menu>
                  </Dropdown.Popover>
                </Dropdown>
              )}
              <div className="w-2" />
            </div>
          ))}
        </div>
      </div>

      <Modal>
        <Modal.Backdrop isOpen={!!editingFilter} onOpenChange={(nextOpen) => { if (!nextOpen) setEditingFilter(null); }}>
          <Modal.Container>
            <Modal.Dialog className="sm:max-w-2xl">
              <Modal.Header>
            <span className="font-bold text-lg">Edit filter</span>
              </Modal.Header>
              <Modal.Body>
            {editingFilter && editingFilter.type === "date" && (
              <EditDateRangeFilter
                charts={charts.filter(c => c.type !== "markdown")}
                filter={editingFilter}
                onChange={_handleFilterChange}
              />
            )}
            {editingFilter && editingFilter.type === "variable" && (
              <EditVariableFilter
                filter={editingFilter}
                onChange={_handleFilterChange}
                project={project}
              />
            )}
            {editingFilter && editingFilter.type === "field" && (
              <EditFieldFilter
                filter={editingFilter}
                onChange={_handleFilterChange}
                fieldOptions={_getFieldOptions()}
              />
            )}
              </Modal.Body>
              <Modal.Footer>
            <Button variant="secondary" onPress={() => setEditingFilter(null)}>
              Cancel
            </Button>
            <Button variant="primary" onPress={_handleSaveFilter}>
              Save changes
            </Button>
              </Modal.Footer>
            </Modal.Dialog>
          </Modal.Container>
        </Modal.Backdrop>
      </Modal>

      <Modal>
        <Modal.Backdrop isOpen={!!filterToRemove} onOpenChange={(nextOpen) => { if (!nextOpen) setFilterToRemove(null); }}>
          <Modal.Container>
            <Modal.Dialog className="sm:max-w-2xl">
              <Modal.Header>
            <span className="font-bold">Remove filter</span>
              </Modal.Header>
              <Modal.Body>
            <p>{"Removing this filter will remove it from everyone's dashboard."}</p>
            <p>{"If you want to remove it from your dashboard only, you can clear the filter value instead."}</p>
              </Modal.Body>
              <Modal.Footer>
            <Button variant="secondary" onPress={() => setFilterToRemove(null)}>Cancel</Button>
            <Button variant="danger" onPress={() => _onRemoveFilter(filterToRemove, true)}>Remove from everyone</Button>
              </Modal.Footer>
            </Modal.Dialog>
          </Modal.Container>
        </Modal.Backdrop>
      </Modal>
    </>
  )
}

DashboardFilters.propTypes = {
  filters: PropTypes.object.isRequired,
  projectId: PropTypes.number.isRequired,
  onRemoveFilter: PropTypes.func.isRequired,
  onApplyFilterValue: PropTypes.func.isRequired,
  onReport: PropTypes.bool,
}

export default DashboardFilters
