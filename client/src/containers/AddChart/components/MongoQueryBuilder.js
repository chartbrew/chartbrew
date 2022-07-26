import React, { useState, useEffect } from "react";
import PropTypes from "prop-types";
import { connect } from "react-redux";
import { withRouter } from "react-router";
import {
  Grid, Header, Button, Container, Icon, List,
  Modal, Input, Popup, TransitionablePortal, Checkbox,
} from "semantic-ui-react";
import AceEditor from "react-ace";
import { toast } from "react-toastify";

import "ace-builds/src-min-noconflict/mode-javascript";
import "ace-builds/src-min-noconflict/theme-tomorrow";

import { createSavedQuery, updateSavedQuery } from "../../../actions/savedQuery";
import SavedQueries from "../../../components/SavedQueries";
import { runRequest as runRequestAction } from "../../../actions/dataset";
import { changeTutorial as changeTutorialAction } from "../../../actions/tutorial";
import { primaryTransparent } from "../../../config/colors";

/*
  MongoDB query builder
*/
function MongoQueryBuilder(props) {
  const {
    createSavedQuery, match, updateSavedQuery, onChangeRequest,
    runRequest, onSave, dataset, dataRequest, exploreData,
    changeTutorial,
  } = props;

  const [savedQuery, setSavedQuery] = useState(null);
  const [saveQueryModal, setSaveQueryModal] = useState(false);
  const [savedQuerySummary, setSavedQuerySummary] = useState("");
  const [updatingSavedQuery, setUpdatingSavedQuery] = useState(false);
  const [savingQuery, setSavingQuery] = useState(false);
  const [testSuccess, setTestSuccess] = useState(false);
  const [testError, setTestError] = useState(false);
  const [testingQuery, setTestingQuery] = useState(false);
  const [result, setResult] = useState("");
  const [mongoRequest, setMongoRequest] = useState({
    query: "collection('users').find()",
  });
  const [useCache, setUseCache] = useState(false);

  useEffect(() => {
    if (dataRequest) {
      const newRequest = { ...mongoRequest, ...dataRequest };
      if (!dataRequest.query) newRequest.query = mongoRequest.query;
      setMongoRequest(newRequest);
      setTimeout(() => {
        changeTutorial("mongobuilder");
      }, 1000);
    }

    setUseCache(!!window.localStorage.getItem("_cb_use_cache"));
  }, []);

  useEffect(() => {
    onChangeRequest(mongoRequest);
  }, [mongoRequest]);

  const _onSaveQueryConfirmation = () => {
    setSaveQueryModal(true);
  };

  const _onSaveQuery = () => {
    setSavingQuery(true);
    createSavedQuery(match.params.projectId, {
      query: mongoRequest.query,
      summary: savedQuerySummary,
      type: "mongodb",
    })
      .then((savedQuery) => {
        setSavingQuery(false);
        setSavedQuery(savedQuery.id);
        toast.success("The query was saved 👍");
        setSaveQueryModal(false);
      })
      .catch(() => {
        setSavingQuery(false);
        toast.error("We couldn't save the query. Please try again 😿");
        setSaveQueryModal(false);
      });
  };

  const _onUpdateSavedQuery = () => {
    setUpdatingSavedQuery(true);

    updateSavedQuery(
      match.params.projectId,
      savedQuery,
      { query: mongoRequest.query }
    )
      .then(() => {
        setUpdatingSavedQuery(false);
        toast.success("The query was updated 👍");
      })
      .catch(() => {
        setUpdatingSavedQuery(false);
        toast.error("We couldn't update your query. Please try again 😿");
      });
  };

  const _onChangeQuery = (value) => {
    setMongoRequest({ ...mongoRequest, query: value });
  };

  const _onTest = () => {
    setTestingQuery(true);
    setTestSuccess(false);
    setTestError(false);

    onSave().then(() => {
      runRequest(match.params.projectId, match.params.chartId, dataset.id, useCache)
        .then((result) => {
          setTestingQuery(false);
          setTestSuccess(result.status);
          setResult(JSON.stringify(result.data, null, 2));
        })
        .catch((error) => {
          setTestingQuery(false);
          setTestError(error);
          setResult(JSON.stringify(error, null, 2));
          toast.error("The request failed. Please check your query 🕵️‍♂️");
        });
    });
  };

  const _onChangeUseCache = () => {
    if (window.localStorage.getItem("_cb_use_cache")) {
      window.localStorage.removeItem("_cb_use_cache");
      setUseCache(false);
    } else {
      window.localStorage.setItem("_cb_use_cache", true);
      setUseCache(true);
    }
  };

  return (
    <div style={styles.container}>
      <Grid columns={2} stackable centered divided>
        <Grid.Column width={8}>
          <Header size="small">
            {"Enter your mongodb query here."}
            <Popup
              trigger={<Icon name="question circle outline" />}
              content={(
                <p>
                  {"In order to select a collection you always have to start with "}
                  <pre>{"collection('collection_name')"}</pre>
                </p>
              )}
            />
          </Header>
          <AceEditor
            mode="javascript"
            theme="tomorrow"
            height="200px"
            width="none"
            value={mongoRequest.query || ""}
            onChange={(value) => {
              _onChangeQuery(value);
            }}
            name="queryEditor"
            editorProps={{ $blockScrolling: true }}
            className="mongobuilder-query-tut"
          />
          <Button.Group fluid className="mongobuilder-buttons-tut">
            <Button
              color={testSuccess ? "green" : testError ? "red" : null}
              primary={!testSuccess && !testError}
              icon
              labelPosition="right"
              onClick={_onTest}
              loading={testingQuery}
            >
              {testSuccess && <Icon name="checkmark" />}
              {testError && <Icon name="x" />}
              {!testSuccess && !testError && <Icon name="flask" />}
              {!testSuccess && !testError && "Run the query"}
              {(testSuccess || testError) && "Run again"}
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
          <Container style={{ paddingTop: 20 }}>
            <Checkbox
              label="Use cache"
              checked={!!useCache}
              onChange={_onChangeUseCache}
            />
            {" "}
            <Popup
              trigger={<Icon name="question circle outline" style={{ color: primaryTransparent(0.7) }} />}
              inverted
            >
              <>
                <p>{"If checked, Chartbrew will use cached data instead of making requests to your data source."}</p>
                <p>{"The cache gets automatically invalidated when you change any call settings."}</p>
              </>
            </Popup>
          </Container>

          <Header size="small">Saved queries</Header>
          <Container className="mongobuilder-saved-tut">
            <SavedQueries
              selectedQuery={savedQuery}
              onSelectQuery={(savedQuery) => {
                setSavedQuery(savedQuery.id);
                _onChangeQuery(savedQuery.query);
              }}
              type="mongodb"
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
            className="mongobuilder-result-tut"
          />

          {result && (
            <div>
              <small>This is a sample response and might not show all the data.</small>
            </div>
          )}

          <Popup
            on="click"
            trigger={(
              <Header size="small" style={{ cursor: "pointer" }}>
                <a>
                  <Icon name="question circle outline" />
                  How to optimise your queries?
                </a>
              </Header>
            )}
            content={(
              <>
                <p>{"You can use the following methods to optimize your queries and make them significantly smaller in size."}</p>
                <List relaxed>
                  <List.Item as="a" href="https://docs.mongodb.com/manual/reference/operator/query-comparison/" target="_blank" rel="noopener noreferrer">
                    <Icon name="chevron right" />
                    <List.Content>
                      {"Use a relevant condition for your query. For example, don't fetch all the documents if you know you are going to use just the recent ones."}
                    </List.Content>
                  </List.Item>
                  <List.Item as="a" href="https://docs.mongodb.com/manual/tutorial/project-fields-from-query-results/#return-the-specified-fields-and-the-id-field-only" target="_blank" rel="noopener noreferrer">
                    <Icon name="chevron right" />
                    <List.Content>
                      {"Remove unwanted fields from the query payload if you know for sure that they won't help to generate the chart you have in mind."}
                    </List.Content>
                  </List.Item>
                  <List.Item as="a" href="https://docs.mongodb.com/manual/tutorial/project-fields-from-query-results/#return-the-specified-fields-and-the-id-field-only" target="_blank" rel="noopener noreferrer">
                    <Icon name="chevron right" />
                    <List.Content>
                      {"If you store files encoded in base64, make sure you exclude them using the method above"}
                    </List.Content>
                  </List.Item>
                </List>
              </>
            )}
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

MongoQueryBuilder.defaultProps = {
  exploreData: "",
};

MongoQueryBuilder.propTypes = {
  dataset: PropTypes.object.isRequired,
  dataRequest: PropTypes.object.isRequired,
  onChangeRequest: PropTypes.func.isRequired,
  onSave: PropTypes.func.isRequired,
  runRequest: PropTypes.func.isRequired,
  exploreData: PropTypes.string,
  createSavedQuery: PropTypes.func.isRequired,
  updateSavedQuery: PropTypes.func.isRequired,
  match: PropTypes.object.isRequired,
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
    runRequest: (projectId, chartId, datasetId, getCache) => {
      return dispatch(runRequestAction(projectId, chartId, datasetId, getCache));
    },
    changeTutorial: (tutorial) => dispatch(changeTutorialAction(tutorial)),
  };
};

export default withRouter(connect(mapStateToProps, mapDispatchToProps)(MongoQueryBuilder));
