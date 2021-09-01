import React, { useState, useEffect } from "react";
import PropTypes from "prop-types";
import { connect } from "react-redux";
import { withRouter } from "react-router";
import {
  Modal, Button, Loader, Container, Placeholder,
} from "semantic-ui-react";
import cloneDeep from "lodash/cloneDeep";
import { toast } from "react-toastify";

import ApiBuilder from "./ApiBuilder";
import SqlBuilder from "./SqlBuilder";
import MongoQueryBuilder from "./MongoQueryBuilder";
import FirebaseBuilder from "../../Connections/Firebase/FirebaseBuilder";
import FirestoreBuilder from "../../Connections/Firestore/FirestoreBuilder";
import GaBuilder from "../../Connections/GoogleAnalytics/GaBuilder";

import {
  getDataRequestByDataset as getDataRequestByDatasetAction,
  createDataRequest as createDataRequestAction,
  updateDataRequest as updateDataRequestAction,
} from "../../../actions/dataRequest";
import { changeTutorial as changeTutorialAction } from "../../../actions/tutorial";

function DatarequestModal(props) {
  const {
    open, onClose, connection, dataset, match, getDataRequestByDataset,
    createDataRequest, updateDataRequest, requests, changeTutorial, updateResult, chart,
  } = props;

  const [dataRequest, setDataRequest] = useState(null);
  const [loading, setLoading] = useState(false);
  const [saved, setSaved] = useState(false);
  const [error, setError] = useState(null);
  const [closeTrigger, setCloseTrigger] = useState(false);
  const [result, setResult] = useState(null);

  useEffect(() => {
    if (!open) {
      setDataRequest(null);
      return;
    }
    let fetched = false;
    getDataRequestByDataset(match.params.projectId, match.params.chartId, dataset.id)
      .then((dr) => {
        fetched = true;
        setDataRequest(dr);

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
          setDataRequest(dr);
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
  }, [dataRequest]);

  useEffect(() => {
    const request = requests.find(request === request.options.id === dataset.id);
    setResult(request);
    if (open && connection.type !== "firestore") changeTutorial("requestmodal");
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

    setDataRequest(newDr);
  };

  const _onSaveRequest = (dr = dataRequest) => {
    setLoading(true);
    const newDr = cloneDeep(dr);
    return updateDataRequest(
      match.params.projectId,
      match.params.chartId,
      newDr.id,
      newDr
    )
      .then((savedDr) => {
        setLoading(false);
        setDataRequest(savedDr);

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

  return (
    <Modal
      open={open}
      size="fullscreen"
      onClose={_onClose}
      closeOnDimmerClick={false}
      closeOnEscape={false}
    >
      <Modal.Header>{`Configure ${connection.name}`}</Modal.Header>
      <Modal.Content>
        {!dataRequest && (
          <Container>
            <Loader active inverted>Loading</Loader>
            <Placeholder>
              <Placeholder.Line />
              <Placeholder.Line />
              <Placeholder.Line />
              <Placeholder.Line />
              <Placeholder.Line />
            </Placeholder>
          </Container>
        )}
        {connection.type === "api" && dataRequest && (
          <ApiBuilder
            dataset={dataset}
            dataRequest={dataRequest}
            connection={connection}
            onChangeRequest={_updateDataRequest}
            onSave={_onSaveRequest}
            exploreData={result && JSON.stringify(result.data, null, 2)}
            chart={chart}
          />
        )}
        {(connection.type === "mysql" || connection.type === "postgres") && dataRequest && (
          <SqlBuilder
            dataset={dataset}
            dataRequest={dataRequest}
            connection={connection}
            onChangeRequest={_updateDataRequest}
            onSave={_onSaveRequest}
            exploreData={result && JSON.stringify(result.data, null, 2)}
          />
        )}
        {connection.type === "mongodb" && dataRequest && (
          <MongoQueryBuilder
            dataset={dataset}
            dataRequest={dataRequest}
            onChangeRequest={_updateDataRequest}
            onSave={_onSaveRequest}
            exploreData={result && JSON.stringify(result.data, null, 2)}
          />
        )}
        {connection.type === "firebase" && dataRequest && (
          <FirebaseBuilder
            dataset={dataset}
            dataRequest={dataRequest}
            connection={connection}
            onChangeRequest={_updateDataRequest}
            onSave={_onSaveRequest}
            exploreData={result && JSON.stringify(result.data, null, 2)}
          />
        )}
        {connection.type === "firestore" && dataRequest && (
          <FirestoreBuilder
            dataset={dataset}
            dataRequest={dataRequest}
            connection={connection}
            onChangeRequest={_updateDataRequest}
            onSave={_onSaveRequest}
            exploreData={result && JSON.stringify(result.data, null, 2)}
          />
        )}
        {connection.type === "googleAnalytics" && dataRequest && (
          <GaBuilder
            dataset={dataset}
            dataRequest={dataRequest}
            connection={connection}
            onChangeRequest={_updateDataRequest}
            onSave={_onSaveRequest}
            exploreData={result && JSON.stringify(result.data, null, 2)}
          />
        )}
      </Modal.Content>
      <Modal.Actions>
        <Button
          secondary={!saved}
          positive={saved}
          onClick={() => _onSaveRequest()}
          loading={loading}
        >
          {saved ? "Saved" : "Save"}
        </Button>
        {closeTrigger && <span>Are you sure? Your settings are not saved</span>}
        <Button
          negative={closeTrigger}
          onClick={_onClose}
          primary
        >
          Build the chart
        </Button>
      </Modal.Actions>
    </Modal>
  );
}

DatarequestModal.defaultProps = {
  open: false,
};

DatarequestModal.propTypes = {
  open: PropTypes.bool,
  onClose: PropTypes.func.isRequired,
  connection: PropTypes.object.isRequired,
  dataset: PropTypes.object.isRequired,
  getDataRequestByDataset: PropTypes.func.isRequired,
  match: PropTypes.object.isRequired,
  createDataRequest: PropTypes.func.isRequired,
  updateDataRequest: PropTypes.func.isRequired,
  requests: PropTypes.array.isRequired,
  changeTutorial: PropTypes.func.isRequired,
  updateResult: PropTypes.func.isRequired,
  chart: PropTypes.object.isRequired,
};

const mapStateToProps = (state) => {
  return {
    requests: state.dataset.requests,
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
