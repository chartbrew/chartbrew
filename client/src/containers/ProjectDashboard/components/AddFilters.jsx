import React, { useState } from "react";
import PropTypes from "prop-types";
import { v4 as uuid } from "uuid";
import {
  Button, Separator, Drawer, Label, ListBox, Select,
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
        startDate: filter.startDate,
        endDate: filter.endDate,
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
    <Drawer
      isOpen={open}
      onOpenChange={(isOpen) => {
        if (!isOpen) onClose();
      }}
    >
      <Drawer.Backdrop />
      <Drawer.Content
        placement="left"
        className="dashboard-filters-modal max-w-2xl"
      >
        <Drawer.Dialog>
        <Drawer.Header>
          <span className="font-bold text-lg">Add dashboard filter</span>
        </Drawer.Header>
        <Drawer.Body>
          <Select
            variant="secondary"
            selectionMode="single"
            value={filterType}
            onChange={(value) => setFilterType(value)}
          >
            <Label>Select a filter type</Label>
            <Select.Trigger>
              <Select.Value />
              <Select.Indicator />
            </Select.Trigger>
            <Select.Popover>
              <ListBox>
                <ListBox.Item id="date" textValue="Date">
                  <div className="flex flex-row items-start gap-2">
                    <LuCalendarDays className="mt-0.5" />
                    <div className="flex flex-col">
                      <span>Date range</span>
                      <span className="text-xs text-foreground-500">A filter that targets dataset date fields and {"{{start_date}}"} and {"{{end_date}}"} variables</span>
                    </div>
                  </div>
                  <ListBox.ItemIndicator />
                </ListBox.Item>
                <ListBox.Item id="variables" textValue="Variables">
                  <div className="flex flex-row items-start gap-2">
                    <LuVariable className="mt-0.5" />
                    <div className="flex flex-col">
                      <span>Variables</span>
                      <span className="text-xs text-foreground-500">A filter that targets dataset variables</span>
                    </div>
                  </div>
                  <ListBox.ItemIndicator />
                </ListBox.Item>
                <ListBox.Item id="field" textValue="Matching field">
                  <div className="flex flex-row items-start gap-2">
                    <LuListTree className="mt-0.5" />
                    <div className="flex flex-col">
                      <span>Matching field</span>
                      <span className="text-xs text-foreground-500">A filter that applies to all datasets that contain a specific field</span>
                    </div>
                  </div>
                  <ListBox.ItemIndicator />
                </ListBox.Item>
              </ListBox>
            </Select.Popover>
          </Select>

          <Separator />

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
        </Drawer.Body>
        <Drawer.Footer>
          <Button onPress={onClose} variant="secondary">
            Close
          </Button>
          {filterType === "date" && (
            <Button variant="primary" onPress={_onApplyFilter}>
              Add filter
            </Button>
          )}
          {filterType === "variables" && (
            <Button
              isDisabled={!variableCondition.variable}
              onPress={_onAddVariableFilter}
              variant="primary"
            >
              Add filter
              <LuPlus />
            </Button>
          )}
          {filterType === "field" && (
            <Button
              onPress={_onAddFilter}
              variant="primary"
              isDisabled={!filter.field}
            >
              Add filter
              <LuPlus />
            </Button>
          )}
        </Drawer.Footer>
        </Drawer.Dialog>
      </Drawer.Content>
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
