import React, { useState, useEffect } from "react";
import PropTypes from "prop-types";
import { connect } from "react-redux";
import { withRouter } from "react-router";
import {
  Button, Checkbox, Container, Grid, Input, Link, Loading,
  Modal, Popover, Row, Spacer, Text, Tooltip, useTheme,
} from "@nextui-org/react";
import AceEditor from "react-ace";
import { toast } from "react-toastify";
import {
  ChevronRight, Edit, InfoCircle, Play, Plus, TickSquare
} from "react-iconly";

import "ace-builds/src-min-noconflict/mode-javascript";
import "ace-builds/src-min-noconflict/theme-tomorrow";
import "ace-builds/src-min-noconflict/theme-one_dark";

import { createSavedQuery, updateSavedQuery } from "../../../actions/savedQuery";
import SavedQueries from "../../../components/SavedQueries";
import { runRequest as runRequestAction } from "../../../actions/dataset";
import { changeTutorial as changeTutorialAction } from "../../../actions/tutorial";

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

  const { isDark } = useTheme();

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
      <Grid.Container gap={1}>
        <Grid xs={12} sm={6}>
          <Container>
            <Row align="center">
              <Text>
                {"Enter your mongodb query here"}
              </Text>
              <Spacer x={0.2} />
              <Tooltip
                content={(
                  <>
                    <Text>
                      {"In order to select a collection you always have to start with "}
                    </Text>
                    <pre>{"collection('collection_name')"}</pre>
                  </>
                )}
                css={{ zIndex: 10000 }}
                placement="bottom"
              >
                <InfoCircle size="small" />
              </Tooltip>
            </Row>
            <Row>
              <div style={{ width: "100%" }}>
                <AceEditor
                  mode="javascript"
                  theme={isDark ? "one_dark" : "tomorrow"}
                  style={{ borderRadius: 10 }}
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
              </div>
            </Row>
            <Row align="center" className="mongobuilder-buttons-tut">
              <Button
                color={testSuccess ? "success" : testError ? "error" : "primary"}
                iconRight={testSuccess && !testingQuery ? <TickSquare /> : <Play />}
                onClick={_onTest}
                disabled={testingQuery}
                auto
                shadow
              >
                {!testSuccess && !testError && !testingQuery && "Run the query"}
                {(testSuccess || testError) && !testingQuery && "Run again"}
                {testingQuery && <Loading type="points" />}
              </Button>
              <Spacer x={0.2} />
              <Button
                color="secondary"
                iconRight={<Plus />}
                disabled={savingQuery}
                onClick={_onSaveQueryConfirmation}
                auto
              >
                {!savedQuery && !savingQuery && "Save the query"}
                {savedQuery && !savingQuery && "Save as new"}
                {savingQuery && <Loading type="points" />}
              </Button>
              {savedQuery && (
                <>
                  <Spacer x={0.2} />
                  <Button
                    bordered
                    icon={<Edit />}
                    onClick={_onUpdateSavedQuery}
                    disabled={updatingSavedQuery}
                    auto
                  >
                    {updatingSavedQuery ? <Loading type="points" /> : "Update the query"}
                  </Button>
                </>
              )}
            </Row>
            <Spacer y={1} />
            <Row align="center">
              <Checkbox
                label="Use cache"
                isSelected={!!useCache}
                onChange={_onChangeUseCache}
                size="sm"
              />
              <Spacer x={0.2} />
              <Tooltip
                content={"If checked, Chartbrew will use cached data instead of making requests to your data source. The cache gets automatically invalidated when you change any call settings."}
                css={{ zIndex: 10000, maxWidth: 400 }}
              >
                <InfoCircle size="small" />
              </Tooltip>
            </Row>

            <Spacer y={1} />
            <Row>
              <Text b>Saved queries</Text>
            </Row>
            <Spacer y={0.5} />
            <Row className="mongobuilder-saved-tut">
              <SavedQueries
                selectedQuery={savedQuery}
                onSelectQuery={(savedQuery) => {
                  setSavedQuery(savedQuery.id);
                  _onChangeQuery(savedQuery.query);
                }}
                type="mongodb"
                style={styles.savedQueriesContainer}
              />
            </Row>
          </Container>
        </Grid>
        <Grid xs={12} sm={6}>
          <Container>
            <Row>
              <Text b>
                {"Query result"}
              </Text>
            </Row>
            <Spacer y={0.5} />

            <Row>
              <div style={{ width: "100%" }}>
                <AceEditor
                  mode="json"
                  theme={isDark ? "one_dark" : "tomorrow"}
                  style={{ borderRadius: 10 }}
                  height="450px"
                  width="none"
                  value={exploreData || result || ""}
                  onChange={() => setResult(result)}
                  name="resultEditor"
                  readOnly
                  editorProps={{ $blockScrolling: false }}
                  className="mongobuilder-result-tut"
                />
              </div>
            </Row>
            <Spacer y={0.5} />
            {result && (
              <Row>
                <Text small>This is a sample response and might not show all the data.</Text>
              </Row>
            )}

            <Row>
              <Popover>
                <Popover.Trigger>
                  <Link css={{ color: "$secondary", ai: "center" }}>
                    <div style={{ display: "flex", flexDirection: "row", alignItems: "center" }}>
                      <InfoCircle size="small" />
                      <Spacer x={0.2} />
                      <Text>How to optimise your queries?</Text>
                    </div>
                  </Link>
                </Popover.Trigger>
                <Popover.Content css={{ maxWidth: 600, p: 10 }}>
                  <Container fluid>
                    <Row>
                      <Text>{"You can use the following methods to optimize your queries and make them significantly smaller in size."}</Text>
                    </Row>
                    <Spacer y={1} />
                    <Row>
                      <Link href="https://docs.mongodb.com/manual/reference/operator/query-comparison/" target="_blank" rel="noopener noreferrer" css={{ ai: "center" }}>
                        <ChevronRight />
                        <Spacer x={0.2} />
                        <Text color="primary">
                          {"Use a relevant condition for your query. For example, don't fetch all the documents if you know you are going to use just the recent ones."}
                        </Text>
                      </Link>
                    </Row>
                    <Spacer y={0.5} />
                    <Row>
                      <Link as="a" href="https://docs.mongodb.com/manual/tutorial/project-fields-from-query-results/#return-the-specified-fields-and-the-id-field-only" target="_blank" rel="noopener noreferrer" css={{ ai: "center" }}>
                        <ChevronRight />
                        <Spacer x={0.2} />
                        <Text color="primary">
                          {"Remove unwanted fields from the query payload if you know for sure that they won't help to generate the chart you have in mind."}
                        </Text>
                      </Link>
                    </Row>
                    <Spacer y={0.5} />
                    <Row>
                      <Link as="a" href="https://docs.mongodb.com/manual/tutorial/project-fields-from-query-results/#return-the-specified-fields-and-the-id-field-only" target="_blank" rel="noopener noreferrer" css={{ ai: "center" }}>
                        <ChevronRight />
                        <Spacer x={0.2} />
                        <Text color="primary">
                          {"If you store files encoded in base64, make sure you exclude them using the method above"}
                        </Text>
                      </Link>
                    </Row>
                  </Container>
                </Popover.Content>
              </Popover>
            </Row>
          </Container>
        </Grid>
      </Grid.Container>

      {/* Save query modal */}
      <Modal open={saveQueryModal} size="small" onClose={() => setSaveQueryModal(false)}>
        <Modal.Header>
          <Text h3>{"Save your query and use it later in this project"}</Text>
        </Modal.Header>
        <Modal.Body>
          <Input
            label="Write a short description for your query"
            placeholder="Type a summary here"
            fluid
            onChange={(e) => setSavedQuerySummary(e.target.value)}
            size="lg"
          />
        </Modal.Body>
        <Modal.Footer>
          <Button
            flat
            color="warning"
            onClick={() => setSaveQueryModal(false)}
            auto
          >
            Close
          </Button>
          <Button
            disabled={!savedQuerySummary}
            iconRight={<TickSquare />}
            onClick={_onSaveQuery}
            auto
          >
            Save the query
          </Button>
        </Modal.Footer>
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
