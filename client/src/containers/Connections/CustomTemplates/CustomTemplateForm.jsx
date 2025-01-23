import React, { useState, useEffect } from "react";
import PropTypes from "prop-types";
import _ from "lodash";
import {
  Autocomplete,
  AutocompleteItem,
  Avatar,
  Button, Checkbox, Chip, Divider, Modal, ModalBody, ModalContent, ModalFooter,
  ModalHeader, Spacer, Switch,
} from "@heroui/react";
import {
  LuArrowLeft, LuArrowRight, LuCheckCheck, LuTrash, LuX,
} from "react-icons/lu";
import { useDispatch, useSelector } from "react-redux";

import { generateDashboard } from "../../../slices/project";
import Row from "../../../components/Row";
import Text from "../../../components/Text";
import { selectConnections } from "../../../slices/connection";
import connectionImages from "../../../config/connectionImages";
import { useTheme } from "../../../modules/ThemeContext";


function CustomTemplateForm(props) {
  const {
    template, onBack, projectId, onComplete, isAdmin, onDelete,
    onCreateProject,
  } = props;

  const [selectedCharts, setSelectedCharts] = useState([]);
  const [isCreating, setIsCreating] = useState(false);
  const [deleteConfirmation, setDeleteConfimation] = useState(false);
  const [deleteLoading, setDeleteLoading] = useState(false);
  const [formStatus, setFormStatus] = useState("");
  const [customConnections, setCustomConnections] = useState({});
  const [newDatasets, setNewDatasets] = useState(false);
  const [canChangeNewDatasets, setCanChangeNewDatasets] = useState(true);

  const dispatch = useDispatch();
  const connections = useSelector(selectConnections);
  const { isDark } = useTheme();

  useEffect(() => {
    if (template && template.model && template.model.Charts) {
      const charts = [];
      template.model.Charts.forEach((c) => {
        charts.push(c.tid);
      });
      setSelectedCharts(charts);
    }

    if (template?.model?.Connections) {
      const cc = {};
      template.model.Connections.forEach((c) => {
        cc[c.id] = c.id;
      });

      setCustomConnections(cc);
    }
  }, [template]);

  useEffect(() => {
    if (customConnections) {
      let canChange = true;
      Object.keys(customConnections).forEach((key) => {
        if (customConnections[key] !== parseInt(key, 10)) {
          canChange = false;
        }
      });

      setCanChangeNewDatasets(canChange);
      setNewDatasets(true);
    }
  }, [customConnections]);

  useEffect(() => {
    if (projectId && formStatus === "waitingForProject") {
      _generateTemplate();
    }
  }, [projectId]);

  const _onChangeSelectedCharts = (tid) => {
    const newCharts = [].concat(selectedCharts) || [];
    const isSelected = _.indexOf(selectedCharts, tid);

    if (isSelected === -1) {
      newCharts.push(tid);
    } else {
      newCharts.splice(isSelected, 1);
    }

    setSelectedCharts(newCharts);
  };

  const _onSelectAll = () => {
    if (template && template.model.Charts) {
      const newSelectedCharts = [];
      template.model.Charts.forEach((chart) => {
        newSelectedCharts.push(chart.tid);
      });
      setSelectedCharts(newSelectedCharts);
    }
  };

  const _onDeselectAll = () => {
    setSelectedCharts([]);
  };

  const _generateTemplate = () => {
    setIsCreating(true);

    if (!projectId && !formStatus) {
      setFormStatus("waitingForProject");
      onCreateProject();
      return;
    }

    const data = {
      template_id: template.id,
      charts: selectedCharts,
      connections: customConnections,
      newDatasets,
    };

    dispatch(generateDashboard({ project_id: projectId, data, template: "custom" }))
      .then(() => {
        setTimeout(() => {
          setIsCreating(false);
          onComplete();
        }, 2000);
      })
      .catch(() => { setIsCreating(false); });
  };

  const _onSelectCustomConnections = (key, currentConnection) => {
    const newCustomConnections = { ...customConnections };
    newCustomConnections[currentConnection.id] = parseInt(key, 10);
    
    setCustomConnections(newCustomConnections);
  };

  return (
    <div className="w-full">
      <Row align="center" className={"gap-2"}>
        <Button
          variant="faded"
          isIconOnly
          onClick={onBack}
          size="sm"
        >
          <LuArrowLeft />
        </Button>
        <Text size="h4">
          {template.name}
        </Text>
      </Row>
      <Spacer y={2} />
      <Divider />
      <Spacer y={2} />

      {template && template.model && (
        <>
          <Spacer y={4} />
          {template.model?.Connections && template.model?.Datasets && (
            <>
              <Row>
                <Text b>{"Template connections"}</Text>
              </Row>
              <Spacer y={1} />
              <div className="flex flex-col gap-2">
                {template.model?.Connections?.map((connection) => (
                  <div key={connection.id} className="flex flex-col gap-1">
                    <Autocomplete
                      selectedKey={`${customConnections[connection.id]}`}
                      onSelectionChange={(key) => _onSelectCustomConnections(key, connection)}
                      variant="bordered"
                      labelPlacement="outside"
                      onKeyDown={(e) => e.continuePropagation()}
                      aria-label="Select connection"
                    >
                      {connections.map((c) => (
                        <AutocompleteItem
                          key={`${c.id}`}
                          textValue={c.name}
                          startContent={(
                            <Avatar src={connectionImages(isDark)[c.subType]} radius="sm" />
                          )}
                        >
                          {c.name}
                        </AutocompleteItem>
                      ))}
                    </Autocomplete>
                    {`${customConnections[connection.id]}` !== `${connection.id}` && (
                      <div className="flex items-center gap-1">
                        <span className="text-sm">{"Connection "}</span>
                        <Chip variant="flat" radius="sm">
                          {connection.name}
                        </Chip>
                        <span className="text-sm">{" will be replaced by "}</span>
                        <Chip variant="flat" radius="sm">
                          {connections.find((c) => c.id === customConnections[connection.id])?.name}
                        </Chip>
                      </div>
                    )}
                    <Spacer y={1} />
                  </div>
                ))}
              </div>
              <Spacer y={3} />
              <Row>
                <Text b>{"Datasets"}</Text>
              </Row>
              <Spacer y={1} />
              <Row>
                <Switch
                  isSelected={newDatasets}
                  onChange={() => setNewDatasets(!newDatasets)}
                  isDisabled={!canChangeNewDatasets}
                  size="sm"
                >
                  {"Create new datasets"}
                </Switch>
              </Row>
              {!canChangeNewDatasets && (
                <Row>
                  <span className="text-sm">
                    {"New datasets will be created when connections are replaced."}
                  </span>
                </Row>
              )}
              <Spacer y={4} />
            </>
          )}
          {!template.model?.Datasets?.length && (
            <div className="flex flex-col gap-2">
              <Chip variant="flat" color="warning" radius="sm">
                {"Legacy template"}
              </Chip>
              <span className="text-sm">
                {"This template does not support custom connections and datasets. You can re-create the template to enable this feature."}
              </span>
              <Spacer y={2} />
            </div>
          )}
          <Row>
            <Text b>{"Select which charts you want Chartbrew to create for you"}</Text>
          </Row>
          <Spacer y={1} />
          <div className="grid grid-cols-12 gap-2">
            {template.model.Charts && template.model.Charts.map((chart) => (
              <div className="col-span-12 sm:col-span-6 md:col-span-4 lg:col-span-4 xl:col-span-3" key={chart.tid}>
                <Row align={"center"} className={"gap-1"}>
                  <Checkbox
                    isSelected={
                      _.indexOf(selectedCharts, chart.tid) > -1
                    }
                    onChange={() => _onChangeSelectedCharts(chart.tid)}
                    size="sm"
                  >
                    {chart.name}
                  </Checkbox>
                </Row>
              </div>
            ))}
          </div>

          <Spacer y={4} />
          <Row>
            <Button
              endContent={<LuCheckCheck />}
              variant="ghost"
              onClick={_onSelectAll}
              size="sm"
            >
              Select all
            </Button>
            <Spacer x={0.5} />
            <Button
              endContent={<LuX />}
              variant="ghost"
              onClick={_onDeselectAll}
              size="sm"
            >
              Deselect all
            </Button>
          </Row>
        </>
      )}

      <Spacer y={4} />
      <Row justify="flex-end">
        {isAdmin && (
          <Button
            color="danger"
            variant="flat"
            endContent={<LuTrash />}
            onClick={() => setDeleteConfimation(true)}
          >
            Delete template
          </Button>
        )}
        <Spacer x={0.5} />
        <Button
          color="primary"
          onClick={_generateTemplate}
          isDisabled={!selectedCharts.length}
          endContent={<LuArrowRight />}
          isLoading={isCreating}
        >
          Generate from template
        </Button>
      </Row>

      {isAdmin && (
        <Modal
          isOpen={deleteConfirmation}
          closeButton
          onClose={() => setDeleteConfimation(false)}
        >
          <ModalContent>
            <ModalHeader>
              <Text size="h4">Are you sure you want to delete this template?</Text>
            </ModalHeader>
            <ModalBody>
              {"After you delete this template you will not be able to create charts from it. Deleting the template will not affect any dashboards."}
            </ModalBody>
            <ModalFooter>
              <Button
                variant="flat"
                color="warning"
                onClick={() => setDeleteConfimation(false)}
              >
                Close
              </Button>
              <Button
                color="danger"
                endContent={<LuTrash />}
                onClick={() => {
                  setDeleteLoading(true);
                  onDelete(template.id);
                }}
                isLoading={deleteLoading}
              >
                Delete template
              </Button>
            </ModalFooter>
          </ModalContent>
        </Modal>
      )}
    </div>
  );
}

CustomTemplateForm.propTypes = {
  template: PropTypes.object.isRequired,
  onBack: PropTypes.func.isRequired,
  projectId: PropTypes.oneOfType([PropTypes.string, PropTypes.number]),
  onComplete: PropTypes.func.isRequired,
  onDelete: PropTypes.func.isRequired,
  isAdmin: PropTypes.bool,
  onCreateProject: PropTypes.func,
};

CustomTemplateForm.defaultProps = {
  isAdmin: false,
  onCreateProject: () => {},
  projectId: "",
};

export default CustomTemplateForm;
