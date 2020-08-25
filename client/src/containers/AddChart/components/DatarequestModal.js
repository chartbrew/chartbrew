import React, { useState, useEffect } from "react";
import PropTypes from "prop-types";
import { connect } from "react-redux";
import { withRouter } from "react-router";
import {
  Modal, Button, Loader, Container, Placeholder, Icon,
  Grid, Header, Label, Popup,
} from "semantic-ui-react";
import _ from "lodash";
import { toast } from "react-toastify";
import brace from "brace"; // eslint-disable-line
import AceEditor from "react-ace";
import "brace/mode/json";
import "brace/theme/tomorrow";

import ApiBuilder from "./ApiBuilder";
import SqlBuilder from "./SqlBuilder";
import MongoQueryBuilder from "./MongoQueryBuilder";
import ObjectExplorer from "./ObjectExplorer";
import {
  getDataRequestByDataset as getDataRequestByDatasetAction,
  createDataRequest as createDataRequestAction,
  updateDataRequest as updateDataRequestAction,
} from "../../../actions/dataRequest";
import { changeTutorial as changeTutorialAction } from "../../../actions/tutorial";

function DatarequestModal(props) {
  const {
    open, onClose, connection, dataset, match, getDataRequestByDataset,
    createDataRequest, updateDataRequest, requests, onUpdateDataset,
    changeTutorial,
  } = props;

  const [dataRequest, setDataRequest] = useState(null);
  const [loading, setLoading] = useState(false);
  const [saved, setSaved] = useState(false);
  const [error, setError] = useState(null);
  const [closeTrigger, setCloseTrigger] = useState(false);
  const [result, setResult] = useState(null);
  const [fieldsView, setFieldsView] = useState(false);

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
    const request = _.find(requests, { options: { id: dataset.id } });
    setResult(request);
    if (open) changeTutorial("requestmodal");
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
    if (!result && fieldsView) {
      setFieldsView(false);
    }
  }, [result]);

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

  const _onSaveRequest = () => {
    setLoading(true);

    return updateDataRequest(
      match.params.projectId,
      match.params.chartId,
      dataRequest.id,
      dataRequest
    )
      .then((newDr) => {
        setLoading(false);
        setDataRequest(newDr);

        setTimeout(() => {
          setSaved(true);
        }, 100);

        return newDr;
      })
      .catch((e) => {
        setLoading(false);
        setError(e);
        return e;
      });
  };

  const _onChangeField = (field) => {
    onUpdateDataset(field);
  };

  const _onFieldsClicked = () => {
    setFieldsView(true);
    setTimeout(() => {
      changeTutorial("objectexplorer");
    }, 1000);
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
        {!fieldsView && connection.type === "api" && dataRequest && (
          <ApiBuilder
            dataset={dataset}
            dataRequest={dataRequest}
            connection={connection}
            onChangeRequest={_updateDataRequest}
            onSave={_onSaveRequest}
            exploreData={result && JSON.stringify(result.data, null, 2)}
          />
        )}
        {!fieldsView && (connection.type === "mysql" || connection.type === "postgres") && dataRequest && (
          <SqlBuilder
            dataset={dataset}
            dataRequest={dataRequest}
            connection={connection}
            onChangeRequest={_updateDataRequest}
            onSave={_onSaveRequest}
            exploreData={result && JSON.stringify(result.data, null, 2)}
          />
        )}
        {!fieldsView && connection.type === "mongodb" && dataRequest && (
          <MongoQueryBuilder
            dataset={dataset}
            dataRequest={dataRequest}
            onChangeRequest={_updateDataRequest}
            onSave={_onSaveRequest}
            exploreData={result && JSON.stringify(result.data, null, 2)}
          />
        )}

        {fieldsView && result && (
          <Grid columns={2}>
            <Grid.Column width={7} className="objectexplorer-data-tut">
              <Header size="small" dividing>Explore your data</Header>
              <AceEditor
                mode="json"
                theme="tomorrow"
                height="450px"
                width="none"
                value={JSON.stringify(result.data, null, 2) || ""}
                name="resultEditor"
                readOnly
                editorProps={{ $blockScrolling: false }}
              />
            </Grid.Column>
            <Grid.Column width={9} className="objectexplorer-object-tut">
              <Header size="small" dividing>
                {"Select a field to visualize "}
                <Popup
                  content={(
                    <div>
                      <p>
                        You will need a
                        {" "}
                        <b>date</b>
                        {" "}
                        field for timeseries.
                      </p>
                      <p>
                        For pattern charts, you will probably want to select a
                        {" "}
                        <b>string</b>
                        {" "}
                        or
                        {" "}
                        <b>number</b>
                        {" "}
                        field.
                      </p>
                    </div>
                  )}
                  trigger={(
                    <Icon name="info circle" style={styles.infoIcon} />
                  )}
                />
              </Header>
              <div style={styles.fieldSelection}>
                {"Selected field: "}
                <Label color="blue">{dataset.xAxis && dataset.xAxis.replace("root[].", "")}</Label>
              </div>
              <ObjectExplorer
                objectData={result.data}
                onChange={_onChangeField}
                xAxisField={dataset.xAxis}
              />
            </Grid.Column>
          </Grid>
        )}
      </Modal.Content>
      <Modal.Actions>
        <Button
          secondary={!saved}
          positive={saved}
          onClick={_onSaveRequest}
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
          Done
        </Button>

        {!fieldsView && (
          <Button
            secondary
            icon
            labelPosition="right"
            disabled={!result}
            onClick={_onFieldsClicked}
            className="requestmodal-fields-tut"
          >
            <Icon name="chevron right" />
            Set up the fields
          </Button>
        )}
        {fieldsView && (
          <Button
            secondary
            icon
            labelPosition="left"
            onClick={() => setFieldsView(false)}
            floated="left"
          >
            <Icon name="chevron left" />
            Back to the request
          </Button>
        )}
      </Modal.Actions>
    </Modal>
  );
}

const styles = {
  fieldSelection: {
    marginBottom: 20,
  },
  infoIcon: {
    fontSize: 16,
  },
};

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
  onUpdateDataset: PropTypes.func.isRequired,
  requests: PropTypes.array.isRequired,
  changeTutorial: PropTypes.func.isRequired,
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
