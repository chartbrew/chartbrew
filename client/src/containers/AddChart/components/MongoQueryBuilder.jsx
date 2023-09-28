import React, { useState, useEffect } from "react";
import PropTypes from "prop-types";
import { connect } from "react-redux";
import { withRouter } from "react-router";
import {
  Button, Checkbox, Divider, Input, Link, Modal, ModalBody, ModalContent, ModalFooter, ModalHeader, Popover, PopoverContent, PopoverTrigger, Spacer,
  Tooltip,
} from "@nextui-org/react";
import AceEditor from "react-ace";
import { toast } from "react-toastify";
import { LuCheck, LuChevronRight, LuInfo, LuPencilLine, LuPlay, LuPlus, LuTrash } from "react-icons/lu";

import "ace-builds/src-min-noconflict/mode-javascript";
import "ace-builds/src-min-noconflict/theme-tomorrow";
import "ace-builds/src-min-noconflict/theme-one_dark";

import { createSavedQuery, updateSavedQuery } from "../../../actions/savedQuery";
import SavedQueries from "../../../components/SavedQueries";
import { runDataRequest as runDataRequestAction } from "../../../actions/dataRequest";
import { changeTutorial as changeTutorialAction } from "../../../actions/tutorial";
import Container from "../../../components/Container";
import Row from "../../../components/Row";
import Text from "../../../components/Text";
import useThemeDetector from "../../../modules/useThemeDetector";

/*
  MongoDB query builder
*/
function MongoQueryBuilder(props) {
  const {
    createSavedQuery, match, updateSavedQuery, onChangeRequest,
    runDataRequest, onSave, dataRequest,
    changeTutorial, connection, onDelete, responses,
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
  const [invalidateCache, setInvalidateCache] = useState(false);
  const [saveLoading, setSaveLoading] = useState(false);

  const isDark = useThemeDetector();

  useEffect(() => {
    if (dataRequest) {
      const newRequest = { ...mongoRequest, ...dataRequest };
      if (!dataRequest.query) newRequest.query = mongoRequest.query;
      setMongoRequest(newRequest);
      setTimeout(() => {
        changeTutorial("mongobuilder");
      }, 1000);
    }
  }, []);

  useEffect(() => {
    onChangeRequest(mongoRequest);
  }, [mongoRequest]);

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

  const _onTest = (dr = mongoRequest) => {
    setTestingQuery(true);
    setTestSuccess(false);
    setTestError(false);

    onSave(dr).then(() => {
      const useCache = !invalidateCache;
      runDataRequest(match.params.projectId, match.params.chartId, dataRequest.id, useCache)
        .then((result) => {
          setTestingQuery(false);
          setTestSuccess(result.status);
        })
        .catch((error) => {
          setTestingQuery(false);
          setTestError(error);
          setResult(JSON.stringify(error, null, 2));
          toast.error("The request failed. Please check your query 🕵️‍♂️");
        });
    });
  };

  const _onSavePressed = () => {
    setSaveLoading(true);
    onSave(mongoRequest).then(() => {
      setSaveLoading(false);
    }).catch(() => {
      setSaveLoading(false);
    });
  };

  return (
    <div style={styles.container} className="pl-1 pr-1 md:pl-4 md:pr-4">
      <div className="grid grid-cols-12 gap-4">
        <div className="col-span-12 sm:col-span-6">
          <Row justify="space-between" align="center">
            <Text b size={"lg"}>{connection.name}</Text>
            <div>
              <Row>
                <Button
                  color="primary"
                  auto
                  size="sm"
                  onClick={() => _onSavePressed()}
                  isLoading={saveLoading || testingQuery}
                  variant="flat"
                >
                  {"Save"}
                </Button>
                <Spacer x={1} />
                <Tooltip content="Delete this data request" placement="bottom" css={{ zIndex: 99999 }}>
                  <Button
                    color="danger"
                    isIconOnly
                    auto
                    size="sm"
                    variant="bordered"
                    onClick={() => onDelete()}
                  >
                    <LuTrash />
                  </Button>
                </Tooltip>
              </Row>
            </div>
          </Row>
          <Spacer y={2} />
          <Row>
            <Divider />
          </Row>
          <Spacer y={4} />
          <Row align="center">
            <Text b>
              {"Enter your mongodb query here"}
            </Text>
            <Spacer x={0.5} />
            <Tooltip
              content={(
                <>
                  <Text>
                    {"In order to select a collection you always have to start with "}
                  </Text>
                  <pre>{"collection('collection_name')"}</pre>
                </>
              )}
              placement="bottom"
            >
              <div><LuInfo /></div>
            </Tooltip>
          </Row>
          <Spacer y={1} />
          <Row>
            <div className="w-full">
              <AceEditor
                mode="javascript"
                theme={isDark ? "one_dark" : "tomorrow"}
                height="200px"
                width="none"
                value={mongoRequest.query || ""}
                onChange={(value) => {
                  _onChangeQuery(value);
                }}
                name="queryEditor"
                editorProps={{ $blockScrolling: true }}
                className="mongobuilder-query-tut rounded-md border-1 border-solid border-content3"
              />
            </div>
          </Row>
          <Spacer y={2} />
          <Row align="center" className="mongobuilder-buttons-tut">
            <Button
              color={testSuccess ? "success" : testError ? "danger" : "primary"}
              endContent={<LuPlay />}
              onClick={() => _onTest()}
              isLoading={testingQuery}
            >
              {!testSuccess && !testError && "Run query"}
              {(testSuccess || testError) && "Run again"}
            </Button>
            <Spacer x={0.5} />
            <Button
              variant="bordered"
              endContent={<LuPlus />}
              isLoading={savingQuery}
              onClick={_onSaveQueryConfirmation}
            >
              {!savedQuery && "Save query"}
              {savedQuery && "Save as new"}
            </Button>
            {savedQuery && (
              <>
                <Spacer x={0.5} />
                <Button
                  variant="bordered"
                  startContent={<LuPencilLine />}
                  onClick={_onUpdateSavedQuery}
                  isLoading={updatingSavedQuery}
                >
                  {"Update the query"}
                </Button>
              </>
            )}
          </Row>
          <Spacer y={2} />
          <Row align="center">
            <Checkbox
              isSelected={!invalidateCache}
              onChange={() => setInvalidateCache(!invalidateCache)}
              size="sm"
            >
              {"Use cached data"}
            </Checkbox>
            <Spacer x={1} />
            <Tooltip
              content={"Chartbrew will use cached data for extra editing speed ⚡️. The cache gets automatically invalidated when you change the query."}
              className="max-w-[400px]"
            >
              <div><LuInfo /></div>
            </Tooltip>
          </Row>
          <Spacer y={4} />
          <Divider />
          <Spacer y={4} />
          <Row>
            <Text b>Saved queries</Text>
          </Row>
          <Spacer y={1} />
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
        </div>
        <div className="col-span-12 sm:col-span-6">
          <Row>
            <Text b>
              {"Query result"}
            </Text>
          </Row>
          <Spacer y={1} />

          <Row>
            <div className="w-full">
              <AceEditor
                mode="json"
                theme={isDark ? "one_dark" : "tomorrow"}
                height="450px"
                width="none"
                value={result || ""}
                name="resultEditor"
                readOnly
                editorProps={{ $blockScrolling: false }}
                className="mongobuilder-result-tut rounded-md border-1 border-solid border-content3"
              />
            </div>
          </Row>
          <Spacer y={1} />
          {result && (
            <>
              <Row>
                <Text size="sm">This is a sample response and might not show all the data.</Text>
              </Row>
              <Spacer y={1} />
            </>
          )}

          <Row>
            <Popover>
              <PopoverTrigger>
                <Link className="text-secondary flex items-center">
                  <div className="flex flex-row items-center">
                    <LuInfo />
                    <Spacer x={0.5} />
                    <Text>Are your queries slow? Read here</Text>
                  </div>
                </Link>
              </PopoverTrigger>
              <PopoverContent className="max-w-[600px] p-10">
                <Container className={"w-full"}>
                  <Row>
                    <Text>{"You can use the following methods to optimize your queries and make them significantly smaller in size."}</Text>
                  </Row>
                  <Spacer y={2} />
                  <Row>
                    <Link
                      href="https://docs.mongodb.com/manual/reference/operator/query-comparison/"
                      target="_blank"
                      rel="noopener noreferrer"
                      className="flex items-center"
                    >
                      <div><LuChevronRight /></div>
                      <Spacer x={0.5} />
                      <Text color="primary">
                        {"Use a relevant condition for your query. For example, don't fetch all the documents if you know you are going to use just the recent ones."}
                      </Text>
                    </Link>
                  </Row>
                  <Spacer y={1} />
                  <Row>
                    <Link
                      as="a"
                      href="https://docs.mongodb.com/manual/tutorial/project-fields-from-query-results/#return-the-specified-fields-and-the-id-field-only"
                      target="_blank"
                      rel="noopener noreferrer"
                      className="flex items-center"
                    >
                      <div><LuChevronRight /></div>
                      <Spacer x={0.2} />
                      <Text color="primary">
                        {"Remove unwanted fields from the query payload if you know for sure that they won't help to generate the chart you have in mind."}
                      </Text>
                    </Link>
                  </Row>
                  <Spacer y={1} />
                  <Row>
                    <Link
                      as="a"
                      href="https://docs.mongodb.com/manual/tutorial/project-fields-from-query-results/#return-the-specified-fields-and-the-id-field-only"
                      target="_blank"
                      rel="noopener noreferrer"
                      className="flex items-center"
                    >
                      <div><LuChevronRight /></div>
                      <Spacer x={1} />
                      <Text color="primary">
                        {"If you store files encoded in base64, make sure you exclude them using the method above"}
                      </Text>
                    </Link>
                  </Row>
                </Container>
              </PopoverContent>
            </Popover>
          </Row>
        </div>
      </div>

      {/* Save query modal */}
      <Modal isOpen={saveQueryModal} size="small" onClose={() => setSaveQueryModal(false)}>
        <ModalContent>
          <ModalHeader>
            <Text b>{"Save your query and use it later in this project"}</Text>
          </ModalHeader>
          <ModalBody>
            <Input
              label="Write a short description for your query"
              placeholder="Type a summary here"
              fullWidth
              onChange={(e) => setSavedQuerySummary(e.target.value)}
              size="lg"
              variant="bordered"
            />
          </ModalBody>
          <ModalFooter>
            <Button
              variant="bordered"
              onClick={() => setSaveQueryModal(false)}
            >
              Close
            </Button>
            <Button
              disabled={!savedQuerySummary}
              endContent={<LuCheck />}
              onClick={_onSaveQuery}
              color="primary"
            >
              Save the query
            </Button>
          </ModalFooter>
        </ModalContent>
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

MongoQueryBuilder.propTypes = {
  dataRequest: PropTypes.object.isRequired,
  onChangeRequest: PropTypes.func.isRequired,
  onSave: PropTypes.func.isRequired,
  runDataRequest: PropTypes.func.isRequired,
  createSavedQuery: PropTypes.func.isRequired,
  updateSavedQuery: PropTypes.func.isRequired,
  match: PropTypes.object.isRequired,
  changeTutorial: PropTypes.func.isRequired,
  connection: PropTypes.object.isRequired,
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

export default withRouter(connect(mapStateToProps, mapDispatchToProps)(MongoQueryBuilder));
