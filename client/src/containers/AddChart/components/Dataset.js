import React, { useState, useEffect } from "react";
import PropTypes from "prop-types";
import { connect } from "react-redux";
import { withRouter } from "react-router";
import _ from "lodash";
import moment from "moment";
import {
  Grid, Tooltip, Button, Spacer, Dropdown, Input, Loading, Link, Container, Text, Modal, Image, Row,
  Divider,
} from "@nextui-org/react";
import { ArrowDownSquare, ChevronDown } from "react-iconly";
import { FaPlug } from "react-icons/fa";

import { chartColors, primary } from "../../../config/colors";
import connectionImages from "../../../config/connectionImages";
import DatarequestModal from "./DatarequestModal";
import DatasetAppearance from "./DatasetAppearance";
import DatasetData from "./DatasetData";
import { changeTutorial as changeTutorialAction } from "../../../actions/tutorial";

const emptyColor = "rgba(0,0,0,0)";

function replaceEmptyColors(colors) {
  const colorsToAssign = [...chartColors];
  const newColors = colors.map((color) => {
    if (color === emptyColor) {
      const randomSelector = Math.floor(Math.random() * colorsToAssign.length);
      const selectedColor = colorsToAssign[Math.floor(Math.random() * colorsToAssign.length)];
      colorsToAssign.splice(randomSelector, 1);
      return selectedColor;
    }

    return color;
  });

  return newColors;
}

function Dataset(props) {
  const {
    dataset, connections, onUpdate, onDelete, chart, match, onRefresh,
    changeTutorial, onRefreshPreview, loading,
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
      const image = connectionImages[connection.type];

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
        tempDataItems = {
          ...tempDataItems,
          labels: chart.chartData.data && chart.chartData.data.labels
        };
        setDataItems(tempDataItems);
      }
    }
  }, [chart, dataset]);

  useEffect(() => {
    // reformat the fill color value based on the chart type
    if ((chart.type === "pie" || chart.type === "doughnut" || dataset.multiFill)
      && dataItems
      && dataItems.data
    ) {
      let { fillColor } = dataset;
      if (!Array.isArray(fillColor)) {
        fillColor = [fillColor];
      }

      for (let i = 0; i < dataItems.data.length; i++) {
        if (!fillColor[i]) {
          fillColor.push(chartColors[Math.floor(Math.random() * chartColors.length)]);
        }
      }

      fillColor = replaceEmptyColors(fillColor);

      const newDatasetData = { ...newDataset, fillColor };

      if ((chart.type === "pie" || chart.type === "doughnut") && !dataset.multiFill) {
        newDatasetData.multiFill = true;
      }

      if (!_.isEqual(dataset.fillColor, fillColor)) {
        setNewDataset(newDatasetData);
      }
    } else if (!dataset.multiFill && chart.type !== "pie" && chart.type !== "doughnut") {
      let newFillColor = newDataset.fillColor;
      if (Array.isArray(newFillColor)) {
        newFillColor = newFillColor[0].replace("\"", "");
      }

      setNewDataset({ ...newDataset, fillColor: newFillColor });
    }
  }, [dataItems]);

  const _onChangeConnection = (key) => {
    onUpdate({ connection_id: key });
  };

  const _openConfigModal = () => {
    setConfigOpened(true);
  };

  const _onCloseConfig = () => {
    if (requestResult) {
      changeTutorial("datasetdata");
    }
    setConfigOpened(false);
    onRefreshPreview();
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

  const _onChangeLegend = (e) => {
    if (e.target.value && e.target.value.length > 0) {
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
      <Grid.Container gap={1}>
        <Grid xs={12} sm={6} md={6}>
          <Input
            placeholder="Enter the dataset name"
            value={newDataset.legend}
            onChange={_onChangeLegend}
            bordered
            fullWidth
          />
        </Grid>
        <Grid xs={12} sm={6} md={6}>
          <Button
            color={saveRequired ? "primary" : "success"}
            onClick={_onSaveDataset}
            disabled={!saveRequired}
            auto
          >
            {saveRequired ? "Save" : "Saved"}
          </Button>
          <Spacer x={0.2} />
          <div style={{ width: 100 }}>
            <Tooltip content="Remove dataset">
              <Button
                flat
                color="error"
                onClick={() => setDeleteModal(true)}
                auto
              >
                {"Remove"}
              </Button>
            </Tooltip>
          </div>
        </Grid>
        <Grid xs={12} sm={6} md={6} className="dataset-manage-tut">
          <Dropdown isDisabled={connections.length < 1} isDismissable={false}>
            <Dropdown.Trigger type="text">
              <Input
                type="text"
                placeholder="Select a connection"
                value={
                  (newDataset.connection_id
                  && dropdownConfig.length > 0
                  && dropdownConfig.find(
                    (c) => c.value === parseInt(newDataset.connection_id, 10)
                  ).text) || "Select a connection"
                }
                disabled={connections.length < 1}
                fullWidth
                bordered
                contentRight={loading ? <Loading type="spinner" /> : <ChevronDown />}
                contentLeft={
                  dropdownConfig.length > 0
                  && newDataset.connection_id
                  && (
                    <Image
                      src={dropdownConfig.find(
                        (c) => c.value === parseInt(newDataset.connection_id, 10)
                      )?.image?.src}
                      width={30}
                      height={30}
                      alt="Selected connection"
                    />
                  )
                }
              />
            </Dropdown.Trigger>
            <Dropdown.Menu
              onAction={_onChangeConnection}
              selectedKeys={[newDataset.connection_id]}
              selectionMode="single"
            >
              {dropdownConfig.map((option) => (
                <Dropdown.Item key={option.value}>
                  <Container fluid css={{ p: 0, m: 0 }}>
                    <Row align="center" css={{ p: 0, m: 0 }}>
                      <img src={option.image.src} width={30} height={30} alt="Connection" />
                      <Spacer x={0.2} />
                      <Text>{option.text}</Text>
                    </Row>
                  </Container>
                </Dropdown.Item>
              ))}
            </Dropdown.Menu>
          </Dropdown>
        </Grid>
        <Grid xs={12} sm={6} md={6} alignItems="center">
          <Button
            iconRight={<ArrowDownSquare />}
            disabled={!newDataset.connection_id}
            onClick={_openConfigModal}
            auto
          >
            Get data
          </Button>
          <Spacer x={0.5} />
          <Tooltip content="Go to the connections page">
            <Link
              href={_onManageConnections()}
              target="_blank"
              rel="noopener noreferrer"
              color="primary"
            >
              <FaPlug size={24} />
            </Link>
          </Tooltip>
        </Grid>
        <Grid xs={12}>
          <Divider css={{ m: 20 }} />
        </Grid>
        <Grid
          xs={12}
          sm={6}
          md={6}
          justify="center"
          css={{
            background: menuItem === "data" ? "$background" : "$backgroundContrast",
            br: "$sm",
          }}
        >
          <Link
            css={{
              p: 5,
              pr: 10,
              pl: 10,
              "@xsMax": { width: "90%" },
              ai: "center",
              color: "$text",
            }}
            onClick={() => setMenuItem("data")}
          >
            <Text b>{"Data"}</Text>
          </Link>
        </Grid>
        <Grid
          xs={12}
          sm={6}
          md={6}
          justify="center"
          css={{
            background: menuItem === "appearance" ? "$background" : "$backgroundContrast",
            br: "$sm",
          }}
        >
          <Link
            css={{
              p: 5,
              pr: 10,
              pl: 10,
              "@xsMax": { width: "90%" },
              ai: "center",
              color: "$secondary",
            }}
            onClick={() => setMenuItem("appearance")}
          >
            <Text b>{"Chart colors"}</Text>
          </Link>
        </Grid>
        <Grid xs={12}>
          <Spacer y={1} />
        </Grid>
        {menuItem === "data" && (
          <Grid xs={12} sm={12} md={12}>
            <DatasetData
              dataset={newDataset}
              requestResult={requestResult}
              chartType={chart.type}
              chartData={chart.chartData}
              onUpdate={(data) => onUpdate(data)}
              onNoRequest={_openConfigModal}
              dataLoading={loading}
            />
          </Grid>
        )}
        {menuItem === "appearance" && (
          <Grid xs={12} sm={12} md={12}>
            <DatasetAppearance
              dataset={newDataset}
              chart={chart}
              onUpdate={_updateColors}
              dataItems={dataItems}
            />
          </Grid>
        )}
      </Grid.Container>

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
      <Modal open={deleteModal} basic size="small" onClose={() => setDeleteModal(false)}>
        <Modal.Header>
          <Text h3>{"Are you sure you want to remove this dataset?"}</Text>
        </Modal.Header>
        <Modal.Body>
          <Text>
            {"This action cannot be reversed."}
          </Text>
        </Modal.Body>
        <Modal.Footer>
          <Button
            flat
            color="warning"
            onClick={() => setDeleteModal(false)}
            auto
          >
            Go back
          </Button>
          <Button
            color="error"
            disabled={deleteLoading}
            onClick={_onDeleteDataset}
            auto
          >
            {deleteLoading ? <Loading type="points" /> : "Remove dataset"}
          </Button>
        </Modal.Footer>
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
  match: PropTypes.object.isRequired,
  onRefresh: PropTypes.func.isRequired,
  changeTutorial: PropTypes.func.isRequired,
  onRefreshPreview: PropTypes.func.isRequired,
  loading: PropTypes.bool,
};

Dataset.defaultProps = {
  loading: false,
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
    backgroundColor: datasetColor === emptyColor ? primary : datasetColor,
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
