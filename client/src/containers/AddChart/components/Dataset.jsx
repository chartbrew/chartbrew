import React, { useState, useEffect } from "react";
import PropTypes from "prop-types";
import { connect } from "react-redux";
import _ from "lodash";
import moment from "moment";
import {
  Tooltip, Button, Spacer, Input, Modal, Divider, Tabs, Tab,
  ModalHeader, ModalBody, ModalFooter, ModalContent,
} from "@heroui/react";
import { LuCloudDownload, LuPencilLine } from "react-icons/lu";

import { chartColors, primary } from "../../../config/colors";
import DatarequestModal from "./DatarequestModal";
import DatasetAppearance from "./DatasetAppearance";
import DatasetData from "./DatasetData";
import Text from "../../../components/Text";

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
    dataset, onUpdate, onDelete, chart, onRefresh,
    loading, datasetResponses,
  } = props;

  const [newDataset, setNewDataset] = useState(dataset);
  const [configOpened, setConfigOpened] = useState(false);
  const [shouldSave, setShouldSave] = useState(null);
  const [deleteModal, setDeleteModal] = useState(false);
  const [deleteLoading, setDeleteLoading] = useState(false);
  const [dataItems, setDataItems] = useState([]);
  const [menuItem, setMenuItem] = useState("data");
  const [requestResult, setRequestResult] = useState(null);
  const [editDatasetName, setEditDatasetName] = useState(false);
  const [datasetName, setDatasetName] = useState(dataset.legend);
  const [savingDatasetName, setSavingDatasetName] = useState(false);

  // update the dataset with the active one
  useEffect(() => {
    setNewDataset(dataset);
  }, [dataset]);

  // update the dataset prop based on new changes
  useEffect(() => {
    if (_.isEqual(dataset, newDataset)) {
      return;
    }

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
      for (let i = 0; i < chart.ChartDatasetConfigs.length; i++) {
        const d = chart.ChartDatasetConfigs[i];
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

  useEffect(() => {
    if (datasetResponses.length > 0) {
      const dResponse = datasetResponses.find((response) => response.dataset_id === dataset.id);
      if (dResponse?.data) setRequestResult(dResponse.data);
    }
  }, [datasetResponses]);

  const _openConfigModal = () => {
    setConfigOpened(true);
  };

  const _onCloseConfig = () => {
    setConfigOpened(false);
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

  const _onChangeLegend = () => {
    if (datasetName) {
      setSavingDatasetName(true);
      onUpdate({ ...newDataset, legend: datasetName })
        .then(() => {
          setSavingDatasetName(false);
          setEditDatasetName(false);
        })
        .catch(() => {
          setSavingDatasetName(false);
        });
    }
  };

  const _updateColors = (data, forceUpdate) => {
    setNewDataset(data);
    if (forceUpdate) {
      onUpdate(data, true);
    }
  };

  if (!dataset || !dataset.id || !newDataset.id) return (<span />);

  return (
    <div style={styles.container}>
      <div className="grid grid-cols-12 gap-2">
        <div className="col-span-12">
          <Spacer y={2} />
          <Divider />
          <Spacer y={2} />
        </div>
        <div className="col-span-12 flex items-center">
          <Text b size={"lg"}>{newDataset.legend}</Text>
          <Spacer x={1} />
          <Button
            variant="light"
            isIconOnly
            onClick={() => setEditDatasetName(!editDatasetName)}
            color={"primary"}
            disableRipple
            size="sm"
          >
            <LuPencilLine />
          </Button>
        </div>
        {editDatasetName && (
          <div className="col-span-12 md:col-span-6">
            <Input
              placeholder="Enter a name for the dataset"
              value={datasetName || ""}
              onChange={(e) => setDatasetName(e.target.value)}
              variant="bordered"
              fullWidth
            />
          </div>
        )}
        {editDatasetName && (
          <div className="col-span-12 md:col-span-6">
            <Button
              onClick={_onChangeLegend}
              isDisabled={!datasetName}
              isLoading={savingDatasetName}
              color="success"
              variant="flat"
            >
              {"Save"}
            </Button>
          </div>
        )}
        <div className="col-span-12 md:col-span-6 dataset-manage-tut">
          <Button
            endContent={<LuCloudDownload />}
            onClick={_openConfigModal}
            color="primary"
            fullWidth
          >
            Get data
          </Button>
        </div>
        <div className="col-span-12 md:col-span-6 flex items-center">
          <Tooltip content="Remove dataset">
            <Button
              variant="flat"
              color="danger"
              onClick={() => setDeleteModal(true)}
            >
              {"Remove"}
            </Button>
          </Tooltip>
        </div>
        <div className="col-span-12">
          <Spacer y={4} />
          <Divider />
          <Spacer y={4} />
        </div>
        <div className="col-span-12">
          <Tabs selectedKey={menuItem} onSelectionChange={(key) => setMenuItem(key)} fullWidth>
            <Tab key="data" title="Data" />
            <Tab key="appearance" title="Chart colors" />
          </Tabs>
        </div>
        <div className="col-span-12">
          <Spacer y={2} />
        </div>
        {menuItem === "data" && (
          <div className="col-span-12">
            <DatasetData
              dataset={newDataset}
              requestResult={requestResult}
              chartType={chart.type}
              chartData={chart.chartData}
              onUpdate={(data) => onUpdate(data)}
              onNoRequest={_openConfigModal}
              dataLoading={loading}
            />
          </div>
        )}
        {menuItem === "appearance" && (
          <div className="col-span-12">
            <DatasetAppearance
              dataset={newDataset}
              chart={chart}
              onUpdate={_updateColors}
              dataItems={dataItems}
            />
          </div>
        )}
      </div>

      <DatarequestModal
        dataset={dataset}
        open={configOpened}
        onClose={_onCloseConfig}
        chart={chart}
      />

      {/* DELETE CONFIRMATION MODAL */}
      <Modal isOpen={deleteModal} size="sm" onClose={() => setDeleteModal(false)}>
        <ModalContent>
          <ModalHeader>
            <Text size="h3">{"Are you sure you want to remove this dataset?"}</Text>
          </ModalHeader>
          <ModalBody>
            <Text>
              {"This action cannot be reversed."}
            </Text>
          </ModalBody>
          <ModalFooter>
            <Button
              variant="flat"
              color="warning"
              onClick={() => setDeleteModal(false)}
              auto
            >
              Go back
            </Button>
            <Button
              color="danger"
              isLoading={deleteLoading}
              onClick={_onDeleteDataset}
              auto
            >
              {"Remove dataset"}
            </Button>
          </ModalFooter>
        </ModalContent>
      </Modal>
    </div>
  );
}

Dataset.propTypes = {
  dataset: PropTypes.object.isRequired,
  onUpdate: PropTypes.func.isRequired,
  onDelete: PropTypes.func.isRequired,
  chart: PropTypes.object.isRequired,
  onRefresh: PropTypes.func.isRequired,
  loading: PropTypes.bool,
  datasetResponses: PropTypes.array.isRequired,
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
    datasetResponses: state.dataset.responses,
  };
};

const mapDispatchToProps = () => {
  return {
  };
};

export default connect(mapStateToProps, mapDispatchToProps)(Dataset);
