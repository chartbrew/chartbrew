import React, { useState, useEffect } from "react";
import PropTypes from "prop-types";
import { connect } from "react-redux";
import _ from "lodash";
import {
  Popup, Icon, Divider, Dropdown, Button, Grid,
  Form, Input, Modal, Header, Label, Checkbox,
} from "semantic-ui-react";
import { SketchPicker } from "react-color";
import moment from "moment";

import { primary } from "../../../config/colors";
import mongoImg from "../../../assets/mongodb-logo-1.png";
import mysqlImg from "../../../assets/mysql.svg";
import apiImg from "../../../assets/api.png";
import postgresImg from "../../../assets/postgres.png";
import DatarequestModal from "./DatarequestModal";
import Filters from "./Filters";

function Dataset(props) {
  const {
    dataset, connections, onUpdate, onDelete, chart,
  } = props;
  const [newDataset, setNewDataset] = useState(dataset);
  const [dropdownConfig, setDropdownConfig] = useState([]);
  const [configOpened, setConfigOpened] = useState(false);
  const [saveRequired, setSaveRequired] = useState(false);
  const [shouldSave, setShouldSave] = useState(null);
  const [deleteModal, setDeleteModal] = useState(false);
  const [deleteLoading, setDeleteLoading] = useState(false);
  const [viewFilters, setViewFilters] = useState(false);
  const [dataItems, setDataItems] = useState([]);

  useEffect(() => {
    const config = [];
    connections.map((connection) => {
      const image = connection.type === "mongodb"
        ? mongoImg : connection.type === "api"
          ? apiImg : connection.type === "mysql"
            ? mysqlImg : postgresImg;

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
    // if (!dataset.id && connections[0]) setDataset(connections[0]);
  }, [connections]);

  // update the dataset with the active one
  useEffect(() => {
    setNewDataset(dataset);
  }, [dataset]);

  // update the dataset prop based on new changes
  useEffect(() => {
    if (_.isEqual(dataset, newDataset)) {
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
      onUpdate(newDataset);
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
    if (chart.subType === "pattern" && dataItems && dataItems.data) {
      let { fillColor } = dataset;
      if (!Array.isArray(fillColor)) {
        fillColor = [fillColor];
      }

      for (let i = 0; i < dataItems.data.length; i++) {
        if (!fillColor[i]) fillColor.push(fillColor[0]);
      }

      setNewDataset({ ...newDataset, fillColor });
    } else if (chart.subType !== "pattern") {
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

  const _onChangeField = (field) => {
    setNewDataset({ ...newDataset, xAxis: field });
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

  const _onChangePatterns = (newPatterns) => {
    setNewDataset({ ...newDataset, patterns: newPatterns });
  };

  const _renderColorPicker = (type, fillIndex) => {
    return (
      <SketchPicker
        color={
          type === "dataset" ? newDataset.datasetColor
            : (fillIndex || fillIndex === 0)
              ? newDataset.fillColor[fillIndex] : newDataset.fillColor
        }
        onChangeComplete={(color) => {
          const rgba = `rgba(${color.rgb.r}, ${color.rgb.g}, ${color.rgb.b}, ${color.rgb.a})`;

          if (type === "dataset") {
            setNewDataset({ ...newDataset, datasetColor: rgba });
          }

          if (type === "fill") {
            if (!fillIndex && fillIndex !== 0) {
              setNewDataset({ ...newDataset, fillColor: rgba });
            } else {
              const { fillColor } = newDataset;
              if (Array.isArray(fillColor) && fillColor[fillIndex]) {
                fillColor[fillIndex] = rgba;
              }
              onUpdate({ ...newDataset, fillColor });
              // setNewDataset({ ...newDataset, fillColor });
            }
          }
        }}
      />
    );
  };

  if (!dataset || !dataset.id || !newDataset.id) return (<span />);

  return (
    <div style={styles.container}>
      <Grid stackable>
        <Grid.Row>
          <Grid.Column>
            <Form>
              <Form.Field>
                <Header size="tiny">Dataset name</Header>
                <Input
                  type="text"
                  placeholder="Enter the dataset name"
                  value={newDataset.legend}
                  onChange={_onChangeLegend}
                />
              </Form.Field>
            </Form>
          </Grid.Column>
        </Grid.Row>
        <Grid.Row columns={2}>
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
              Get data
            </Button>
          </Grid.Column>
        </Grid.Row>
        <Grid.Row>
          <Grid.Column>
            <Button
              icon
              primary
              labelPosition="right"
              onClick={() => setViewFilters(true)}
            >
              <Icon name="options" />
              Filters
            </Button>
          </Grid.Column>
        </Grid.Row>
        <Grid.Row>
          <Grid.Column>
            <Divider />
            <Header size="tiny">Dataset Color</Header>
            <div>
              <Popup
                content={() => _renderColorPicker("dataset")}
                trigger={(
                  <Label
                    size="large"
                    color="blue"
                    style={styles.datasetColorBtn(newDataset.datasetColor)}
                    content="Click to select"
                  />
                )}
                style={{ padding: 0, margin: 0 }}
                on="click"
                offset="0, 10px"
                position="right center"
              />
            </div>

            <Header size="tiny">Fill Color</Header>
            <div>
              {chart.subType !== "pattern" && (
                <>
                  <Popup
                    content={() => _renderColorPicker("fill")}
                    trigger={(
                      <Label
                        size="large"
                        color="blue"
                        style={styles.datasetColorBtn(newDataset.fillColor)}
                        content="Click to select"
                      />
                    )}
                    style={{ padding: 0, margin: 0 }}
                    on="click"
                    offset="0, 10px"
                    position="right center"
                  />
                  <Checkbox
                    checked={newDataset.fill || false}
                    onChange={(e, data) => {
                      setNewDataset({ ...newDataset, fill: data.checked });
                    }}
                    style={{ verticalAlign: "middle", marginLeft: 10 }}
                  />
                </>
              )}
              {chart.subType === "pattern" && (
                <Label.Group>
                  {dataItems && dataItems.data && dataItems.data.map((val, fillIndex) => {
                    return (
                      <Popup
                        key={dataItems.labels[fillIndex]}
                        content={() => _renderColorPicker("fill", fillIndex)}
                        trigger={(
                          <Label
                            size="large"
                            color="blue"
                            style={styles.datasetColorBtn(newDataset.fillColor[fillIndex])}
                            content={dataItems.labels[fillIndex]}
                          />
                        )}
                        style={{ padding: 0, margin: 0 }}
                        on="click"
                        offset="0, 10px"
                        position="right center"
                      />
                    );
                  })}
                </Label.Group>
              )}
            </div>
          </Grid.Column>
        </Grid.Row>
        <Grid.Row>
          <Grid.Column>
            <Divider />
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
              labelPosition="right"
              onClick={() => setDeleteModal(true)}
            >
              <Icon name="trash" />
              Remove dataset
            </Button>
          </Grid.Column>
        </Grid.Row>
      </Grid>

      {newDataset.connection_id && (
        <DatarequestModal
          dataset={dataset}
          connection={_getActiveConnection()}
          open={configOpened}
          onClose={_onCloseConfig}
          onUpdateDataset={_onChangeField}
        />
      )}

      {/* DELETE CONFIRMATION MODAL */}
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

      {/* FILTERS MODAL */}
      <Modal
        open={viewFilters}
        onClose={() => setViewFilters(false)}
        closeOnDimmerClick={false}
      >
        <Modal.Header>Filter the data</Modal.Header>
        <Modal.Content>
          <Filters
            patterns={newDataset.patterns}
            labels={dataItems && dataItems.labels}
            onSave={_onChangePatterns}
          />
        </Modal.Content>
        <Modal.Actions>
          <Button
            content="Close"
            onClick={() => setViewFilters(false)}
          />
        </Modal.Actions>
      </Modal>
    </div>
  );
}

Dataset.propTypes = {
  dataset: PropTypes.object.isRequired,
  connections: PropTypes.array.isRequired,
  onUpdate: PropTypes.func.isRequired,
  onDelete: PropTypes.func.isRequired,
  chart: PropTypes.object.isRequired,
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

export default connect(mapStateToProps)(Dataset);
