import React, { useState, useCallback } from "react";
import PropTypes from "prop-types";
import { Accordion, AccordionItem, Button, Chip, Divider, Dropdown, DropdownItem, DropdownMenu, DropdownTrigger, Link, Spacer } from "@heroui/react";
import { LuEye, LuEyeOff, LuReplaceAll, LuSettings, LuCircleX, LuChevronDown } from "react-icons/lu";
import { DndProvider } from "react-dnd";
import { HTML5Backend } from "react-dnd-html5-backend";
import update from "immutability-helper";
import { cloneDeep, indexOf } from "lodash";

import DraggableLabel from "../containers/AddChart/components/DraggableLabel";
import TableDataFormattingModal from "../containers/AddChart/components/TableDataFormattingModal";

function formatColumnsForOrdering(columns) {
  if (!columns) {
    return [];
  }
  return columns.map((column, index) => ({
    id: index,
    Header: column,
  }));
}

function TableConfiguration(props) {
  const { dataset, chartData, tableFields, onUpdate, loading } = props;

  const [isDragState, setIsDragState] = useState(false);
  const [fieldForFormatting, setFieldForFormatting] = useState("");
  const [fieldFormatConfig, setFieldFormatConfig] = useState(null);
  const [fieldFormatLoading, setFieldFormatLoading] = useState(false);
  const [tableColumns, setTableColumns] = useState([]);

  const _filterTableFields = () => {
    const filteredFields = [];
    tableFields.forEach((field) => {
      if (!dataset.excludedFields || !dataset.excludedFields.find((i) => i === field.accessor)) {
        filteredFields.push(field);
      }
    });

    return filteredFields;
  };

  const _onExcludeField = (field) => {
    const excludedFields = dataset.excludedFields || [];
    const newExcludedFields = [...excludedFields, field];
    onUpdate({ excludedFields: newExcludedFields });
  };

  const _onShowField = (field) => {
    const excludedFields = cloneDeep(dataset.excludedFields) || [];
    const index = indexOf(excludedFields, field);
    excludedFields.splice(index, 1);
    onUpdate({ excludedFields });
  };

  const _onDragStateClicked = () => {
    setIsDragState(!isDragState);

    const columnsForOrdering = [];
    if (!isDragState && (!dataset.columnsOrder || dataset.columnsOrder.length === 0)) {
      const datasetData = chartData[dataset.legend];
      if (datasetData && datasetData.columns) {
        datasetData.columns.forEach((field, index) => {
          if (field && field.Header && field.Header.indexOf("__cb_group") === -1) {
            columnsForOrdering.push({
              Header: field.Header,
              id: index,
            });
          }
        });
      }

      setTableColumns(columnsForOrdering);
    } else {
      const notFoundColumns = [];
      const datasetData = chartData[dataset.legend];
      if (datasetData && datasetData.columns) {
        datasetData.columns.forEach((field) => {
          if (!dataset.columnsOrder.find((column) => column === field.Header)) {
            notFoundColumns.push(field.Header);
          }
        });
      }

      setTableColumns(formatColumnsForOrdering(dataset.columnsOrder.concat(notFoundColumns)));
    }
  };

  const _onMoveLabel = useCallback((dragIndex, hoverIndex) => {
    setTableColumns((prevColumns) => update(prevColumns, {
      $splice: [
        [dragIndex, 1],
        [hoverIndex, 0, prevColumns[dragIndex]],
      ],
    }),);
  }, []);

  const _onConfirmColumnOrder = () => {
    const newColumnsOrder = [];
    tableColumns.forEach((column) => {
      newColumnsOrder.push(column.Header);
    });
    onUpdate({ columnsOrder: newColumnsOrder });
  };

  const _onCancelColumnOrder = () => {
    setIsDragState(false);
    setTableColumns(formatColumnsForOrdering(dataset.columnsOrder));
  };

  const _onSelectFieldForFormatting = (field) => {
    if (dataset?.configuration?.columnsFormatting?.[field]) {
      setFieldFormatConfig(dataset.configuration.columnsFormatting[field]);
    }

    setFieldForFormatting(field);
  };

  const _onUpdateFieldFormatting = async (config) => {
    let newConfiguration = JSON.parse(JSON.stringify(dataset.configuration));
    if (!newConfiguration) {
      newConfiguration = {};
    }

    if (!newConfiguration?.columnsFormatting) {
      newConfiguration.columnsFormatting = {};
    }

    newConfiguration.columnsFormatting[fieldForFormatting] = config;

    setFieldFormatLoading(true);
    await onUpdate({ configuration: newConfiguration });

    setFieldFormatLoading(false);
    setFieldForFormatting("");
    setFieldFormatConfig(null);
  };

  return (
    <div>
      <Accordion fullWidth variant="bordered" aria-label="Table columns options" defaultExpandedKeys={["table-columns-options"]}>
        <AccordionItem key="table-columns-options" subtitle="Table columns options" className="text-default" indicator={<LuSettings />}>
          <div>
            {!isDragState && (
              <div className="flex flex-wrap gap-2">
                {_filterTableFields().map((field) => {
                  if (!field || !field.accessor || field.Header.indexOf("__cb_group") > -1) return (<span key={field.accessor} />);
                  return (
                    <Chip
                      radius="sm"
                      key={field.accessor}
                      color="primary"
                      endContent={
                        <Dropdown aria-label="Select a data formatting option" size="sm">
                          <DropdownTrigger>
                            <Link
                              className="flex items-center text-background cursor-pointer"
                              title="Field options"
                            >
                              <LuChevronDown className="text-background cursor-pointer" size={16} />
                            </Link>
                          </DropdownTrigger>
                          <DropdownMenu variant="flat">
                            <DropdownItem
                              startContent={<LuSettings />}
                              textValue="Column formatting"
                              onPress={() => _onSelectFieldForFormatting(field.accessor)}
                            >
                              Column formatting
                            </DropdownItem>
                            <DropdownItem
                              startContent={<LuEyeOff />}
                              textValue="Hide field"
                              onPress={() => _onExcludeField(field.accessor)}
                            >
                              Hide field
                            </DropdownItem>
                          </DropdownMenu>
                        </Dropdown>
                      }
                    >
                      {`${field.accessor.replace("?", ".")}`}
                    </Chip>
                  );
                })}
              </div>
            )}

            {isDragState && tableColumns.length > 0 && (
              <DndProvider backend={HTML5Backend} key={1} context={window}>
                <div className="flex flex-wrap gap-2">
                  {tableColumns.map((field, index) => {
                    // check if the field is found in the excluded fields
                    if (dataset.excludedFields
                      && dataset.excludedFields.find((i) => i === field.Header)
                    ) {
                      return (<span key={field.Header} />);
                    }

                    return (
                      <DraggableLabel
                        key={field.Header}
                        field={field}
                        index={index}
                        onMove={_onMoveLabel}
                      />
                    );
                  })}
                </div>
              </DndProvider>
            )}

            {!isDragState
              && dataset.excludedFields
              && dataset.excludedFields.length > 0
              && (
                <Spacer y={1} />
              )}

            {dataset.excludedFields && dataset.excludedFields?.length > 0 && (
              <div className="text-gray-500 text-sm py-2">
                Hidden fields
              </div>
            )}
            <div className="flex flex-wrap gap-2 items-center">
              {!isDragState
                && dataset.excludedFields
                && dataset.excludedFields?.map((field) => (
                  <Chip
                    radius="sm"
                    key={field}
                    onClick={() => _onShowField(field)}
                    variant="flat"
                    startContent={(
                      <Link className="flex items-center" onPress={() => _onShowField(field)}>
                        <LuEye className="text-gray-500 cursor-pointer" size={16} />
                      </Link>
                    )}
                  >
                    {field.replace("?", ".")}
                  </Chip>
                ))}
            </div>
            <Spacer y={2} />
            <Divider />
            <Spacer y={2} />
            <div className="flex flex-row">
              <Button
                color={isDragState ? "success" : "primary"}
                variant="faded"
                onPress={isDragState ? _onConfirmColumnOrder : _onDragStateClicked}
                isLoading={loading}
                size="sm"
                startContent={<LuReplaceAll size={20} />}
              >
                {isDragState ? "Confirm ordering" : "Reorder columns"}
              </Button>
              {isDragState && (
                <>
                  <Spacer x={1} />
                  <Button
                    isIconOnly
                    variant="light"
                    color={"danger"}
                    onPress={_onCancelColumnOrder}
                    title="Cancel ordering"
                    size="sm"
                  >
                    <LuCircleX />
                  </Button>
                </>
              )}
            </div>
          </div>
        </AccordionItem>
      </Accordion>

      <TableDataFormattingModal
        config={fieldFormatConfig}
        open={!!fieldForFormatting}
        onClose={() => {
          setFieldForFormatting("");
          setFieldFormatConfig(null);
        }}
        onUpdate={_onUpdateFieldFormatting}
        loading={fieldFormatLoading}
      />
    </div>
  )
}

TableConfiguration.propTypes = {
  dataset: PropTypes.object.isRequired,
  chartData: PropTypes.object.isRequired,
  tableFields: PropTypes.array.isRequired,
  loading: PropTypes.bool.isRequired,
  onUpdate: PropTypes.func.isRequired,
};

export default TableConfiguration
