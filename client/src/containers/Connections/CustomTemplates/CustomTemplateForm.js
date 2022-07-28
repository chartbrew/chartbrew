import React, { useState, useEffect } from "react";
import PropTypes from "prop-types";
import _ from "lodash";
import {
  Avatar, Button, Card, Checkbox, Container, Divider, Grid, Loading,
  Modal, Row, Spacer, Switch, Text, Tooltip,
} from "@nextui-org/react";

import {
  ArrowRight, CaretLeft, CloseSquare, Delete, InfoSquare, Swap, TickSquare,
} from "react-iconly";

import connectionImages from "../../../config/connectionImages";
import { generateDashboard } from "../../../actions/project";

function CustomTemplateForm(props) {
  const {
    template, connections, onBack, projectId, onComplete, isAdmin, onDelete,
    onCreateProject,
  } = props;

  const [selectedConnections, setSelectedConnections] = useState({});
  const [selectedCharts, setSelectedCharts] = useState([]);
  const [isCreating, setIsCreating] = useState(false);
  const [deleteConfirmation, setDeleteConfimation] = useState(false);
  const [deleteLoading, setDeleteLoading] = useState(false);
  const [formStatus, setFormStatus] = useState("");

  useEffect(() => {
    if (template && template.model.Connections) {
      const newSelectedConnections = {};
      template.model.Connections.forEach((c) => {
        newSelectedConnections[c.id] = {
          id: c.id,
          name: c.name,
          active: true,
          createNew: false,
        };
      });

      setSelectedConnections(newSelectedConnections);
    }

    if (template && template.model && template.model.Charts) {
      const charts = [];
      template.model.Charts.forEach((c) => {
        charts.push(c.tid);
      });
      setSelectedCharts(charts);
    }
  }, [template]);

  useEffect(() => {
    if (projectId && formStatus === "waitingForProject") {
      _generateTemplate();
    }
  }, [projectId]);

  const _getExistingConnections = (connection) => {
    // check existing connections
    const foundConnections = [];
    let sameConnection;
    connections.forEach((c) => {
      if (c.id === connection.id) {
        sameConnection = c;
      }

      if (c.type === connection.type) {
        // look for more compatibilities
        switch (connection.type) {
          case "api":
            if (c.host === connection.host) {
              foundConnections.push(c);
            }
            break;
          case "mongodb":
          case "mysql":
          case "potgres":
            if (
              c.connectionString === connection.connectionString
              || c.dbName === connection.dbName
            ) {
              foundConnections.push(c);
            }
            break;
          case "firestore":
          case "realtimedb":
            if (c.firebaseServiceAccount === connection.firebaseServiceAccount) {
              foundConnections.push(c);
            }
            break;
          case "googleAnalytics":
            if (c.oauth_id === connection.oauth_id) {
              foundConnections.push(c);
            }
            break;
          default:
            break;
        }
      }
    });

    // add the same connection to the end of the array to keep track of it
    if (sameConnection) {
      foundConnections.push(sameConnection);
    }

    return foundConnections;
  };

  const _onToggleConnection = (cid) => {
    const newList = _.clone(selectedConnections);
    newList[cid].active = !newList[cid].active;
    setSelectedConnections(newList);
  };

  const _onToggleCreateNew = (cid) => {
    const newList = _.clone(selectedConnections);

    if (newList[cid]) {
      newList[cid].createNew = !newList[cid].createNew;
      setSelectedConnections(newList);
    }
  };

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

  const _getDependency = (chart) => {
    if (Object.keys(selectedConnections).length < 1) return "";

    const datasets = chart.Datasets;
    let dependency = "";

    for (let i = 0; i < datasets.length; i++) {
      if (!selectedConnections[datasets[i].Connection].active) {
        dependency = selectedConnections[datasets[i].Connection].name;
        break;
      }
    }

    if (dependency && _.indexOf(selectedCharts, chart.tid) > -1) {
      _onChangeSelectedCharts(chart.tid);
    }

    return dependency;
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
      connections: selectedConnections,
    };

    generateDashboard(projectId, data, "custom")
      .then(() => {
        setTimeout(() => {
          setIsCreating(false);
          onComplete();
        }, 2000);
      })
      .catch(() => { setIsCreating(false); });
  };

  return (
    <Container>
      <Row align="center">
        <Avatar icon={<CaretLeft />} onClick={onBack} squared />
        <Spacer x={0.5} />
        <Text h4>
          {template.name}
        </Text>
      </Row>
      <Spacer y={1} />
      <Divider />
      <Spacer y={1} />
      <Row>
        <Text b>Connections</Text>
      </Row>
      <Spacer y={0.5} />
      <Grid.Container gap={2}>
        {template.model.Connections && template.model.Connections.map((c) => {
          const existingConnections = _getExistingConnections(c);

          return (
            <Grid xs={12} sm={6} md={4} xl={3} key={c.id}>
              <Card variant="bordered">
                <Card.Header>
                  <Switch
                    checked={selectedConnections[c.id] && selectedConnections[c.id].active}
                    style={{ position: "absolute", top: 15, right: 10 }}
                    onChange={() => _onToggleConnection(c.id)}
                    size="xs"
                  />
                  <img src={connectionImages[c.type]} alt={"Connection logo"} width="34px" height="34px" />
                  <Text>{c.name}</Text>
                </Card.Header>
                <Card.Body>
                  <Checkbox
                    isSelected={
                      (selectedConnections[c.id]
                      && selectedConnections[c.id].createNew)
                      || !existingConnections
                      || existingConnections.length < 1
                    }
                    onChange={() => _onToggleCreateNew(c.id)}
                    isDisabled={!existingConnections || existingConnections.length < 1}
                    size="sm"
                  >
                    New connection
                  </Checkbox>
                </Card.Body>
                {existingConnections && existingConnections.length > 0 && (
                  <Card.Footer>
                    <Row align="center">
                      <Swap size="small" />
                      <Spacer x={0.2} />
                      <Text small>Existing connection found</Text>
                    </Row>
                  </Card.Footer>
                )}
              </Card>
            </Grid>
          );
        })}
      </Grid.Container>

      {template && template.model && (
        <>
          <Spacer y={1} />
          <Row>
            <Text b>{"Select which charts you want Chartbrew to create for you"}</Text>
          </Row>
          <Spacer y={0.5} />
          <Grid.Container gap={1}>
            {template.model.Charts && template.model.Charts.map((chart) => (
              <Grid key={chart.tid} xs={12} sm={6}>
                <Checkbox
                  isSelected={
                    _.indexOf(selectedCharts, chart.tid) > -1
                  }
                  onChange={() => _onChangeSelectedCharts(chart.tid)}
                  size="sm"
                >
                  {chart.name}
                </Checkbox>
                {_getDependency(chart) && (
                  <>
                    {" "}
                    <Tooltip
                      content={`This chart depends on ${_getDependency(chart)} to display properly.`}
                      css={{ zIndex: 99999 }}
                    >
                      <InfoSquare size="small" />
                    </Tooltip>
                  </>
                )}
              </Grid>
            ))}
          </Grid.Container>

          <Spacer y={1} />
          <Row>
            <Button
              iconRight={<TickSquare />}
              bordered
              onClick={_onSelectAll}
              size="sm"
              auto
            >
              Select all
            </Button>
            <Spacer x={0.5} />
            <Button
              iconRight={<CloseSquare />}
              bordered
              onClick={_onDeselectAll}
              size="sm"
              auto
            >
              Deselect all
            </Button>
          </Row>
        </>
      )}

      <Spacer y={1} />
      <Row justify="flex-end">
        {isAdmin && (
          <Button
            color="error"
            flat
            iconRight={<Delete />}
            onClick={() => setDeleteConfimation(true)}
            auto
          >
            Delete template
          </Button>
        )}
        <Spacer x={0.5} />
        <Button
          primary
          onClick={_generateTemplate}
          disabled={isCreating || !selectedCharts.length}
          iconRight={<ArrowRight />}
          auto
        >
          {!isCreating && "Generate from template"}
          {isCreating && <Loading type="points" />}
        </Button>
      </Row>

      {isAdmin && (
        <Modal
          open={deleteConfirmation}
          closeButton
          onClose={() => setDeleteConfimation(false)}
        >
          <Modal.Header>
            <Text h4>Are you sure you want to delete this template?</Text>
          </Modal.Header>
          <Modal.Body>
            {"After you delete this template you will not be able to create charts from it. Deleting the template will not affect any dashboards."}
          </Modal.Body>
          <Modal.Footer>
            <Button
              flat
              color="warning"
              onClick={() => setDeleteConfimation(false)}
              auto
            >
              Close
            </Button>
            <Button
              color="error"
              iconRight={<Delete />}
              disabled={deleteLoading}
              onClick={() => {
                setDeleteLoading(true);
                onDelete(template.id);
              }}
              auto
            >
              {!deleteLoading && "Delete template"}
              {deleteLoading && <Loading type="points" />}
            </Button>
          </Modal.Footer>
        </Modal>
      )}
    </Container>
  );
}

CustomTemplateForm.propTypes = {
  template: PropTypes.object.isRequired,
  connections: PropTypes.array.isRequired,
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
