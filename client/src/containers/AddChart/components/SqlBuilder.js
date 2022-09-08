import React, { useState, useEffect } from "react";
import PropTypes from "prop-types";
import { connect } from "react-redux";
import { withRouter } from "react-router";
import {
  Grid, Button, Container, Row, Text, Spacer, Loading, Modal, Input, useTheme,
} from "@nextui-org/react";
import AceEditor from "react-ace";
import { toast } from "react-toastify";
import {
  Edit, Play, Plus, TickSquare
} from "react-iconly";

import "ace-builds/src-min-noconflict/mode-json";
import "ace-builds/src-min-noconflict/mode-pgsql";
import "ace-builds/src-min-noconflict/theme-tomorrow";
import "ace-builds/src-min-noconflict/theme-one_dark";

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

  const { isDark } = useTheme();

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
      <Grid.Container gap={1}>
        <Grid xs={12} sm={6}>
          <Container>
            <Row align="center">
              <Text>
                {connection.type === "mysql" && "Enter your MySQL query here"}
                {connection.type === "postgres" && "Enter your PostgreSQL query here"}
              </Text>
            </Row>
            <Spacer y={0.5} />
            <Row>
              <div style={{ width: "100%" }}>
                <AceEditor
                  mode="pgsql"
                  theme={isDark ? "one_dark" : "tomorrow"}
                  style={{ borderRadius: 10 }}
                  height="300px"
                  width="none"
                  value={sqlRequest.query || ""}
                  onChange={(value) => {
                    _onChangeQuery(value);
                  }}
                  name="queryEditor"
                  editorProps={{ $blockScrolling: true }}
                  className="sqlbuilder-query-tut"
                />
              </div>
            </Row>
            <Spacer y={0.5} />
            <Row className="sqlbuilder-buttons-tut">
              <Button
                color={requestSuccess ? "success" : requestError ? "error" : "primary"}
                iconRight={requestSuccess && !requestLoading ? <TickSquare /> : <Play />}
                onClick={_onTest}
                disabled={requestLoading}
                auto
                shadow
              >
                {!requestSuccess && !requestError && !requestLoading && "Run the query"}
                {(requestSuccess || requestError) && !requestLoading && "Run again"}
                {requestLoading && <Loading type="points" />}
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
            <Row>
              <Text b>Saved queries</Text>
            </Row>
            <Spacer y={0.5} />
            <Row className="sqlbuilder-saved-tut">
              <SavedQueries
                selectedQuery={savedQuery}
                onSelectQuery={(savedQuery) => {
                  setSavedQuery(savedQuery.id);
                  _onChangeQuery(savedQuery.query);
                }}
                type="mysql"
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
                  className="sqlbuilder-result-tut"
                />
              </div>
            </Row>
            <Spacer y={0.5} />
            {result && (
              <Row>
                <Text small>This is a sample response and might not show all the data.</Text>
              </Row>
            )}
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
