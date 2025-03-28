import React from "react"
import PropTypes from "prop-types"
import { Chip, Dropdown, DropdownItem, DropdownMenu, DropdownTrigger } from "@heroui/react"
import { LuCircleX, LuPencil, LuTvMinimal, LuUsers, LuVariable } from "react-icons/lu"
import moment from "moment"
import { operators } from "../../../modules/filterOperations"

function DashboardFilters({ 
  filters, 
  projectId, 
  onRemoveFilter
}) {
  const _getOperator = (operator) => {
    const found = operators.find((o) => o.value === operator)
    return (found && found.key) || "";
  }

  const projectFilters = filters?.[projectId] || []

  return (
    <div className="hidden sm:flex-row sm:flex gap-1">
      {projectFilters.map((filter) => (
        <Dropdown key={filter.id} size="sm">
          <DropdownTrigger>
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
                <Chip
                  color="primary"
                  variant={"flat"}
                  radius="sm"
                  size="sm"
                  startContent={<LuVariable />}
                >
                  {`${filter.variable} - ${filter.value}`}
                </Chip>
              )}
            </div>
          </DropdownTrigger>
          <DropdownMenu variant="flat">
            <DropdownItem onPress={() => {}} startContent={<LuPencil />}>
              Edit filter
            </DropdownItem>
            <DropdownItem onPress={() => {}} startContent={<LuUsers />}>
              Save for everyone
            </DropdownItem>
            <DropdownItem onPress={() => {}} startContent={<LuTvMinimal />} showDivider>
              Show on report
            </DropdownItem>
            <DropdownItem onPress={() => onRemoveFilter(filter.id)} startContent={<LuCircleX className="text-danger" />} color="danger">
              Remove filter
            </DropdownItem>
          </DropdownMenu>
        </Dropdown>
      ))}
    </div>
  )
}

DashboardFilters.propTypes = {
  filters: PropTypes.object,
  projectId: PropTypes.string.isRequired,
  onRemoveFilter: PropTypes.func.isRequired
}

export default DashboardFilters
