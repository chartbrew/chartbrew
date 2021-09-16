import React, { useState, useEffect } from "react";
import PropTypes from "prop-types";
import { connect } from "react-redux";
import { withRouter } from "react-router";
import {
  Grid, Header, Button, Icon, Container,
  Modal, Input, TransitionablePortal,
} from "semantic-ui-react";
import AceEditor from "react-ace";
import { toast } from "react-toastify";

import "ace-builds/src-min-noconflict/mode-json";
import "ace-builds/src-min-noconflict/mode-pgsql";
import "ace-builds/src-min-noconflict/theme-tomorrow";

import { createSavedQuery, updateSavedQuery } from "../../../actions/savedQuery";
import { runRequest as runRequestAction } from "../../../actions/dataset";
import { changeTutorial as changeTutorialAction } from "../../../actions/tutorial";
import SavedQueries from "../../../components/SavedQueries";

/*
  The query builder for Mysql and Postgres
*/
function SqlBuilder(props) {
  const {
    createSavedQuery, match, updateSavedQuery, exploreData, changeTutorial,
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
      setTimeout(() => {
        changeTutorial("sqlbuilder");
      }, 1000);
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
      query: sqlRequest.query,
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
      { query: sqlRequest.query }
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
            className="sqlbuilder-query-tut"
          />
          <Button.Group fluid className="sqlbuilder-buttons-tut">
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
          <Container className="sqlbuilder-saved-tut">
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
          <Header size="small">
            {"Query result"}
          </Header>

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
            className="sqlbuilder-result-tut"
          />
        </Grid.Column>
      </Grid>

      {/* Save query modal */}
      <TransitionablePortal open={saveQueryModal}>
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
      </TransitionablePortal>
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
  connection: PropTypes.object.isRequired,
  exploreData: PropTypes.string,
  changeTutorial: PropTypes.func.isRequired,
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
    changeTutorial: (tutorial) => dispatch(changeTutorialAction(tutorial)),
  };
};

export default withRouter(connect(mapStateToProps, mapDispatchToProps)(SqlBuilder));
