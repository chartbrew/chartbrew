import React from "react"
import PropTypes from "prop-types"
import { Chip, Link as LinkNext } from "@heroui/react"
import { LuCircleX, LuVariable } from "react-icons/lu"
import moment from "moment"
import { operators } from "../../../modules/filterOperations"

function DashboardFilters({ 
  filters, 
  projectId, 
  onRemoveFilter
}) {
  const _getOperator = (operator) => {
    const found = operators.find((o) => o.value === operator)
    return (found && found.key) || ""
  }

  const projectFilters = filters?.[projectId] || []

  return (
    <div className="hidden sm:flex-row sm:flex gap-1">
      {projectFilters.map((filter) => (
        <React.Fragment key={filter.id}>
          {filter.type === "date" && (
            <Chip
              color="primary"
              variant={"flat"}
              radius="sm"
              endContent={(
                <LinkNext onPress={() => onRemoveFilter(filter.id)} className="text-default-500">
                  <LuCircleX />
                </LinkNext>
              )}
            >
              {`${moment.utc(filter.startDate).format("YYYY/MM/DD")} - ${moment.utc(filter.endDate).format("YYYY/MM/DD")}`}
            </Chip>
          )}
          {filter.type === "field" && filter.field && (
            <Chip
              color="primary"
              variant={"flat"}
              radius="sm"
              endContent={(
                <LinkNext onPress={() => onRemoveFilter(filter.id)} className="text-default">
                  <LuCircleX />
                </LinkNext>
              )}
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
              endContent={(
                <LinkNext onPress={() => onRemoveFilter(filter.id)} className="text-default-500">
                  <LuCircleX />
                </LinkNext>
              )}
              startContent={<LuVariable />}
            >
              {`${filter.variable} - ${filter.value}`}
            </Chip>
          )}
        </React.Fragment>
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
