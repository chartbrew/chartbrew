import React from "react"
import PropTypes from "prop-types"
import { Chip, Dropdown, DropdownItem, DropdownMenu, DropdownTrigger } from "@heroui/react"
import { LuCircleX, LuEllipsisVertical, LuPencil, LuTvMinimal, LuUsers } from "react-icons/lu"
import moment from "moment"
import { operators } from "../../../modules/filterOperations"
import VariableFilter from "./VariableFilter"

function DashboardFilters({ 
  filters, 
  projectId, 
  onRemoveFilter,
  onApplyFilterValue,
}) {
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

  return (
    <div className="hidden sm:flex sm:flex-row sm:gap-1">
      <div className="flex flex-row gap-1 min-w-min">
        {projectFilters.map((filter) => (
          <div className="flex flex-row gap-1 items-center" key={filter.id}>
            <div className="cursor-pointer flex flex-row gap-1 items-center">
              {filter.type === "date" && (
                <Chip
                  color="primary"
                  variant={"flat"}
                  radius="sm"
                  size="sm"
                >
                  {`${moment.utc(filter.startDate).format("YYYY/MM/DD")} - ${moment.utc(filter.endDate).format("YYYY/MM/DD")}`}
                </Chip>
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
                <DropdownItem onPress={() => { }} startContent={<LuPencil />}>
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
          </div>
        ))}
      </div>
    </div>
  )
}

DashboardFilters.propTypes = {
  filters: PropTypes.object,
  projectId: PropTypes.string.isRequired,
  onRemoveFilter: PropTypes.func.isRequired,
  onApplyFilterValue: PropTypes.func.isRequired,
}

export default DashboardFilters
