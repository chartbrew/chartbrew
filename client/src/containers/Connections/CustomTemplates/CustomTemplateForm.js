import React, { useState, useEffect } from "react";
import PropTypes from "prop-types";
import { useWindowSize } from "react-use";
import {
  Button, Card, Checkbox, Header, Image, Divider, Grid, Icon, Popup, TransitionablePortal, Modal
} from "semantic-ui-react";
import _ from "lodash";

import connectionImages from "../../../config/connectionImages";
import { generateDashboard } from "../../../actions/project";

function CustomTemplateForm(props) {
  const {
    template, connections, onBack, projectId, onComplete, isAdmin, onDelete,
    onCreateProject,
  } = props;
  const { width } = useWindowSize();

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
    <div>
      <Header as="h2" dividing>
        {template.name}
      </Header>

      <Header>Connections</Header>
      <Card.Group itemsPerRow={width > 1000 ? 3 : 2}>
        {template.model.Connections && template.model.Connections.map((c) => {
          const existingConnections = _getExistingConnections(c);

          return (
            <Card key={c.id}>
              <Checkbox
                checked={selectedConnections[c.id] && selectedConnections[c.id].active}
                toggle
                style={{ position: "absolute", top: 10, right: 10 }}
                onChange={() => _onToggleConnection(c.id)}
              />
              <Card.Content>
                <Image src={connectionImages[c.type]} floated="left" size="mini" />
                <Card.Header>{c.name}</Card.Header>
                <Card.Description>
                  <Checkbox
                    checked={
                      (selectedConnections[c.id]
                      && selectedConnections[c.id].createNew)
                      || !existingConnections
                      || existingConnections.length < 1
                    }
                    label="Create a new connection"
                    onChange={() => _onToggleCreateNew(c.id)}
                    disabled={!existingConnections || existingConnections.length < 1}
                  />
                </Card.Description>
              </Card.Content>
              {existingConnections && existingConnections.length > 0 && (
                <Card.Content extra>
                  <Icon name="plug" />
                  Existing connection found
                </Card.Content>
              )}
            </Card>
          );
        })}
      </Card.Group>

      {template && template.model && (
        <>
          <Divider hidden />
          <Header size="small">{"Select which charts you want Chartbrew to create for you"}</Header>
          <Grid columns={2} stackable>
            {template.model.Charts && template.model.Charts.map((chart) => (
              <Grid.Column key={chart.tid}>
                <Checkbox
                  label={chart.name}
                  checked={
                    _.indexOf(selectedCharts, chart.tid) > -1
                  }
                  onClick={() => _onChangeSelectedCharts(chart.tid)}
                />
                {_getDependency(chart) && (
                  <>
                    {" "}
                    <Popup
                      trigger={(
                        <Icon name="warning sign" color="orange" />
                      )}
                      content={`This chart depends on ${_getDependency(chart)} to display properly.`}
                    />
                  </>
                )}
              </Grid.Column>
            ))}
          </Grid>

          <Divider hidden />
          <Button
            icon="check"
            content="Select all"
            basic
            onClick={_onSelectAll}
            size="small"
          />
          <Button
            icon="x"
            content="Deselect all"
            basic
            onClick={_onDeselectAll}
            size="small"
          />
        </>
      )}

      <Divider />
      <Button
        content="Back"
        onClick={onBack}
      />
      <Button
        primary
        content="Generate from template"
        onClick={_generateTemplate}
        loading={isCreating}
      />

      {isAdmin && (
        <Button
          color="red"
          className="tertiary"
          icon="trash"
          content="Delete template"
          onClick={() => setDeleteConfimation(true)}
        />
      )}

      {isAdmin && (
        <TransitionablePortal open={deleteConfirmation}>
          <Modal
            open={deleteConfirmation}
            closeIcon
            onClose={() => setDeleteConfimation(false)}
            basic
          >
            <Modal.Header>
              Are you sure you want to delete this template?
            </Modal.Header>
            <Modal.Content>
              {"After you delete this template you will not be able to create charts from it. Deleting the template will not affect any dashboards."}
            </Modal.Content>
            <Modal.Actions>
              <Button
                content="Cancel"
                onClick={() => setDeleteConfimation(false)}
              />
              <Button
                color="red"
                icon="trash"
                content="Delete template"
                loading={deleteLoading}
                onClick={() => {
                  setDeleteLoading(true);
                  onDelete(template.id);
                }}
              />
            </Modal.Actions>
          </Modal>
        </TransitionablePortal>
      )}
    </div>
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
