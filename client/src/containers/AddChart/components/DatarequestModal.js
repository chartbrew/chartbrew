import React, { useState, useEffect } from "react";
import PropTypes from "prop-types";
import { connect } from "react-redux";
import { withRouter } from "react-router";
import {
  Modal, Button, Loader, Container, Placeholder, Message,
} from "semantic-ui-react";

import ApiBuilder from "./ApiBuilder";
import {
  getDataRequestByDataset as getDataRequestByDatasetAction,
  createDataRequest as createDataRequestAction,
} from "../../../actions/dataRequest";

function DatarequestModal(props) {
  const {
    open, onClose, connection, dataset, match,
    getDataRequestByDataset, createDataRequest,
  } = props;

  const [dataRequest, setDataRequest] = useState(null);
  const [error, setError] = useState("");

  useEffect(() => {
    if (!open) {
      setDataRequest({});
      return;
    }
    let fetched = false;
    getDataRequestByDataset(match.params.projectId, match.params.chartId, dataset.id)
      .then((result) => {
        fetched = true;
        setDataRequest(result);
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
      .then((result) => {
        if (!fetched && result) {
          setDataRequest(result);
        }
      })
      .catch(() => {
        setError("Cannot fetch the data request configuration. Try to refresh the page.");
      });
  }, [open, dataset]);

  const _onClose = () => {
    onClose();
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
        {error && (
          <Message>
            <Message.Header>Could not fetch the data request</Message.Header>
            <p>Please try refreshing the page.</p>
          </Message>
        )}
        {connection.type === "api" && dataRequest && (
          <ApiBuilder
            dataRequest={dataRequest}
            connection={connection}
          />
        )}
      </Modal.Content>
      <Modal.Actions>
        <Button onClick={_onClose} basic>Close</Button>
        <Button primary onClick={() => {}}>Save</Button>
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
};

const mapStateToProps = () => {
  return {
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
  };
};

export default withRouter(connect(mapStateToProps, mapDispatchToProps)(DatarequestModal));
