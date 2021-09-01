import React, { useState, useEffect } from "react";
import PropTypes from "prop-types";
import { connect } from "react-redux";
import { withRouter } from "react-router";
import isEqual from "lodash/isEqual";
import {
  Popup, Icon, Dropdown, Button, Grid,
  Form, Input, Modal, Header, Menu, TransitionablePortal,
} from "semantic-ui-react";
import moment from "moment";

import { primary } from "../../../config/colors";
import mongoImg from "../../../assets/mongodb-logo-1.png";
import mysqlImg from "../../../assets/mysql.svg";
import apiImg from "../../../assets/api.png";
import postgresImg from "../../../assets/postgres.png";
import firebaseImg from "../../../assets/firebase-real-time-database.png";
import firestoreImg from "../../../assets/firebase-firestore.png";
import gAnalyticsLogo from "../../../assets/GoogleAnalytics.webp";
import DatarequestModal from "./DatarequestModal";
import DatasetAppearance from "./DatasetAppearance";
import DatasetData from "./DatasetData";
import { changeTutorial as changeTutorialAction } from "../../../actions/tutorial";

function Dataset(props) {
  const {
    dataset, connections, onUpdate, onDelete, chart, match, onRefresh,
    changeTutorial,
  } = props;

  const [newDataset, setNewDataset] = useState(dataset);
  const [dropdownConfig, setDropdownConfig] = useState([]);
  const [configOpened, setConfigOpened] = useState(false);
  const [saveRequired, setSaveRequired] = useState(false);
  const [shouldSave, setShouldSave] = useState(null);
  const [deleteModal, setDeleteModal] = useState(false);
  const [deleteLoading, setDeleteLoading] = useState(false);
  const [dataItems, setDataItems] = useState([]);
  const [menuItem, setMenuItem] = useState("data");
  const [requestResult, setRequestResult] = useState(null);

  useEffect(() => {
    const config = [];
    connections.map((connection) => {
      const image = connection.type === "mongodb"
        ? mongoImg : connection.type === "api"
          ? apiImg : connection.type === "mysql"
            ? mysqlImg : connection.type === "firebase"
              ? firebaseImg : connection.type === "firestore"
                ? firestoreImg : connection.type === "googleAnalytics"
                  ? gAnalyticsLogo : postgresImg;

      config.push({
        key: connection.id,
        value: connection.id,
        text: connection.name,
        image: {
          src: image,
        }
      });

      return connection;
    });
    setDropdownConfig(config);
  }, [connections]);

  // update the dataset with the active one
  useEffect(() => {
    setNewDataset(dataset);
  }, [dataset]);

  // update the dataset prop based on new changes
  useEffect(() => {
    if (isEqual(dataset, newDataset)) {
      setSaveRequired(false);
      return;
    }

    setSaveRequired(true);

    if (dataset.legend !== newDataset.legend) {
      if (shouldSave === null) {
        setShouldSave(moment().add(2, "seconds"));
      } else if (moment().isAfter(shouldSave)) {
        onUpdate(newDataset);
        setShouldSave(moment().add(2, "seconds"));
      } else {
        setShouldSave(moment().add(2, "seconds"));
      }
    } else {
      onUpdate(newDataset, true);
    }
  }, [newDataset]);

  useEffect(() => {
    let tempDataItems;
    if (chart.chartData && chart.chartData.data && chart.chartData.data.datasets) {
      // find the dataset in the chart data
      let foundIndex;
      for (let i = 0; i < chart.Datasets.length; i++) {
        const d = chart.Datasets[i];
        if (d.id === dataset.id) {
          foundIndex = i;
          break;
        }
      }

      if (foundIndex || foundIndex === 0) {
        tempDataItems = chart.chartData.data.datasets[foundIndex];
        tempDataItems = { ...tempDataItems, labels: chart.chartData.data.labels };
        setDataItems(tempDataItems);
      }
    }
  }, [chart, dataset]);

  useEffect(() => {
    // reformat the fill color value based on the chart type
    if (dataset.multiFill && dataItems && dataItems.data) {
      let { fillColor } = dataset;
      if (!Array.isArray(fillColor)) {
        fillColor = [fillColor];
      }

      for (let i = 0; i < dataItems.data.length; i++) {
        if (!fillColor[i]) fillColor.push(fillColor[0]);
      }

      setNewDataset({ ...newDataset, fillColor });
    } else if (!dataset.multiFill) {
      let newFillColor = newDataset.fillColor;
      if (Array.isArray(newFillColor)) {
        newFillColor = newFillColor[0].replace("\"", "");
      }

      setNewDataset({ ...newDataset, fillColor: newFillColor });
    }
  }, [dataItems]);

  const _onChangeConnection = (e, data) => {
    onUpdate({ connection_id: data.value });
  };

  const _openConfigModal = () => {
    setConfigOpened(true);
  };

  const _onCloseConfig = () => {
    if (requestResult) {
      changeTutorial("datasetdata");
    }
    setConfigOpened(false);
  };

  const _onSaveDataset = () => {
    onUpdate(newDataset);
  };

  const _onDeleteDataset = () => {
    setDeleteLoading(true);
    onDelete()
      .then(() => {
        setDeleteLoading(false);
        setDeleteModal(false);
        onRefresh();
      })
      .catch(() => {
        setDeleteLoading(false);
        setDeleteModal(false);
      });
  };

  const _onChangeLegend = (e, data) => {
    if (data.value && e.target.value.length > 0) {
      setNewDataset({ ...newDataset, legend: e.target.value });
    }
  };

  const _getActiveConnection = () => {
    let activeConnection;
    connections.map((connection) => {
      if (newDataset.connection_id === connection.id) {
        activeConnection = connection;
      }

      return connection;
    });

    return activeConnection;
  };

  const _onManageConnections = () => {
    return `/${match.params.teamId}/${match.params.projectId}/connections`;
  };

  const _updateColors = (data, forceUpdate) => {
    setNewDataset(data);
    if (forceUpdate) {
      onUpdate(data, true);
    }
  };

  const _onNewResult = (result) => {
    setRequestResult(result);
  };

  if (!dataset || !dataset.id || !newDataset.id) return (<span />);

  return (
    <div style={styles.container}>
      <Grid stackable>
        <Grid.Row>
          <Grid.Column>
            <Form>
              <Form.Group widths="equal">
                <Form.Field>
                  <Input
                    type="text"
                    placeholder="Enter the dataset name"
                    value={newDataset.legend}
                    onChange={_onChangeLegend}
                  />
                </Form.Field>
                <Form.Field>
                  <Button
                    primary
                    icon
                    labelPosition="right"
                    onClick={_onSaveDataset}
                    disabled={!saveRequired}
                  >
                    <Icon name="checkmark" />
                    {saveRequired ? "Save" : "Saved"}
                  </Button>
                  <Button
                    basic
                    negative
                    icon
                    onClick={() => setDeleteModal(true)}
                  >
                    <Icon name="trash" />
                  </Button>
                </Form.Field>
              </Form.Group>
            </Form>
          </Grid.Column>
        </Grid.Row>
        <Grid.Row columns={2} className="dataset-manage-tut">
          <Grid.Column>
            <Dropdown
              placeholder="Select a connection"
              selection
              value={newDataset.connection_id}
              options={dropdownConfig}
              disabled={connections.length < 1}
              onChange={_onChangeConnection}
              fluid
            />
          </Grid.Column>
          <Grid.Column textAlign="left">
            <Button
              primary
              icon
              labelPosition="right"
              disabled={!newDataset.connection_id}
              onClick={_openConfigModal}
            >
              <Icon name="wifi" />
              Make request
            </Button>
            <Popup
              trigger={(
                <Button
                  as="a"
                  target="_blank"
                  rel="noopener noreferrer"
                  icon="plug"
                  href={_onManageConnections()}
                />
              )}
              content="Manage connections"
              position="top center"
            />
          </Grid.Column>
        </Grid.Row>
        <Grid.Row>
          <Grid.Column>
            <Menu pointing secondary widths={2}>
              <Menu.Item
                active={menuItem === "data"}
                onClick={() => setMenuItem("data")}
                color="blue"
              >
                {"Chart data"}
              </Menu.Item>
              <Menu.Item
                active={menuItem === "appearance"}
                onClick={() => setMenuItem("appearance")}
                color="blue"
                disabled={chart.type === "table"}
              >
                {"Appearance"}
              </Menu.Item>
            </Menu>
          </Grid.Column>
        </Grid.Row>
        {menuItem === "data" && (
          <Grid.Row>
            <Grid.Column>
              <DatasetData
                dataset={newDataset}
                requestResult={requestResult}
                chartType={chart.type}
                chartData={chart.chartData}
                onUpdate={(data) => onUpdate(data)}
                onNoRequest={_openConfigModal}
              />
            </Grid.Column>
          </Grid.Row>
        )}
        {menuItem === "appearance" && (
          <Grid.Row>
            <Grid.Column className="dataset-colors-tut">
              <DatasetAppearance
                dataset={newDataset}
                chart={chart}
                onUpdate={_updateColors}
                dataItems={dataItems}
              />
            </Grid.Column>
          </Grid.Row>
        )}
      </Grid>

      {newDataset.connection_id && (
        <DatarequestModal
          dataset={dataset}
          connection={_getActiveConnection()}
          open={configOpened}
          onClose={_onCloseConfig}
          updateResult={_onNewResult}
          chart={chart}
        />
      )}

      {/* DELETE CONFIRMATION MODAL */}
      <TransitionablePortal open={deleteModal}>
        <Modal open={deleteModal} basic size="small" onClose={() => setDeleteModal(false)}>
          <Header
            icon="exclamation triangle"
            content="Are you sure you want to remove this dataset?"
          />
          <Modal.Content>
            <p>
              {"This action cannot be reversed."}
            </p>
          </Modal.Content>
          <Modal.Actions>
            <Button
              basic
              inverted
              onClick={() => setDeleteModal(false)}
            >
              Go back
            </Button>
            <Button
              negative
              loading={deleteLoading}
              onClick={_onDeleteDataset}
              icon
              labelPosition="right"
            >
              <Icon name="trash" />
              Remove dataset
            </Button>
          </Modal.Actions>
        </Modal>
      </TransitionablePortal>
    </div>
  );
}

Dataset.propTypes = {
  dataset: PropTypes.object.isRequired,
  connections: PropTypes.array.isRequired,
  onUpdate: PropTypes.func.isRequired,
  onDelete: PropTypes.func.isRequired,
  chart: PropTypes.object.isRequired,
  match: PropTypes.object.isRequired,
  onRefresh: PropTypes.func.isRequired,
  changeTutorial: PropTypes.func.isRequired,
};

const styles = {
  container: {
    flex: 1,
  },
  closeBtn: {
    float: "left",
  },
  colorPreview: {
    width: 30,
    height: 30,
    borderRadius: 5,
    backgroundColor: primary,
  },
  datasetColorBtn: (datasetColor) => ({
    cursor: "pointer",
    backgroundColor: datasetColor === "rgba(0,0,0,0)" ? primary : datasetColor,
    border: `1px solid ${primary}`
  }),
};

const mapStateToProps = (state) => {
  return {
    datasetLoading: state.dataset.loading,
    connections: state.connection.data,
  };
};

const mapDispatchToProps = (dispatch) => {
  return {
    changeTutorial: (tutorial) => dispatch(changeTutorialAction(tutorial)),
  };
};

export default withRouter(connect(mapStateToProps, mapDispatchToProps)(Dataset));
