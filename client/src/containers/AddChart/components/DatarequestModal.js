import React, { useState, useEffect } from "react";
import PropTypes from "prop-types";
import { connect } from "react-redux";
import { withRouter } from "react-router";
import _ from "lodash";
import { toast } from "react-toastify";
import {
  Button, Container, Grid, Link, Loading, Modal, Row, Spacer, Text, Avatar,
  useTheme,
  Tooltip,
  Card,
} from "@nextui-org/react";
import { Plus } from "react-iconly";
import moment from "moment";

import ApiBuilder from "./ApiBuilder";
import SqlBuilder from "./SqlBuilder";
import MongoQueryBuilder from "./MongoQueryBuilder";
import RealtimeDbBuilder from "../../Connections/RealtimeDb/RealtimeDbBuilder";
import FirestoreBuilder from "../../Connections/Firestore/FirestoreBuilder";
import GaBuilder from "../../Connections/GoogleAnalytics/GaBuilder";
import CustomerioBuilder from "../../Connections/Customerio/CustomerioBuilder";

import {
  getDataRequestByDataset as getDataRequestByDatasetAction,
  createDataRequest as createDataRequestAction,
  updateDataRequest as updateDataRequestAction,
} from "../../../actions/dataRequest";
import { changeTutorial as changeTutorialAction } from "../../../actions/tutorial";
import connectionImages from "../../../config/connectionImages";
import { primaryTransparent } from "../../../config/colors";

function DatarequestModal(props) {
  const {
    open, onClose, dataset, match, getDataRequestByDataset,
    createDataRequest, updateDataRequest, requests, changeTutorial, updateResult, chart,
    connections,
  } = props;

  const [dataRequests, setDataRequests] = useState(null);
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
      setDataRequests(null);
      return;
    }
    let fetched = false;
    getDataRequestByDataset(match.params.projectId, match.params.chartId, dataset.id)
      .then((drs) => {
        fetched = true;
        setDataRequests(drs);
        if (!selectedRequest) {
          setSelectedRequest(drs[0]);
        }

        setTimeout(() => {
          setSaved(true);
        }, 100);
      })
      .catch((err) => {
        if (err && err.message === "404") {
          return createDataRequest(match.params.projectId, match.params.chartId, {
            dataset_id: dataset.id,
          });
        }
        setError("Cannot fetch the data request configuration. Try to refresh the page.");
        return err;
      })
      .then((dr) => {
        if (!fetched && dr) {
          setDataRequests([dr]);
          setTimeout(() => {
            setSaved(true);
          }, 100);
        }
      })
      .catch(() => {
        setError("Cannot fetch the data request configuration. Try to refresh the page.");
      });
  }, [open, dataset]);

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
        setDataRequests(savedDr);

        setTimeout(() => {
          setSaved(true);
        }, 100);

        return savedDr;
      })
      .catch((e) => {
        setLoading(false);
        setError(e);
        return e;
      });
  };

  const _onCreateNewRequest = () => {
    setCreateMode(false);
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
        {!dataRequests && (
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
            {selectedRequest && dataRequests && dataRequests.map((dr) => (
              <Avatar
                key={dr.id}
                bordered
                squared
                src={connectionImages(isDark)[dr.Connection.type]}
                size="lg"
                color={dr.id === selectedRequest.id ? "gradient" : "default"}
              />
            ))}
            <Spacer y={0.3} />
            <Tooltip content="Join with a new dataset" css={{ zIndex: 99999 }} placement="rightStart">
              <Link onClick={() => setCreateMode(true)} css={{ cursor: "pointer" }}>
                <Avatar
                  icon={<Plus primaryColor={primaryTransparent(1)} />}
                  bordered
                  squared
                  size="lg"
                  css={{ cursor: "pointer" }}
                />
              </Link>
            </Tooltip>
          </Grid>
          {!createMode && selectedRequest?.Connection && (
            <Grid xs={12} sm={11.5}>
              {selectedRequest.Connection.type === "api" && selectedRequest && (
                <ApiBuilder
                  dataset={dataset}
                  dataRequest={selectedRequest}
                  connection={selectedRequest.Connection}
                  onChangeRequest={_updateDataRequest}
                  onSave={_onSaveRequest}
                  exploreData={result && JSON.stringify(result.data, null, 2)}
                  chart={chart}
                />
              )}
              {(selectedRequest.Connection.type === "mysql" || selectedRequest.Connection.type === "postgres") && selectedRequest && (
                <SqlBuilder
                  dataset={dataset}
                  dataRequest={selectedRequest}
                  connection={selectedRequest.Connection}
                  onChangeRequest={_updateDataRequest}
                  onSave={_onSaveRequest}
                  exploreData={result && JSON.stringify(result.data, null, 2)}
                />
              )}
              {selectedRequest.Connection.type === "mongodb" && selectedRequest && (
                <MongoQueryBuilder
                  dataset={dataset}
                  dataRequest={selectedRequest}
                  onChangeRequest={_updateDataRequest}
                  onSave={_onSaveRequest}
                  exploreData={result && JSON.stringify(result.data, null, 2)}
                />
              )}
              {selectedRequest.Connection.type === "realtimedb" && selectedRequest && (
                <RealtimeDbBuilder
                  dataset={dataset}
                  dataRequest={selectedRequest}
                  connection={selectedRequest.Connection}
                  onChangeRequest={_updateDataRequest}
                  onSave={_onSaveRequest}
                  exploreData={result && JSON.stringify(result.data, null, 2)}
                />
              )}
              {selectedRequest.Connection.type === "firestore" && selectedRequest && (
                <FirestoreBuilder
                  dataset={dataset}
                  dataRequest={selectedRequest}
                  connection={selectedRequest.Connection}
                  onChangeRequest={_updateDataRequest}
                  onSave={_onSaveRequest}
                  exploreData={result && JSON.stringify(result.data, null, 2)}
                />
              )}
              {selectedRequest.Connection.type === "googleAnalytics" && selectedRequest && (
                <GaBuilder
                  dataset={dataset}
                  dataRequest={selectedRequest}
                  connection={selectedRequest.Connection}
                  onChangeRequest={_updateDataRequest}
                  onSave={_onSaveRequest}
                  exploreData={result && JSON.stringify(result.data, null, 2)}
                />
              )}
              {selectedRequest.Connection.type === "customerio" && selectedRequest && (
                <CustomerioBuilder
                  dataset={dataset}
                  dataRequest={selectedRequest}
                  connection={selectedRequest.Connection}
                  onChangeRequest={_updateDataRequest}
                  onSave={_onSaveRequest}
                  exploreData={result && JSON.stringify(result.data, null, 2)}
                />
              )}
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
                    <Grid xs={12} sm={3} md={4} key={c.id}>
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
                              <img
                                width="50px"
                                height="50px"
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
  };
};

export default withRouter(connect(mapStateToProps, mapDispatchToProps)(DatarequestModal));
