import React, { useState, useEffect, Fragment } from "react";
import PropTypes from "prop-types";
import { connect } from "react-redux";
import { withRouter } from "react-router";
import _ from "lodash";
import { toast } from "react-toastify";
import {
  Button, Container, Grid, Link, Loading, Modal, Row, Spacer, Text, Avatar,
  useTheme, Tooltip, Card, theme,
} from "@nextui-org/react";
import {
  Danger, Plus, Setting,
} from "react-iconly";
import moment from "moment";

import ApiBuilder from "./ApiBuilder";
import SqlBuilder from "./SqlBuilder";
import MongoQueryBuilder from "./MongoQueryBuilder";
import RealtimeDbBuilder from "../../Connections/RealtimeDb/RealtimeDbBuilder";
import FirestoreBuilder from "../../Connections/Firestore/FirestoreBuilder";
import GaBuilder from "../../Connections/GoogleAnalytics/GaBuilder";
import CustomerioBuilder from "../../Connections/Customerio/CustomerioBuilder";
import DatarequestSettings from "./DatarequestSettings";

import {
  getDataRequestByDataset as getDataRequestByDatasetAction,
  createDataRequest as createDataRequestAction,
  updateDataRequest as updateDataRequestAction,
  deleteDataRequest as deleteDataRequestAction,
} from "../../../actions/dataRequest";
import { changeTutorial as changeTutorialAction } from "../../../actions/tutorial";
import connectionImages from "../../../config/connectionImages";

function DatarequestModal(props) {
  const {
    open, onClose, dataset, match, getDataRequestByDataset,
    createDataRequest, updateDataRequest, requests, changeTutorial, updateResult, chart,
    connections, deleteDataRequest,
  } = props;

  const [initialising, setInitialising] = useState(false);
  const [dataRequests, setDataRequests] = useState([]);
  const [selectedRequest, setSelectedRequest] = useState(null);
  const [loading, setLoading] = useState(false);
  const [saved, setSaved] = useState(false);
  const [error, setError] = useState(null);
  const [closeTrigger, setCloseTrigger] = useState(false);
  const [result, setResult] = useState(null);
  const [createMode, setCreateMode] = useState(false);

  const { isDark } = useTheme();

  useEffect(() => {
    if (!open) {
      setDataRequests([]);
      return;
    }

    setInitialising(true);
    getDataRequestByDataset(match.params.projectId, match.params.chartId, dataset.id)
      .then((drs) => {
        setInitialising(false);
        setDataRequests(drs);
        if (!selectedRequest) {
          setSelectedRequest(drs[0]);
        }

        setTimeout(() => {
          setSaved(true);
        }, 100);
      })
      .catch((err) => {
        setInitialising(false);
        if (err && err.message === "404") {
          setCreateMode(true);
          setSaved(true);
          return true;
        }
        setError("Cannot fetch the data request configuration. Try to refresh the page.");
        return err;
      });
  }, [open]);

  useEffect(() => {
    setSaved(false);
  }, [dataRequests]);

  useEffect(() => {
    const request = _.find(requests, { options: { id: dataset.id } });
    setResult(request);
    if (open && selectedRequest?.Connection?.type !== "firestore") changeTutorial("requestmodal");
  }, [requests, dataset]);

  useEffect(() => {
    let message = error;
    if (error instanceof Error) {
      message = "Could not fetch data. Please check your query.";
    }

    if (error) {
      toast.error(message);
    }
  }, [error]);

  useEffect(() => {
    updateResult(result);
  }, [result]);

  useEffect(() => {
    if (saved) setCloseTrigger(false);
  }, [saved]);

  const _onClose = () => {
    if (saved || closeTrigger) {
      setCloseTrigger(false);
      onClose();
    } else if (!saved) {
      setCloseTrigger(true);
    }
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
    setLoading(true);
    return updateDataRequest(
      match.params.projectId,
      match.params.chartId,
      dr.id,
      dr,
    )
      .then((savedDr) => {
        setLoading(false);
        setSelectedRequest(savedDr);

        setTimeout(() => {
          setSaved(true);
        }, 100);

        // update the dataRequests array and replace the item
        _updateDataRequest(savedDr);
      })
      .catch((e) => {
        setLoading(false);
        setError(e);
        return e;
      });
  };

  const _onCreateNewRequest = (connection) => {
    return createDataRequest(match.params.projectId, match.params.chartId, {
      dataset_id: dataset.id,
      connection_id: connection.id,
    })
      .then((newDr) => {
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
      setLoading(true);
      deleteDataRequest(match.params.projectId, match.params.chartId, drId)
        .then(() => {
          setLoading(false);
          // update the dataRequests array
          const newDrArray = _.cloneDeep(dataRequests);
          setDataRequests(newDrArray.filter((dr) => dr.id !== drId));
          setSelectedRequest(newDrArray[0]);
        })
        .catch((e) => {
          setLoading(false);
          setError(e);
          return e;
        });
    }
  };

  return (
    <Modal
      open={open}
      fullScreen
      onClose={_onClose}
      closeButton
    >
      <Modal.Header justify="flex-start">
        <Text h4>{"Configure your dataset"}</Text>
      </Modal.Header>
      <Modal.Body>
        {initialising && (
          <Container>
            <Spacer y={4} />
            <Row align="center" justify="center">
              <Loading type="points" color="currentColor" size="xl" />
            </Row>
            <Spacer y={1} />
            <Row align="center" justify="center">
              <Text size="1.4em" css={{ color: "$accents7" }}>Preparing the data request...</Text>
            </Row>
          </Container>
        )}
        <Grid.Container>
          <Grid xs={12} sm={0.5} direction="column">
            {selectedRequest && (
              <>
                <Tooltip content="Dataset settings" css={{ zIndex: 99999 }} placement="rightStart">
                  <Link onClick={() => setSelectedRequest({ isSettings: true })} css={{ cursor: "pointer" }}>
                    <Avatar
                      icon={<Setting primaryColor={theme.colors.text.value} set="bold" />}
                      squared
                      size="lg"
                      css={{ cursor: "pointer" }}
                      color={selectedRequest.isSettings ? "primary" : "default"}
                    />
                  </Link>
                </Tooltip>
                <Spacer y={1} />
              </>
            )}
            {dataRequests.map((dr) => (
              <>
                <Avatar
                  key={dr.id}
                  bordered
                  squared
                  src={dr.Connection ? connectionImages(isDark)[dr.Connection.type] : null}
                  icon={!dr.Connection ? <Danger /> : null}
                  size="lg"
                  color={dr.id === selectedRequest?.id ? "primary" : "default"}
                  onClick={() => _onSelectDataRequest(dr)}
                />
                <Spacer y={0.3} />
              </>
            ))}
            <Spacer y={0.7} />
            <Tooltip content="Join with a new dataset" css={{ zIndex: 99999 }} placement="rightStart">
              <Link onClick={() => setCreateMode(true)} css={{ cursor: "pointer" }}>
                <Avatar
                  icon={<Plus primaryColor={theme.colors.text.value} />}
                  bordered
                  squared
                  size="lg"
                  css={{ cursor: "pointer" }}
                />
              </Link>
            </Tooltip>
          </Grid>
          {!createMode && selectedRequest?.isSettings && (
            <Grid xs={12} sm={11.5}>
              <DatarequestSettings />
            </Grid>
          )}
          {!createMode && selectedRequest && selectedRequest.Connection && (
            <Grid xs={12} sm={11.5}>
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
            </Grid>
          )}
          {createMode && (
            <Grid xs={12} sm={11.5} direction="column">
              <Spacer y={0.5} />
              <Container>
                <Text h4>Select a connection</Text>
              </Container>
              <Spacer y={0.5} />
              <Grid.Container gap={2}>
                {connections.map((c) => {
                  return (
                    <Grid xs={12} sm={6} md={4} key={c.id}>
                      <Card
                        variant="bordered"
                        isPressable
                        isHoverable
                        className="project-segment"
                        onClick={() => _onCreateNewRequest(c)}
                      >
                        <Card.Body css={{ p: "$4", pl: "$8" }}>
                          <Container justify="flex-start" fluid>
                            <Row align="center" justify="space-between">
                              <Text h4>{c.name}</Text>
                              <Spacer x={0.2} />
                              <Avatar
                                squared
                                src={connectionImages(isDark)[c.type]}
                                alt={`${c.type} logo`}
                              />
                            </Row>
                            <Row>
                              <Text css={{ color: "$accents7" }}>
                                {`Created on ${moment(c.createdAt).format("LLL")}`}
                              </Text>
                            </Row>
                          </Container>
                        </Card.Body>
                        <Card.Footer>
                          <Container>
                            <Row justify="center">
                              <Button
                                flat
                                onClick={() => _onCreateNewRequest(c)}
                                size="sm"
                                css={{ width: "100%" }}
                              >
                                Select
                              </Button>
                            </Row>
                          </Container>
                        </Card.Footer>
                      </Card>
                    </Grid>
                  );
                })}
              </Grid.Container>
            </Grid>
          )}
        </Grid.Container>
      </Modal.Body>
      <Modal.Footer>
        {dataRequests && dataRequests.length > 0 && (
          <Button
            flat
            color={saved ? "success" : "secondary"}
            onClick={() => _onSaveRequest()}
            disabled={loading}
            auto
          >
            {saved && !loading ? "Saved" : "Save"}
            {loading && <Loading type="points" />}
          </Button>
        )}
        {closeTrigger && <Text small>Are you sure? Your settings are not saved</Text>}
        <Button
          flat
          color={closeTrigger ? "error" : "primary"}
          onClick={_onClose}
          auto
        >
          Build the chart
        </Button>
      </Modal.Footer>
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
  match: PropTypes.object.isRequired,
  createDataRequest: PropTypes.func.isRequired,
  updateDataRequest: PropTypes.func.isRequired,
  requests: PropTypes.array.isRequired,
  changeTutorial: PropTypes.func.isRequired,
  updateResult: PropTypes.func.isRequired,
  chart: PropTypes.object.isRequired,
  connections: PropTypes.array.isRequired,
  deleteDataRequest: PropTypes.func.isRequired,
};

const mapStateToProps = (state) => {
  return {
    requests: state.dataset.requests,
    connections: state.connection.data,
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
    changeTutorial: (tutorial) => dispatch(changeTutorialAction(tutorial)),
    deleteDataRequest: (projectId, chartId, drId) => {
      return dispatch(deleteDataRequestAction(projectId, chartId, drId));
    },
  };
};

export default withRouter(connect(mapStateToProps, mapDispatchToProps)(DatarequestModal));
