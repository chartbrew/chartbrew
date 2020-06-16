import React, { useState, useEffect } from "react";
import PropTypes from "prop-types";
import { connect } from "react-redux";
import { withRouter } from "react-router";
import {
  Grid, Header, Button, Icon, Label, Container,
  Modal, Input,
} from "semantic-ui-react";
import brace from "brace"; // eslint-disable-line
import AceEditor from "react-ace";
import { toast } from "react-toastify";

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
    createSavedQuery, match, currentQuery, updateSavedQuery, exploreData,
    dataset, dataRequest, onChangeRequest, onSave, runRequest, connection,
  } = props;

  const [sqlRequest, setSqlRequest] = useState({
    query: "SELECT * FROM user;",
  });
  const [savedQuery, setSavedQuery] = useState(null);
  const [savedQuerySummary, setSavedQuerySummary] = useState("");
  const [saveQueryModal, setSaveQueryModal] = useState(false);
  const [savingQuery, setSavingQuery] = useState(false);
  const [updatingSavedQuery, setUpdatingSavedQuery] = useState(false);
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
      type: connection.type,
    })
      .then((savedQuery) => {
        setSavingQuery(false);
        setSavedQuery(savedQuery.id);
        setSaveQueryModal(false);
      })
      .catch(() => {
        setSavingQuery(false);
        setSaveQueryModal(false);
        toast.error("There was a problem with saving your query 😳");
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
        toast.success("The query was updated 👍");
      })
      .catch(() => {
        setUpdatingSavedQuery(false);
        toast.error("There was a problem with saving your query 😿");
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
          toast.error("The request failed. Please check your query 🕵️‍♂️");
        });
    });
  };

  return (
    <div style={styles.container}>
      <Grid columns={2} stackable centered divided>
        <Grid.Column width={8}>
          {connection.type === "mysql" && <Header size="small">{"Enter your MySQL query here"}</Header>}
          {connection.type === "postgres" && <Header size="small">{"Enter your PostgreSQL query here"}</Header>}
          <AceEditor
            mode="pgsql"
            theme="tomorrow"
            height="200px"
            width="none"
            value={sqlRequest.query || ""}
            onChange={(value) => {
              _onChangeQuery(value);
            }}
            name="queryEditor"
            editorProps={{ $blockScrolling: true }}
          />
          <Button.Group fluid>
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
          </Button.Group>

          <Header size="small">Saved queries</Header>
          <Container>
            <SavedQueries
              selectedQuery={savedQuery}
              onSelectQuery={(savedQuery) => {
                setSavedQuery(savedQuery.id);
                _onChangeQuery(savedQuery.query);
              }}
              type="mysql"
              style={styles.savedQueriesContainer}
            />
          </Container>
        </Grid.Column>
        <Grid.Column width={8}>
          <Header size="small">{"Query result"}</Header>
          <AceEditor
            mode="json"
            theme="tomorrow"
            height="450px"
            width="none"
            value={exploreData || result || ""}
            onChange={() => setResult(result)}
            name="resultEditor"
            readOnly
            editorProps={{ $blockScrolling: false }}
          />
          {result && (
            <p>
              <Label color="green" style={{ marginTop: 10 }}>
                {`Result length: ${result ? JSON.parse(result).length : 0}`}
              </Label>
            </p>
          )}
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
    overflow: "auto",
  },
};

SqlBuilder.defaultProps = {
  exploreData: "",
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
  connection: PropTypes.object.isRequired,
  exploreData: PropTypes.string,
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
