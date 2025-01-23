import React, { useState, useEffect, Fragment } from "react";
import PropTypes from "prop-types";
import { connect } from "react-redux";
import _ from "lodash";
import toast from "react-hot-toast";
import {
  Button, Link, Modal, Spacer, Avatar, Badge, Tooltip, Card,
  CircularProgress, ModalHeader, ModalBody, ModalFooter, CardBody,
  CardFooter, ModalContent, Spinner,
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
    <Modal
      isOpen={open}
      size="full"
      onClose={_onClose}
      closeButton
      isDismissable={false}
      scrollBehavior="inside"
      shouldBlockScroll={false}
    >
      <ModalContent>
        <ModalHeader className="flex justify-start">
          <Text size="h4">{"Configure your dataset"}</Text>
          {initialising && (
            <>
              <Spacer x={1} />
              <CircularProgress size="xl" aria-label="Loading dataset data" />
            </>
          )}
        </ModalHeader>
        <ModalBody>
          <div className="grid grid-cols-12">
            <div className="col-span-12 md:col-span-1 flex flex-row md:flex-col border-none md:border-r-1 md:border-solid md:border-content3 gap-2">
              {selectedRequest && (
                <>
                  <Row>
                    <Tooltip content="Join data requests" css={{ zIndex: 99999 }} placement="right-start">
                      <Link onPress={() => _onSelectSettings()} className="cursor-pointer">
                        <Avatar
                          isBordered
                          icon={(
                            <LuLink2 />
                          )}
                          radius="sm"
                          className="cursor-pointer"
                          color={selectedRequest.isSettings ? "primary" : "default"}
                        />
                      </Link>
                    </Tooltip>
                  </Row>
                  <Spacer y={2} />
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
                        isBordered
                        radius="sm"
                        src={
                          dr.Connection
                            ? connectionImages(theme === "dark")[dr.Connection.subType || dr.Connection.type]
                            : null
                        }
                        icon={!dr.Connection ? <LuMonitorX /> : null}
                        color={dr.id === selectedRequest?.id ? "primary" : "default"}
                        onClick={() => _onSelectDataRequest(dr)}
                      />
                    </Badge>
                  </Row>
                  <Spacer y={0.6} />
                </Fragment>
              ))}
              <Spacer y={1.5} />
              <Row>
                <Tooltip content="Add a new data source" css={{ zIndex: 99999 }} placement="right-start">
                  <Link onClick={() => setCreateMode(true)} className="cursor-pointer">
                    <Avatar
                      icon={<LuPlus />}
                      isBordered
                      className="cursor-pointer"
                      color="secondary"
                    />
                  </Link>
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
                <Spacer y={1} />
                <Text size="h4">Select a connection</Text>
                <Spacer y={2} />
                <div className="grid grid-cols-12 gap-4">
                  {connections.map((c) => {
                    return (
                      <div className="col-span-12 sm:col-span-6 md:sm:col-span-4" key={c.id}>
                        <Card
                          variant="bordered"
                          isPressable
                          isHoverable
                          onClick={() => _onCreateNewRequest(c)}
                          fullWidth
                        >
                          <CardBody className="p-4 pl-unit-8">
                            <Row align="center" justify="space-between">
                              <Text size="h4">{c.name}</Text>
                              <Spacer x={0.5} />
                              <Avatar
                                radius="sm"
                                src={connectionImages(theme === "dark")[c.subType || c.type]}
                                alt={`${c.type} logo`}
                              />
                            </Row>
                            <Row>
                              <Text className={"text-default-400"} size="sm">
                                {`Created on ${moment(c.createdAt).format("LLL")}`}
                              </Text>
                            </Row>
                          </CardBody>
                          <CardFooter>
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
                          </CardFooter>
                        </Card>
                      </div>
                    );
                  })}
                </div>
              </div>
            )}
          </div>
        </ModalBody>
        <ModalFooter className="bg-content1">
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
            isLoading={loading}
          >
            {"Build the chart"}
          </Button>
        </ModalFooter>
      </ModalContent>
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
