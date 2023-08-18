import React, { useState, useEffect } from "react";
import PropTypes from "prop-types";
import { connect } from "react-redux";
import { withRouter } from "react-router";
import {
  Grid, Button, Container, Row, Text, Spacer, Loading, Modal, Input, useTheme, Tooltip, Checkbox,
  Divider,
} from "@nextui-org/react";
import AceEditor from "react-ace";
import { toast } from "react-toastify";
import {
  Delete,
  Edit, InfoCircle, Play, Plus, TickSquare
} from "react-iconly";

import "ace-builds/src-min-noconflict/mode-json";
import "ace-builds/src-min-noconflict/mode-pgsql";
import "ace-builds/src-min-noconflict/theme-tomorrow";
import "ace-builds/src-min-noconflict/theme-one_dark";

import { createSavedQuery, updateSavedQuery } from "../../../actions/savedQuery";
import { runDataRequest as runDataRequestAction } from "../../../actions/dataRequest";
import { changeTutorial as changeTutorialAction } from "../../../actions/tutorial";
import SavedQueries from "../../../components/SavedQueries";

/*
  The query builder for Mysql and Postgres
*/
function SqlBuilder(props) {
  const {
    createSavedQuery, match, updateSavedQuery, changeTutorial,
    dataRequest, onChangeRequest, onSave, runDataRequest, connection,
    onDelete, responses,
  } = props;

  const [sqlRequest, setSqlRequest] = useState({
    query: "SELECT * FROM users;",
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
  const [invalidateCache, setInvalidateCache] = useState(false);
  const [saveLoading, setSaveLoading] = useState(false);

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

  useEffect(() => {
    if (responses && responses.length > 0) {
      const selectedResponse = responses.find((o) => o.id === dataRequest.id);
      if (selectedResponse?.data) {
        setResult(JSON.stringify(selectedResponse.data, null, 2));
      }
    }
  }, [responses]);

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

  const _onTest = (dr = dataRequest) => {
    setRequestLoading(true);
    setRequestSuccess(false);
    setRequestError(false);

    onSave(dr).then(() => {
      const getCache = !invalidateCache;
      runDataRequest(match.params.projectId, match.params.chartId, dr.id, getCache)
        .then((result) => {
          setRequestLoading(false);
          setRequestSuccess(result.status);
        })
        .catch((error) => {
          setRequestLoading(false);
          setRequestError(error);
          setResult(JSON.stringify(error, null, 2));
          toast.error("The request failed. Please check your query 🕵️‍♂️");
        });
    });
  };

  const _onSavePressed = () => {
    setSaveLoading(true);
    onSave(sqlRequest).then(() => {
      setSaveLoading(false);
    }).catch(() => {
      setSaveLoading(false);
    });
  };

  return (
    <div style={styles.container}>
      <Grid.Container>
        <Grid xs={12} sm={6}>
          <Container>
            <Row justify="space-between" align="center">
              <Text b size={22}>{connection.name}</Text>
              <div>
                <Row>
                  <Button
                    color="primary"
                    auto
                    size="sm"
                    onClick={() => _onSavePressed()}
                    disabled={saveLoading || requestLoading}
                    flat
                  >
                    {(!saveLoading && !requestLoading) && "Save"}
                    {(saveLoading || requestLoading) && <Loading type="spinner" />}
                  </Button>
                  <Spacer x={0.3} />
                  <Tooltip content="Delete this data request" placement="bottom" css={{ zIndex: 99999 }}>
                    <Button
                      color="error"
                      icon={<Delete />}
                      auto
                      size="sm"
                      bordered
                      css={{ minWidth: "fit-content" }}
                      onClick={() => onDelete()}
                    />
                  </Tooltip>
                </Row>
              </div>
            </Row>
            <Spacer y={0.5} />
            <Row>
              <Divider />
            </Row>
            <Spacer y={0.5} />
            <Row align="center">
              <Text b>
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
            <Row align="center" className="sqlbuilder-buttons-tut">
              <Button
                color={requestSuccess ? "success" : requestError ? "error" : "primary"}
                iconRight={requestLoading ? <Loading type="points-opacity" /> : <Play />}
                onClick={() => _onTest()}
                disabled={requestLoading}
                auto
                shadow
              >
                {!requestSuccess && !requestError && !requestLoading && "Run query"}
                {(requestSuccess || requestError) && !requestLoading && "Run again"}
              </Button>

              <Spacer x={0.2} />
              <Button
                color="secondary"
                iconRight={<Plus />}
                disabled={savingQuery}
                onClick={_onSaveQueryConfirmation}
                auto
              >
                {!savedQuery && !savingQuery && "Save query"}
                {savedQuery && !savingQuery && "Save as new"}
                {savingQuery && <Loading type="points-opacity" />}
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
            <Spacer y={0.5} />
            <Row align="center">
              <Checkbox
                label="Use cache"
                isSelected={!invalidateCache}
                onChange={() => setInvalidateCache(!invalidateCache)}
                size="sm"
              />
              <Spacer x={0.2} />
              <Tooltip
                content={"Chartbrew will use cached data for extra editing speed ⚡️. The cache gets automatically invalidated when you change any call settings."}
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
            <Row className="sqlbuilder-saved-tut">
              <SavedQueries
                selectedQuery={savedQuery}
                onSelectQuery={(savedQuery) => {
                  setSavedQuery(savedQuery.id);
                  _onChangeQuery(savedQuery.query);
                }}
                type={connection.type}
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
                  value={result || ""}
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

SqlBuilder.propTypes = {
  dataRequest: PropTypes.object.isRequired,
  onChangeRequest: PropTypes.func.isRequired,
  onSave: PropTypes.func.isRequired,
  runDataRequest: PropTypes.func.isRequired,
  createSavedQuery: PropTypes.func.isRequired,
  updateSavedQuery: PropTypes.func.isRequired,
  match: PropTypes.object.isRequired,
  connection: PropTypes.object.isRequired,
  changeTutorial: PropTypes.func.isRequired,
  onDelete: PropTypes.func.isRequired,
  responses: PropTypes.array.isRequired,
};

const mapStateToProps = (state) => {
  return {
    responses: state.dataRequest.responses,
  };
};

const mapDispatchToProps = (dispatch) => {
  return {
    createSavedQuery: (projectId, data) => dispatch(createSavedQuery(projectId, data)),
    updateSavedQuery: (projectId, savedQueryId, data) => (
      dispatch(updateSavedQuery(projectId, savedQueryId, data))
    ),
    runDataRequest: (projectId, chartId, drId, getCache) => {
      return dispatch(runDataRequestAction(projectId, chartId, drId, getCache));
    },
    changeTutorial: (tutorial) => dispatch(changeTutorialAction(tutorial)),
  };
};

export default withRouter(connect(mapStateToProps, mapDispatchToProps)(SqlBuilder));
