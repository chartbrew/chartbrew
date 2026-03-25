import React, { useState, useEffect, Fragment } from "react";
import PropTypes from "prop-types";
import { connect } from "react-redux";
import _ from "lodash";
import toast from "react-hot-toast";
import {
  Button, Link, Modal, Avatar, Badge, Tooltip, Card,
  ProgressCircle, Spinner,
} from "@heroui/react";
import moment from "moment";
import { LuLink2, LuMonitorX, LuPlus } from "react-icons/lu";

import ApiBuilder from "./ApiBuilder";
import SqlBuilder from "./SqlBuilder";
import MongoQueryBuilder from "./MongoQueryBuilder";
import RealtimeDbBuilder from "../../Connections/RealtimeDb/RealtimeDbBuilder";
import FirestoreBuilder from "../../Connections/Firestore/FirestoreBuilder";
import GaBuilder from "../../Connections/GoogleAnalytics/GaBuilder";
import CustomerioBuilder from "../../Connections/Customerio/CustomerioBuilder";
import DatarequestSettings from "./DatarequestSettings";
import Container from "../../../components/Container";
import { ButtonSpinner } from "../../../components/ButtonSpinner";
import Row from "../../../components/Row";
import Text from "../../../components/Text";
import { useTheme } from "../../../modules/useTheme";

import {
  getDataRequestByDataset as getDataRequestByDatasetAction,
  createDataRequest as createDataRequestAction,
  updateDataRequest as updateDataRequestAction,
  deleteDataRequest as deleteDataRequestAction,
} from "../../../actions/dataRequest";
import connectionImages from "../../../config/connectionImages";
import {
  updateDataset as updateDatasetAction,
  runRequest as runRequestAction,
} from "../../../actions/dataset";
import { useParams } from "react-router";

function DatarequestModal(props) {
  const {
    open, onClose, dataset, getDataRequestByDataset,
    createDataRequest, updateDataRequest, chart,
    connections, deleteDataRequest, updateDataset, responses, stateDataRequests,
    datasetResponses, runRequest,
  } = props;

  const [initialising, setInitialising] = useState(false);
  const [dataRequests, setDataRequests] = useState([]);
  const [selectedRequest, setSelectedRequest] = useState(null);
  const [error, setError] = useState(null);
  const [createMode, setCreateMode] = useState(false);
  const [loading, setLoading] = useState(false);

  const { isDark } = useTheme();
  const theme = isDark ? "dark" : "light";
  const params = useParams();

  useEffect(() => {
    if (!open) {
      setDataRequests([]);
      return;
    }

    setInitialising(true);
    getDataRequestByDataset(params.projectId, params.chartId, dataset.id)
      .then((drs) => {
        setInitialising(false);
        setDataRequests(drs);
        if (drs.length > 0) {
          setSelectedRequest({ isSettings: true });
        }

        if (drs.length > 0 && !dataset.main_dr_id) {
          updateDataset(
            params.projectId,
            params.chartId,
            dataset.id,
            { main_dr_id: drs[0].id }
          );
        }
      })
      .catch((err) => {
        setInitialising(false);
        if (err && err.message === "404") {
          setCreateMode(true);
          return true;
        }
        setError("Cannot fetch the data request configuration. Try to refresh the page.");
        return err;
      });
  }, [open]);

  useEffect(() => {
    let message = error;
    if (error instanceof Error) {
      message = "Could not fetch data. Please check your query.";
    }

    if (error) {
      toast.error(message);
    }
  }, [error]);

  const _onClose = () => {
    onClose();
  };

  const _onBuildChart = () => {
    setLoading(true);
    // run the request of the dataset response is not available
    const datasetResponse = datasetResponses.find((d) => d.dataset_id === dataset.id);
    if (!datasetResponse) {
      runRequest(params.projectId, params.chartId, dataset.id, true)
        .catch(() => {});
    }

    setTimeout(() => {
      setLoading(false);
      onClose();
    }, 2000);
  };

  const _updateDataRequest = (newData) => {
    let newDr = newData;
    // transform the headers array
    if (newDr && newDr.formattedHeaders && newDr.formattedHeaders.length > 0) {
      const { formattedHeaders } = newDr;
      let newHeaders = {};
      for (let i = 0; i < formattedHeaders.length; i++) {
        if (formattedHeaders[i].key && formattedHeaders[i].value) {
          newHeaders = { [formattedHeaders[i].key]: formattedHeaders[i].value, ...newHeaders };
        }
      }

      newDr = { ...newDr, headers: newHeaders };
    }

    // update the item in the array
    const drIndex = _.findIndex(dataRequests, { id: newDr.id });
    if (drIndex > -1) {
      const newDrArray = _.cloneDeep(dataRequests);
      newDrArray[drIndex] = newDr;
      setDataRequests(newDrArray);
    }
  };

  const _onSaveRequest = (dr = selectedRequest) => {
    return updateDataRequest(
      params.projectId,
      params.chartId,
      dr.id,
      dr,
    )
      .then((savedDr) => {
        setSelectedRequest(savedDr);

        // if it's the first data request, update the main_dr_id
        if (dataRequests.length === 1 && !dataset.main_dr_id) {
          updateDataset({ main_dr_id: savedDr.id });
        }

        // update the dataRequests array and replace the item
        _updateDataRequest(savedDr);
      })
      .catch((e) => {
        setError(e);
        return e;
      });
  };

  const _onCreateNewRequest = (connection) => {
    return createDataRequest(params.projectId, params.chartId, {
      dataset_id: dataset.id,
      connection_id: connection.id,
    })
      .then((newDr) => {
        if (dataRequests.length < 1) {
          updateDataset(
            params.projectId,
            params.chartId,
            dataset.id,
            { main_dr_id: newDr.id },
          );
        }

        setSelectedRequest(newDr);
        setCreateMode(false);

        // update the dataRequests array
        const newDrArray = _.cloneDeep(dataRequests);
        newDrArray.push(newDr);
        setDataRequests(newDrArray);
      })
      .catch((e) => {
        toast.error("Could not create connection. Please try again or get in touch with us.");
        setError(e);
        return e;
      });
  };

  const _onSelectDataRequest = (dr) => {
    setSelectedRequest(dr);
    setCreateMode(false);
  };

  const _onDeleteRequest = (drId) => {
    if (selectedRequest) {
      deleteDataRequest(params.projectId, params.chartId, drId)
        .then(() => {
          // update the dataRequests array
          const newDrArray = _.cloneDeep(dataRequests);
          setDataRequests(newDrArray.filter((dr) => dr.id !== drId));
          setSelectedRequest(newDrArray[0]);
        })
        .catch((e) => {
          setError(e);
          return e;
        });
    }
  };

  const _onUpdateDataset = (data) => {
    return updateDataset(params.projectId, params.chartId, dataset.id, data)
      .then((newDataset) => {
        return newDataset;
      })
      .catch((e) => {
        setError(e);
        return e;
      });
  };

  const _onSelectSettings = () => {
    if (dataRequests.length === 0) {
      toast.info("You need to create a data request first.");
      return;
    }
    setSelectedRequest({ isSettings: true });
  };

  return (
    <Modal>
      <Modal.Backdrop
        isOpen={open}
        onOpenChange={(nextOpen) => {
          if (!nextOpen) _onClose();
        }}
        isDismissable={false}
      >
        <Modal.Container size="full" scroll="inside">
          <Modal.Dialog>
            <Modal.CloseTrigger />
            <Modal.Header className="flex justify-start">
          <Text size="h4">{"Configure your dataset"}</Text>
          {initialising && (
            <>
              <div className="w-2" />
              <ProgressCircle size="xl" aria-label="Loading dataset data" />
            </>
          )}
            </Modal.Header>
            <Modal.Body>
          <div className="grid grid-cols-12">
            <div className="col-span-12 md:col-span-1 flex flex-row md:flex-col border-none md:border-r md:border-solid md:border-content3 gap-2">
              {selectedRequest && (
                <>
                  <Row>
                    <Tooltip>
                      <Tooltip.Trigger>
                        <Link onPress={() => _onSelectSettings()} className="cursor-pointer">
                          <Avatar
                            className={`cursor-pointer rounded-sm ring-2 ${selectedRequest.isSettings ? "ring-primary" : "ring-default-200"}`}
                            color={selectedRequest.isSettings ? "primary" : "default"}
                          >
                            <Avatar.Fallback>
                              <LuLink2 />
                            </Avatar.Fallback>
                          </Avatar>
                        </Link>
                      </Tooltip.Trigger>
                      <Tooltip.Content placement="right start" className="z-[99999]">
                        Join data requests
                      </Tooltip.Content>
                    </Tooltip>
                  </Row>
                  <div className="h-4" />
                </>
              )}
              {dataRequests.map((dr, index) => (
                <Fragment key={dr.id}>
                  <Row align="center">
                    <Badge
                      variant={"faded"}
                      color={
                        responses.find((r) => r.id === dr.id)?.error
                          ? "danger"
                          : responses.find((r) => r.id === dr.id) ? "success" : "primary"
                      }
                      content={stateDataRequests.find((o) => o.id === dr.id)?.loading ? (<Spinner size="sm" />) : `${index + 1}`}
                      shape="rectangle"
                    >
                      <Avatar
                        className={`cursor-pointer rounded-sm ring-2 ${dr.id === selectedRequest?.id ? "ring-primary" : "ring-default-200"}`}
                        color={dr.id === selectedRequest?.id ? "primary" : "default"}
                        onClick={() => _onSelectDataRequest(dr)}
                      >
                        {dr.Connection ? (
                          <Avatar.Image
                            src={connectionImages(theme === "dark")[dr.Connection.subType || dr.Connection.type]}
                            alt=""
                          />
                        ) : null}
                        <Avatar.Fallback>{!dr.Connection ? <LuMonitorX /> : null}</Avatar.Fallback>
                      </Avatar>
                    </Badge>
                  </Row>
                  <div className="h-1" />
                </Fragment>
              ))}
              <div className="h-3" />
              <Row>
                <Tooltip>
                  <Tooltip.Trigger>
                    <Link onClick={() => setCreateMode(true)} className="cursor-pointer">
                      <Avatar className="cursor-pointer rounded-sm ring-2 ring-secondary" color="secondary">
                        <Avatar.Fallback>
                          <LuPlus />
                        </Avatar.Fallback>
                      </Avatar>
                    </Link>
                  </Tooltip.Trigger>
                  <Tooltip.Content placement="right start" className="z-[99999]">
                    Add a new data source
                  </Tooltip.Content>
                </Tooltip>
              </Row>
            </div>
            {!createMode && selectedRequest?.isSettings && (
              <div className="col-span-12 md:col-span-11">
                <DatarequestSettings
                  dataset={dataset}
                  dataRequests={dataRequests}
                  onChange={_onUpdateDataset}
                />
              </div>
            )}
            {!createMode && selectedRequest && selectedRequest.Connection && (
              <div className="col-span-12 md:col-span-11">
                {dataRequests.map((dr) => (
                  <Fragment key={dr.id}>
                    {selectedRequest.Connection.type === "api" && selectedRequest.id === dr.id && (
                      <ApiBuilder
                        dataRequest={dr}
                        connection={dr.Connection}
                        onChangeRequest={_updateDataRequest}
                        onSave={_onSaveRequest}
                        chart={chart}
                        onDelete={() => _onDeleteRequest(dr.id)}
                      />
                    )}
                    {(selectedRequest.Connection.type === "mysql" || selectedRequest.Connection.type === "postgres") && selectedRequest.id === dr.id && (
                      <SqlBuilder
                        dataRequest={dr}
                        connection={dr.Connection}
                        onChangeRequest={_updateDataRequest}
                        onSave={_onSaveRequest}
                        onDelete={() => _onDeleteRequest(dr.id)}
                      />
                    )}
                    {selectedRequest.Connection.type === "mongodb" && selectedRequest.id === dr.id && (
                      <MongoQueryBuilder
                        dataRequest={dr}
                        connection={dr.Connection}
                        onChangeRequest={_updateDataRequest}
                        onSave={_onSaveRequest}
                        onDelete={() => _onDeleteRequest(dr.id)}
                      />
                    )}
                    {selectedRequest.Connection.type === "realtimedb" && selectedRequest.id === dr.id && (
                      <RealtimeDbBuilder
                        dataRequest={dr}
                        connection={dr.Connection}
                        onChangeRequest={_updateDataRequest}
                        onSave={_onSaveRequest}
                        onDelete={() => _onDeleteRequest(dr.id)}
                      />
                    )}
                    {selectedRequest.Connection.type === "firestore" && selectedRequest.id === dr.id && (
                      <FirestoreBuilder
                        dataRequest={dr}
                        connection={dr.Connection}
                        onChangeRequest={_updateDataRequest}
                        onSave={_onSaveRequest}
                        onDelete={() => _onDeleteRequest(dr.id)}
                      />
                    )}
                    {selectedRequest.Connection.type === "googleAnalytics" && selectedRequest.id === dr.id && (
                      <GaBuilder
                        dataRequest={dr}
                        connection={dr.Connection}
                        onChangeRequest={_updateDataRequest}
                        onSave={_onSaveRequest}
                        onDelete={() => _onDeleteRequest(dr.id)}
                      />
                    )}
                    {selectedRequest.Connection.type === "customerio" && selectedRequest.id === dr.id && (
                      <CustomerioBuilder
                        dataRequest={dr}
                        connection={dr.Connection}
                        onChangeRequest={_updateDataRequest}
                        onSave={_onSaveRequest}
                        onDelete={() => _onDeleteRequest(dr.id)}
                      />
                    )}
                  </Fragment>
                ))}
              </div>
            )}
            {createMode && (
              <div className="col-span-12 md:col-span-11 container mx-auto">
                <div className="h-2" />
                <Text size="h4">Select a connection</Text>
                <div className="h-4" />
                <div className="grid grid-cols-12 gap-4">
                  {connections.map((c) => {
                    return (
                      <div className="col-span-12 sm:col-span-6 md:sm:col-span-4" key={c.id}>
                        <Card
                          role="button"
                          tabIndex={0}
                          onClick={() => _onCreateNewRequest(c)}
                          onKeyDown={(e) => {
                            if (e.key === "Enter" || e.key === " ") {
                              e.preventDefault();
                              _onCreateNewRequest(c);
                            }
                          }}
                          className="w-full cursor-pointer border-1 border-solid border-content3 shadow-none transition-colors hover:bg-content2/40"
                        >
                          <Card.Content className="p-4 pl-unit-8">
                            <Row align="center" justify="space-between">
                              <Text size="h4">{c.name}</Text>
                              <div className="w-1" />
                              <Avatar className="rounded-sm">
                                <Avatar.Image
                                  src={connectionImages(theme === "dark")[c.subType || c.type]}
                                  alt={`${c.type} logo`}
                                />
                                <Avatar.Fallback />
                              </Avatar>
                            </Row>
                            <Row>
                              <Text className={"text-default-400"} size="sm">
                                {`Created on ${moment(c.createdAt).format("LLL")}`}
                              </Text>
                            </Row>
                          </Card.Content>
                          <Card.Footer>
                            <Container>
                              <Row justify="center">
                                <Button
                                  variant="flat"
                                  onClick={() => _onCreateNewRequest(c)}
                                  size="sm"
                                  fullWidth
                                >
                                  Select
                                </Button>
                              </Row>
                            </Container>
                          </Card.Footer>
                        </Card>
                      </div>
                    );
                  })}
                </div>
              </div>
            )}
          </div>
            </Modal.Body>
            <Modal.Footer className="bg-content1">
          <Button
            auto
            onClick={() => onClose()}
            color="warning"
            variant="flat"
          >
            Close
          </Button>
          <Button
            onPress={() => _onBuildChart()}
            color="primary"
            isPending={loading}
            startContent={loading ? <ButtonSpinner /> : undefined}
          >
            {"Build the chart"}
          </Button>
            </Modal.Footer>
          </Modal.Dialog>
        </Modal.Container>
      </Modal.Backdrop>
    </Modal>
  );
}

DatarequestModal.defaultProps = {
  open: false,
};

DatarequestModal.propTypes = {
  open: PropTypes.bool,
  onClose: PropTypes.func.isRequired,
  dataset: PropTypes.object.isRequired,
  getDataRequestByDataset: PropTypes.func.isRequired,
  createDataRequest: PropTypes.func.isRequired,
  updateDataRequest: PropTypes.func.isRequired,
  requests: PropTypes.array.isRequired,
  chart: PropTypes.object.isRequired,
  connections: PropTypes.array.isRequired,
  deleteDataRequest: PropTypes.func.isRequired,
  updateDataset: PropTypes.func.isRequired,
  responses: PropTypes.array.isRequired,
  stateDataRequests: PropTypes.array.isRequired,
  datasetResponses: PropTypes.array.isRequired,
  runRequest: PropTypes.func.isRequired,
};

const mapStateToProps = (state) => {
  return {
    requests: state.dataset.requests,
    connections: state.connection.data,
    responses: state.dataRequest.responses,
    stateDataRequests: state.dataRequest.data,
    datasetResponses: state.dataset.responses,
  };
};

const mapDispatchToProps = (dispatch) => {
  return {
    getDataRequestByDataset: (projectId, chartId, datasetId) => {
      return dispatch(getDataRequestByDatasetAction(projectId, chartId, datasetId));
    },
    createDataRequest: (projectId, chartId, data) => {
      return dispatch(createDataRequestAction(projectId, chartId, data));
    },
    updateDataRequest: (projectId, chartId, drId, data) => {
      return dispatch(updateDataRequestAction(projectId, chartId, drId, data));
    },
    deleteDataRequest: (projectId, chartId, drId) => {
      return dispatch(deleteDataRequestAction(projectId, chartId, drId));
    },
    updateDataset: (projectId, chartId, datasetId, data) => {
      return dispatch(updateDatasetAction(projectId, chartId, datasetId, data));
    },
    runRequest: (projectId, chartId, datasetId, getCache) => {
      return dispatch(runRequestAction(projectId, chartId, datasetId, getCache));
    },
  };
};

export default connect(mapStateToProps, mapDispatchToProps)(DatarequestModal);
