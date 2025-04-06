import React, { useState } from "react"
import PropTypes from "prop-types"
import { Dropdown, DropdownItem, DropdownMenu, DropdownTrigger, Modal, ModalContent, ModalHeader, ModalBody, ModalFooter, Button, Spacer } from "@heroui/react"
import { LuCircleMinus, LuCircleX, LuEllipsisVertical, LuPencil, LuTvMinimal, LuUsers } from "react-icons/lu"
import VariableFilter from "./VariableFilter"
import DateRangeFilter from "./DateRangeFilter"
import EditDateRangeFilter from "./EditDateRangeFilter"
import EditVariableFilter from "./EditVariableFilter"
import EditFieldFilter from "./EditFieldFilter"
import FieldFilter from "./FieldFilter"
import { selectCharts } from "../../../slices/chart"
import { selectProject } from "../../../slices/project"
import { useSelector } from "react-redux"

function DashboardFilters({ 
  filters, 
  projectId, 
  onRemoveFilter,
  onApplyFilterValue,
}) {
  const [editingFilter, setEditingFilter] = useState(null);

  const charts = useSelector(selectCharts);
  const project = useSelector(selectProject);

  const projectFilters = filters?.[projectId] || []

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
                  <DropdownItem onPress={() => { }} startContent={<LuUsers />}>
                    Save for everyone
                  </DropdownItem>
                  <DropdownItem onPress={() => { }} startContent={<LuTvMinimal />}>
                    Show on report
                  </DropdownItem>
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
