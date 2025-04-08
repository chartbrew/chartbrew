import React, { useState } from "react"
import PropTypes from "prop-types"
import { Dropdown, DropdownItem, DropdownMenu, DropdownTrigger, Modal, ModalContent, ModalHeader, ModalBody, ModalFooter, Button, Spacer } from "@heroui/react"
import { LuCircleMinus, LuCircleX, LuEllipsisVertical, LuIterationCw, LuPencil, LuTvMinimal, LuUsers } from "react-icons/lu"
import VariableFilter from "./VariableFilter"
import DateRangeFilter from "./DateRangeFilter"
import EditDateRangeFilter from "./EditDateRangeFilter"
import EditVariableFilter from "./EditVariableFilter"
import EditFieldFilter from "./EditFieldFilter"
import FieldFilter from "./FieldFilter"
import { selectCharts } from "../../../slices/chart"
import { createDashboardFilter, deleteDashboardFilter, selectProject, updateDashboardFilter } from "../../../slices/project"
import { useDispatch, useSelector } from "react-redux"
import toast from "react-hot-toast"
import canAccess from "../../../config/canAccess"
import { selectUser } from "../../../slices/user"
import { selectTeam } from "../../../slices/team"

function DashboardFilters({ 
  filters,
  projectId, 
  onRemoveFilter,
  onApplyFilterValue,
}) {
  const [editingFilter, setEditingFilter] = useState(null);

  const charts = useSelector(selectCharts);
  const user = useSelector(selectUser);
  const team = useSelector(selectTeam);
  const project = useSelector(selectProject);
  const dashboardFilters = project?.DashboardFilters || [];
  const projectFilters = filters?.[projectId] || []

  const dispatch = useDispatch();

  const _onApplyFilterValue = (filter, value) => {
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

    window.localStorage.setItem("_cb_filters", JSON.stringify(updatedFilters));
    onApplyFilterValue(updatedFilters);
  }

  const _handleFieldFilterChange = (newFilter) => {
    const updatedFilters = {
      ...filters,
      [projectId]: filters[projectId].map(f => 
        f.id === newFilter.id ? newFilter : f
      ),
    };

    window.localStorage.setItem("_cb_filters", JSON.stringify(updatedFilters));
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

    window.localStorage.setItem("_cb_filters", JSON.stringify(updatedFilters));
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
    window.localStorage.setItem("_cb_filters", JSON.stringify(updatedFilters));

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

  const _canAccess = (role) => {
    return canAccess(role, user.id, team.TeamRoles);
  };

  return (
    <>
      <div className="hidden sm:flex sm:flex-row sm:gap-1">
        <div className="flex flex-row gap-1 min-w-min">
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
              <Dropdown size="sm">
                <DropdownTrigger>
                  <div className="cursor-pointer"><LuEllipsisVertical /></div>
                </DropdownTrigger>
                <DropdownMenu variant="flat">
                  <DropdownItem onPress={() => _handleEditFilter(filter)} startContent={<LuPencil />}>
                    Edit filter
                  </DropdownItem>
                  {_canAccess("projectEditor") && dashboardFilters.findIndex(f => f.id === filter.id) === -1 && (
                    <DropdownItem onPress={() => _saveForEveryone(filter)} startContent={<LuUsers />}>
                      Save for everyone
                    </DropdownItem>
                  )}
                  {_canAccess("projectEditor") && dashboardFilters.findIndex(f => f.id === filter.id) !== -1 && (
                    <DropdownItem startContent={<LuUsers />} onPress={() => _removeFromEveryone(filter)}>
                      Remove from everyone
                    </DropdownItem>
                  )}
                  {_canAccess("projectEditor") && _getStateFilter(filter.id)?.onReport && (
                    <DropdownItem onPress={() => _updateReportVisibility(filter, false)} startContent={<LuTvMinimal />}>
                      Hide from report
                    </DropdownItem>
                  )}
                  {_canAccess("projectEditor") && !_getStateFilter(filter.id)?.onReport && (
                    <DropdownItem onPress={() => _updateReportVisibility(filter, true)} startContent={<LuTvMinimal />}>
                      Show on report
                    </DropdownItem>
                  )}
                  {_getStateFilter(filter.id) && (
                    <DropdownItem onPress={() => _onRevertToServerDefault(filter)} startContent={<LuIterationCw />}>
                      Revert to server default
                    </DropdownItem>
                  )}
                  <DropdownItem onPress={() => _onClearFilterValue(filter)} startContent={<LuCircleMinus />} showDivider>
                    Clear filter value
                  </DropdownItem>
                  <DropdownItem onPress={() => onRemoveFilter(filter.id)} startContent={<LuCircleX className="text-danger" />} color="danger">
                    Remove filter
                  </DropdownItem>
                </DropdownMenu>
              </Dropdown>
              <Spacer x={1} />
            </div>
          ))}
        </div>
      </div>

      <Modal isOpen={!!editingFilter} onClose={() => setEditingFilter(null)} size="2xl">
        <ModalContent>
          <ModalHeader>
            <span className="font-bold text-lg">Edit filter</span>
          </ModalHeader>
          <ModalBody>
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
          </ModalBody>
          <ModalFooter>
            <Button variant="bordered" onPress={() => setEditingFilter(null)}>
              Cancel
            </Button>
            <Button color="primary" onPress={_handleSaveFilter}>
              Save changes
            </Button>
          </ModalFooter>
        </ModalContent>
      </Modal>
    </>
  )
}

DashboardFilters.propTypes = {
  filters: PropTypes.object.isRequired,
  projectId: PropTypes.number.isRequired,
  onRemoveFilter: PropTypes.func.isRequired,
  onApplyFilterValue: PropTypes.func.isRequired,
}

export default DashboardFilters
