import React, { useState } from "react"
import PropTypes from "prop-types"
import { Chip, Dropdown, DropdownItem, DropdownMenu, DropdownTrigger, Modal, ModalContent, ModalHeader, ModalBody, ModalFooter, Button, Spacer } from "@heroui/react"
import { LuCircleX, LuEllipsisVertical, LuPencil, LuTvMinimal, LuUsers } from "react-icons/lu"
import { operators } from "../../../modules/filterOperations"
import VariableFilter from "./VariableFilter"
import DateRangeFilter from "./DateRangeFilter"
import EditDateRangeFilter from "./EditDateRangeFilter"
import { selectCharts } from "../../../slices/chart"
import { useSelector } from "react-redux"

function DashboardFilters({ 
  filters, 
  projectId, 
  onRemoveFilter,
  onApplyFilterValue,
}) {
  const [editingFilter, setEditingFilter] = useState(null);

  const charts = useSelector(selectCharts);

  const _getOperator = (operator) => {
    const found = operators.find((o) => o.value === operator)
    return (found && found.key) || "";
  }

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
                  <Chip
                    color="primary"
                    variant={"flat"}
                    radius="sm"
                    size="sm"
                  >
                    <span>{`${filter.field.substring(filter.field.lastIndexOf(".") + 1)}`}</span>
                    <strong>{` ${_getOperator(filter.operator)} `}</strong>
                    <span>{`${filter.value}`}</span>
                  </Chip>
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
                  <DropdownItem onPress={() => { }} startContent={<LuTvMinimal />} showDivider>
                    Show on report
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
            {editingFilter && (
              <EditDateRangeFilter
                charts={charts.filter(c => c.type !== "markdown")}
                filter={editingFilter}
                onChange={_handleFilterChange}
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
