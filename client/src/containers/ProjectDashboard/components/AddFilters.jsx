import React, { useState } from "react";
import PropTypes from "prop-types";
import moment from "moment";
import { v4 as uuid } from "uuid";
import {
  Button, Divider, Drawer, DrawerFooter,
  DrawerContent, DrawerHeader, DrawerBody, Select, SelectItem,
} from "@heroui/react";
import { LuCalendarDays, LuListTree, LuPlus, LuVariable } from "react-icons/lu";
import { toast } from "react-hot-toast";

import { useSelector } from "react-redux";
import { selectProject } from "../../../slices/project";
import EditDateRangeFilter from "./EditDateRangeFilter";
import EditVariableFilter from "./EditVariableFilter";
import EditFieldFilter from "./EditFieldFilter";

function AddFilters(props) {
  const {
    charts, projectId, onAddFilter, open, onClose, onAddVariableFilter, filters,
  } = props;

  const [filter, setFilter] = useState({
    id: uuid(),
    field: "",
    operator: "is",
    value: "",
    projectId,
  });
  const [filterType, setFilterType] = useState("date");
  const [initSelectionRange] = useState({
    startDate: moment().startOf("month").toISOString(),
    endDate: moment().endOf("month").toISOString(),
    key: "selection",
  });
  const [dateRange] = useState(initSelectionRange);
  const [variableCondition, setVariableCondition] = useState({
    variable: "", 
    value: "",
    dataType: "text",
    label: "",
    allowValueChange: false,
  });

  const project = useSelector(selectProject);

  const _handleFilterChange = (newFilter) => {
    setFilter(newFilter);
  };

  const _onAddFilter = () => {
    if (!filter.value && filter.value !== false) return;
    onAddFilter({ ...filter, type: "field" });
    setFilter({
      id: uuid(),
      field: "",
      operator: "is",
      value: "",
      projectId,
    });
  };

  const _onApplyFilter = () => {
    if (filterType === "date") {
      onAddFilter({
        id: uuid(),
        startDate: dateRange.startDate,
        endDate: dateRange.endDate,
        type: "date",
        charts: filter.charts || [],
      });
    } else if (filterType === "field") {
      _onAddFilter();
    }
  };

  const _onAddVariableFilter = () => {
    // Check if a filter for this variable already exists
    const existingVariableFilter = filters?.[projectId]?.find(
      f => f.type === "variable" && f.variable === variableCondition.variable
    );

    if (existingVariableFilter) {
      toast.error("A filter for this variable already exists");
      return;
    }

    onAddVariableFilter(variableCondition);
    setVariableCondition({
      variable: "",
      value: "",
      dataType: "text",
      label: "",
      allowValueChange: false,
    });
  };

  if (!open) return null;

  return (
    <Drawer isOpen={open} onClose={onClose} closeButton size="2xl" placement="left" className="dashboard-filters-modal">
      <DrawerContent className="pt-[3rem]">
        <DrawerHeader>
          <span className="font-bold text-lg">Add dashboard filter</span>
        </DrawerHeader>
        <DrawerBody>
          <Select
            label="Select a filter type"
            variant="bordered"
            selectedKeys={[filterType]}
            onSelectionChange={(keys) => setFilterType(keys.currentKey)}
          >
            <SelectItem
              key="date"
              textValue="Date"
              startContent={<LuCalendarDays />}
              description="A filter that targets dataset date fields and {{start_date}} and {{end_date}} variables"
            >
              Date range
            </SelectItem>
            <SelectItem
              key="variables"
              textValue="Variables"
              startContent={<LuVariable />}
              description="A filter that targets dataset variables"
            >
              Variables
            </SelectItem>
            <SelectItem
              key="field"
              textValue="Matching field"
              startContent={<LuListTree />}
              description="A filter that applies to all datasets that contain a specific field"
            >
              Matching field
            </SelectItem>
          </Select>

          <Divider />

          {filterType === "date" && (
            <EditDateRangeFilter
              charts={charts}
              filter={filter}
              onChange={_handleFilterChange}
            />
          )}

          {filterType === "variables" && (
            <EditVariableFilter
              filter={variableCondition}
              onChange={(newFilter) => setVariableCondition(newFilter)}
              project={project}
            />
          )}

          {filterType === "field" && (
            <EditFieldFilter
              filter={filter}
              onChange={_handleFilterChange}
            />
          )}
        </DrawerBody>
        <DrawerFooter>
          <Button auto onPress={onClose} variant="bordered">
            Close
          </Button>
          {filterType === "date" && (
            <Button color="primary" onPress={_onApplyFilter}>
              Add filter
            </Button>
          )}
          {filterType === "variables" && (
            <Button
              endContent={<LuPlus />}
              isDisabled={!variableCondition.variable}
              onPress={_onAddVariableFilter}
              color="primary"
            >
              Add filter
            </Button>
          )}
          {filterType === "field" && (
            <Button
              endContent={<LuPlus />}
              onPress={_onAddFilter}
              color="primary"
              isDisabled={!filter.field}
            >
              Add filter
            </Button>
          )}
        </DrawerFooter>
      </DrawerContent>
    </Drawer>
  );
}

AddFilters.propTypes = {
  charts: PropTypes.array.isRequired,
  projectId: PropTypes.number.isRequired,
  onAddFilter: PropTypes.func.isRequired,
  open: PropTypes.bool.isRequired,
  onClose: PropTypes.func.isRequired,
  onAddVariableFilter: PropTypes.func.isRequired,
  filters: PropTypes.object,
};

export default AddFilters;
