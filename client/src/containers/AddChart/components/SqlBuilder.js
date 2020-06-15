import React, { useState, useEffect } from "react";
import PropTypes from "prop-types";
import { connect } from "react-redux";
import { withRouter } from "react-router";
import {
  Grid, Header, Button, Container, Icon, Message, Segment,
  Modal, Input,
} from "semantic-ui-react";
import brace from "brace"; // eslint-disable-line
import AceEditor from "react-ace";

import "brace/mode/json";
import "brace/mode/pgsql";
import "brace/theme/tomorrow";

import { createSavedQuery, updateSavedQuery } from "../../../actions/savedQuery";
import {
  runRequest as runRequestAction,
} from "../../../actions/dataset";
import SavedQueries from "../../../components/SavedQueries";

/*
  The query builder for Mysql and Postgres
*/
function SqlBuilder(props) {
  const {
    createSavedQuery, match, currentQuery, updateSavedQuery,
    dataset, dataRequest, onChangeRequest, onSave, runRequest,
  } = props;

  const [sqlRequest, setSqlRequest] = useState({
    query: "SELECT * FROM user;",
  });
  const [savedQuery, setSavedQuery] = useState(null);
  const [savedQuerySummary, setSavedQuerySummary] = useState("");
  const [saveQueryModal, setSaveQueryModal] = useState(false);
  const [savingQuery, setSavingQuery] = useState(false);
  const [updatingSavedQuery, setUpdatingSavedQuery] = useState(false);
  const [queryUpdated, setQueryUpdated] = useState(false);
  const [queryUpdateError, setQueryUpdateError] = useState(false);
  const [savingQueryError, setSavingQueryError] = useState(false);
  const [requestSuccess, setRequestSuccess] = useState(false);
  const [requestLoading, setRequestLoading] = useState(false);
  const [requestError, setRequestError] = useState(false);
  const [result, setResult] = useState("");

  useEffect(() => {
    if (dataRequest) {
      setSqlRequest({ ...sqlRequest, ...dataRequest });
    }
  }, []);

  useEffect(() => {
    onChangeRequest(sqlRequest);
  }, [sqlRequest]);

  const _onSaveQueryConfirmation = () => {
    setSaveQueryModal(true);
  };

  const _onSaveQuery = () => {
    setSavingQuery(true);
    createSavedQuery(match.params.projectId, {
      query: currentQuery,
      summary: savedQuerySummary,
      type: "mysql",
    })
      .then((savedQuery) => {
        setSavingQuery(false);
        setSavedQuery(savedQuery.id);
        setSaveQueryModal(false);
      })
      .catch(() => {
        setSavingQuery(false);
        setSavingQueryError(true);
        setSaveQueryModal(false);
      });
  };

  const _onUpdateSavedQuery = () => {
    setUpdatingSavedQuery(true);
    updateSavedQuery(
      match.params.projectId,
      savedQuery,
      { query: currentQuery }
    )
      .then(() => {
        setUpdatingSavedQuery(false);
        setQueryUpdated(true);
      })
      .catch(() => {
        setUpdatingSavedQuery(false);
        setQueryUpdateError(true);
      });
  };

  const _onChangeQuery = (value) => {
    setSqlRequest({ ...sqlRequest, query: value });
  };

  const _onTest = () => {
    setRequestLoading(true);
    setRequestSuccess(false);
    setRequestError(false);

    onSave().then(() => {
      runRequest(match.params.projectId, match.params.chartId, dataset.id)
        .then((result) => {
          setRequestLoading(false);
          setRequestSuccess(result.status);
          setResult(JSON.stringify(result.data, null, 2));
        })
        .catch((error) => {
          setRequestLoading(false);
          setRequestError(error);
          setResult(JSON.stringify(error, null, 2));
        });
    });
  };

  return (
    <div style={styles.container}>
      <Grid columns={2} stackable centered divided>
        <Grid.Column width={8}>
          <Header size="small">{"Enter your MySQL query here"}</Header>
          <AceEditor
            mode="pgsql"
            theme="tomorrow"
            height="250px"
            width="none"
            value={sqlRequest.query || ""}
            onChange={(value) => {
              _onChangeQuery(value);
            }}
            name="queryEditor"
            editorProps={{ $blockScrolling: true }}
          />
          <Container textAlign="center" fluid>
            <Button
              color={requestSuccess ? "green" : requestError ? "red" : null}
              primary={!requestSuccess && !requestError}
              icon
              labelPosition="right"
              onClick={_onTest}
              loading={requestLoading}
            >
              {requestSuccess && <Icon name="checkmark" />}
              {requestError && <Icon name="x" />}
              {!requestSuccess && !requestError && <Icon name="flask" />}
              {!requestSuccess && !requestError && "Run the query"}
              {(requestSuccess || requestError) && "Run again"}
            </Button>

            <Button
              secondary
              icon
              labelPosition="right"
              loading={savingQuery}
              onClick={_onSaveQueryConfirmation}
            >
              <Icon name="plus" />
              {!savedQuery && "Save the query"}
              {savedQuery && "Save as new"}
            </Button>

            {savedQuery
              && (
              <Button
                primary
                basic
                icon
                labelPosition="right"
                onClick={_onUpdateSavedQuery}
                loading={updatingSavedQuery}
              >
                <Icon name="angle double up" />
                Update the query
              </Button>
              )}
          </Container>
          {(savingQueryError || queryUpdateError)
            && (
            <Message negative>
              <Message.Header>
                {"Oh snap! There was an issue with your request"}
              </Message.Header>
              <p>{"Please try again or refresh the page and if it still doesn't work, get in touch with us."}</p>
            </Message>
            )}
          {queryUpdated
            && (
            <Message
              positive
              onDismiss={() => setQueryUpdated(false)}
            >
              <Message.Header>
                {"The query was updated successfully"}
              </Message.Header>
            </Message>
            )}

          <Header>Saved queries</Header>
          <Segment>
            <SavedQueries
              selectedQuery={savedQuery}
              onSelectQuery={(savedQuery) => {
                setSavedQuery(savedQuery.id);
                _onChangeQuery(savedQuery.query);
              }}
              type="mysql"
              style={styles.savedQueriesContainer}
            />
          </Segment>
        </Grid.Column>
        <Grid.Column width={8}>
          <Header size="small">{"Query result"}</Header>
          <AceEditor
            mode="json"
            theme="tomorrow"
            height="450px"
            width="none"
            value={result || ""}
            onChange={() => setResult(result)}
            name="resultEditor"
            readOnly
            editorProps={{ $blockScrolling: false }}
          />
        </Grid.Column>
      </Grid>

      {/* Save query modal */}
      <Modal open={saveQueryModal} size="small" onClose={() => setSaveQueryModal(false)}>
        <Header
          content="Save your query and use it later in this project"
          inverted
        />
        <Modal.Content>
          <Header size="small">Write a short description for your query</Header>
          <Input
            placeholder="Type a summary here"
            fluid
            onChange={(e, data) => setSavedQuerySummary(data.value)}
          />
        </Modal.Content>
        <Modal.Actions>
          <Button
            onClick={() => setSaveQueryModal(false)}
          >
            Close
          </Button>
          <Button
            primary
            disabled={!savedQuerySummary}
            icon
            labelPosition="right"
            onClick={_onSaveQuery}
          >
            <Icon name="checkmark" />
            Save the query
          </Button>
        </Modal.Actions>
      </Modal>
    </div>
  );
}

const styles = {
  container: {
    flex: 1,
  },
  savedQueriesContainer: {
    maxHeight: 170,
  },
};


SqlBuilder.defaultProps = {
};

SqlBuilder.propTypes = {
  dataset: PropTypes.object.isRequired,
  dataRequest: PropTypes.object.isRequired,
  onChangeRequest: PropTypes.func.isRequired,
  onSave: PropTypes.func.isRequired,
  runRequest: PropTypes.func.isRequired,
  createSavedQuery: PropTypes.func.isRequired,
  updateSavedQuery: PropTypes.func.isRequired,
  match: PropTypes.object.isRequired,
  currentQuery: PropTypes.string.isRequired,
};

const mapStateToProps = () => {
  return {
  };
};

const mapDispatchToProps = (dispatch) => {
  return {
    createSavedQuery: (projectId, data) => dispatch(createSavedQuery(projectId, data)),
    updateSavedQuery: (projectId, savedQueryId, data) => (
      dispatch(updateSavedQuery(projectId, savedQueryId, data))
    ),
    runRequest: (projectId, chartId, datasetId) => {
      return dispatch(runRequestAction(projectId, chartId, datasetId));
    },
  };
};

export default withRouter(connect(mapStateToProps, mapDispatchToProps)(SqlBuilder));
