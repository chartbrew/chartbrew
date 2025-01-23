import React, { useState, useEffect, useRef } from "react";
import PropTypes from "prop-types";
import { useDispatch, useSelector } from "react-redux";
import {
  Button, Spacer, Modal, Input, Tooltip, Checkbox, Divider,
  ModalHeader, ModalBody, ModalFooter, ModalContent, Tabs, Tab,
  Table,
  TableHeader,
  TableColumn,
  TableBody,
  TableRow,
  TableCell,
  Pagination,
  CircularProgress,
} from "@heroui/react";
import AceEditor from "react-ace";
import toast from "react-hot-toast";
import { LuCheck, LuInfo, LuPlay, LuPlus, LuTrash } from "react-icons/lu";
import { useParams } from "react-router";

import "ace-builds/src-min-noconflict/mode-json";
import "ace-builds/src-min-noconflict/mode-pgsql";
import "ace-builds/src-min-noconflict/theme-tomorrow";
import "ace-builds/src-min-noconflict/theme-one_dark";

import { runDataRequest, selectDataRequests } from "../../../slices/dataset";
import SavedQueries from "../../../components/SavedQueries";
import Row from "../../../components/Row";
import Text from "../../../components/Text";
import { useTheme } from "../../../modules/ThemeContext";
import { createSavedQuery, updateSavedQuery } from "../../../slices/savedQuery";

import VisualSQL from "./VisualSQL";
import { getConnection } from "../../../slices/connection";
import AiQuery from "../../Dataset/AiQuery";

/*
  The query builder for Mysql and Postgres
*/
function SqlBuilder(props) {
  const {
    dataRequest, onChangeRequest, onSave,
    onDelete,
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
  const [requestError, setRequestError] = useState("");
  const [result, setResult] = useState("");
  const [invalidateCache, setInvalidateCache] = useState(false);
  const [saveLoading, setSaveLoading] = useState(false);
  const [activeTab, setActiveTab] = useState("sql");
  const [activeResultsTab, setActiveResultsTab] = useState("table");
  const [resultsPage, setResultsPage] = useState(1);
  const { isDark } = useTheme();
  const params = useParams();
  const dispatch = useDispatch();
  const stateDrs = useSelector((state) => selectDataRequests(state, params.datasetId));
  const connection = useSelector((state) => state.connection.data.find((c) => c.id === dataRequest?.connection_id));

  const schemaInitRef = useRef(false);

  useEffect(() => {
    if (dataRequest) {
      setSqlRequest({ ...sqlRequest, ...dataRequest });
    }
  }, []);

  useEffect(() => {
    onChangeRequest(sqlRequest);
  }, [sqlRequest]);

  useEffect(() => {
    if (stateDrs && stateDrs.length > 0) {
      const selectedResponse = stateDrs.find((o) => o.id === sqlRequest.id);
      if (selectedResponse?.response) {
        setResult(JSON.stringify(selectedResponse.response, null, 2));
      }
    }
  }, [stateDrs, sqlRequest]);

  useEffect(() => {
    if (requestError) {
      setActiveResultsTab("json");
    }
  }, [requestError]);

  useEffect(() => {
    if (connection?.id && !connection.schema && !schemaInitRef.current) {
      schemaInitRef.current = true;
      _onTest(dataRequest, true);
    }
  }, [connection]);

  const _onSaveQueryConfirmation = () => {
    setSaveQueryModal(true);
  };

  const _onSaveQuery = () => {
    setSavingQuery(true);
    dispatch(createSavedQuery({
      team_id: params.teamId,
      data: {
        query: sqlRequest.query,
        summary: savedQuerySummary,
        type: connection.type,
      },
    }))
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
    dispatch(updateSavedQuery({
      team_id: params.teamId,
      data: {
        ...savedQuery,
        query: sqlRequest.query,
      },
    }))
      .then(() => {
        setUpdatingSavedQuery(false);
        toast.success("The query was updated 👍");
      })
      .catch(() => {
        setUpdatingSavedQuery(false);
        toast.error("There was a problem with saving your query 😿");
      });
  };

  const _onChangeQuery = (value, testAfter = false, noError = false) => {
    const newSqlRequest = { ...sqlRequest, query: value };
    setSqlRequest(newSqlRequest);
    
    if (testAfter) {
      _onTest(newSqlRequest, noError);
    }
  };

  const _onTest = (dr = dataRequest, noError = false) => {
    setRequestLoading(true);
    setRequestSuccess(false);
    setRequestError(false);

    onSave(dr).then(() => {
      const getCache = !invalidateCache;
      dispatch(runDataRequest({
        team_id: params.teamId,
        dataset_id: dr.dataset_id,
        dataRequest_id: dr.id,
        getCache
      }))
        .then(async (data) => {
          const result = data.payload;
          if (!noError && result?.status?.statusCode >= 400) {
            setRequestError(result.response);
          }
          if (result?.response?.dataRequest?.responseData?.data) {
            setResult(JSON.stringify(result.response.dataRequest.responseData.data, null, 2));
            setRequestSuccess(true);
          }

          await dispatch(getConnection({
            team_id: params.teamId,
            connection_id: dr.connection_id,
          }));

          setRequestLoading(false);
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

  const _getResultHeaderRows = () => {
    if (!result) return ["Results"];

    try {
      const parsedResult = JSON.parse(result);
      const headers = [];
      parsedResult.forEach((o) => {
        Object.keys(o).forEach((attr) => {
          if (!headers.includes(attr)) {
            headers.push(attr);
          }
        });
      });

      if (headers.length === 0) return ["Results"];

      return headers;
    } catch (e) {
      return ["Results"];
    }
  };

  const _getResultBodyRows = (page) => {
    if (!result) return [];

    const perPage = 10;

    try {
      const parsedResult = JSON.parse(result);
      const allRows = page ? parsedResult.slice((page - 1) * perPage, page * perPage) : parsedResult;
      const headers = _getResultHeaderRows();
      return allRows.map((row) => {
        const newRow = {};
        headers.forEach((header) => {
          newRow[header] = row[header] || "";
        });
        return newRow;
      });
    } catch (e) {
      return [];
    }
  };

  if (!connection) {
    return (
      <div className="flex flex-col items-center justify-center h-full">
        <CircularProgress aria-label="Loading connection..." />
      </div>
    );
  }

  return (
    <div style={styles.container} className="pl-1 pr-1 sm:pl-4 sm:pr-4">
      <div className="grid grid-cols-12 gap-8">
        <div className="col-span-12 sm:col-span-6 md:col-span-5">
          <Row justify="space-between" align="center">
            <Text b size={"lg"}>{connection.name}</Text>
            <div>
              <Row>
                <Button
                  color="primary"
                  auto
                  size="sm"
                  onPress={() => _onSavePressed()}
                  isLoading={saveLoading || requestLoading}
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
                    variant="flat"
                    onPress={() => onDelete()}
                  >
                    <LuTrash />
                  </Button>
                </Tooltip>
              </Row>
            </div>
          </Row>
          <Spacer y={2} />
          <Divider />
          <Spacer y={2} />
          <Tabs variant="light" selectedKey={activeTab} onSelectionChange={(key) => setActiveTab(key)}>
            <Tab
              title="SQL Query"
              key="sql"
            />
            <Tab
              title={(
                <div className="flex items-center gap-1">
                  <Text>Visual Query</Text>
                </div>
              )}
              key="visual"
            />
          </Tabs>
          <Spacer y={2} />
          <Divider />
          <Spacer y={4} />
          <>
            {activeTab === "visual" && (
              <div>
                <VisualSQL
                  query={sqlRequest.query}
                  schema={connection.schema}
                  updateQuery={(query) => _onChangeQuery(query, true)}
                  type={connection.type}
                />
                <Spacer y={4} />
                <Divider />
                <Spacer y={2} />
              </div>
            )}
            {activeTab === "sql" && (
              <div>
                <Row>
                  <div className="w-full">
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
                      className="sqlbuilder-query-tut rounded-md border-1 border-solid border-content3"
                    />
                  </div>
                </Row>
              </div>
            )}
          </>
          <Spacer y={2} />
          <div className="sqlbuilder-buttons-tut flex flex-row items-center gap-1">
            <Button
              color={requestSuccess ? "primary" : requestError ? "danger" : "primary"}
              endContent={<LuPlay />}
              onPress={() => _onTest()}
              isLoading={requestLoading}
              fullWidth
            >
              Run query
            </Button>
          </div>
          <Spacer y={2} />
          <Row align="center">
            <Checkbox
              isSelected={!invalidateCache}
              onChange={() => setInvalidateCache(!invalidateCache)}
              size="sm"
            >
              {"Use cached data"}
            </Checkbox>
            <Spacer x={0.5} />
            <Tooltip
              content={"Chartbrew will use cached data for extra editing speed ⚡️. The cache gets automatically invalidated when you change any query settings."}
              className="max-w-[400px]"
            >
              <div><LuInfo /></div>
            </Tooltip>
          </Row>

          {activeTab === "sql" && (
            <div className="flex flex-col gap-2">
              <AiQuery
                query={sqlRequest.query}
                dataRequest={dataRequest}
                onChangeQuery={_onChangeQuery}
              />
            </div>
          )}

          <Spacer y={4} />
          <Divider />
          <Spacer y={4} />
          <Row>
            <Text b>Saved queries</Text>
          </Row>
          <Spacer y={2} />
          <div className="flex flex-row gap-2">
            <Button
              endContent={<LuPlus />}
              isLoading={savingQuery}
              onPress={_onSaveQueryConfirmation}
              variant="flat"
              size="sm"
            >
              {!savedQuery && "Save this query"}
              {savedQuery && "Save as new"}
            </Button>

            {savedQuery && (
              <>
                <Button
                  variant="flat"
                  endContent={<LuCheck />}
                  onPress={_onUpdateSavedQuery}
                  isLoading={updatingSavedQuery}
                  size="sm"
                >
                  {"Update current query"}
                </Button>
              </>
            )}
          </div>
          <Spacer y={4} />
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
          <Spacer y={8} />
        </div>
        <div className="col-span-12 sm:col-span-6 md:col-span-7">
          <Tabs variant="light" selectedKey={activeResultsTab} onSelectionChange={(key) => setActiveResultsTab(key)}>
            <Tab title="Table" key="table" />
            <Tab title="JSON" key="json" />
          </Tabs>
          <Spacer y={2} />

          {activeResultsTab === "table" && (
            <div>
              <div className="w-full">
                <Table
                  isStriped
                  className="sqlbuilder-result-tut"
                  aria-label="Results table"
                >
                  {_getResultHeaderRows()?.length > 0 && (
                    <TableHeader>
                      {_getResultHeaderRows().map((h) => (
                        <TableColumn key={h}>{h}</TableColumn>
                      ))}
                    </TableHeader>
                  )}
                  <TableBody emptyContent={"Run a query to see the results"}>
                    {_getResultBodyRows(resultsPage).map((row, i) => (
                      <TableRow key={i}>
                        {Object.keys(row).map((key) => (
                          <TableCell key={key}>{row[key]}</TableCell>
                        ))}
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </div>
              <Spacer y={2} />
              <div>
                <Pagination
                  total={_getResultBodyRows().length > 0 ? Math.ceil(_getResultBodyRows().length / 10) : 1}
                  onChange={(page) => setResultsPage(page)}
                  page={resultsPage}
                  size="sm"
                  aria-label="Pagination"
                />
              </div>
            </div>
          )}

          {activeResultsTab === "json" && (
            <div>
              <div className="w-full">
                <AceEditor
                  mode="json"
                  theme={isDark ? "one_dark" : "tomorrow"}
                  style={{ borderRadius: 10 }}
                  height="450px"
                  width="none"
                  value={requestError || result || ""}
                  name="resultEditor"
                  readOnly
                  editorProps={{ $blockScrolling: false }}
                  className="sqlbuilder-result-tut rounded-md border-1 border-solid border-content3"
                />
              </div>
            </div>
          )}
          <Spacer y={2} />
          {result && (
            <Row>
              <Text size="sm">This is a sample response and might not show all the data.</Text>
            </Row>
          )}
        </div>
      </div>

      {/* Save query modal */}
      <Modal isOpen={saveQueryModal} size="small" onClose={() => setSaveQueryModal(false)}>
        <ModalContent>
          <ModalHeader className="flex flex-col">
            <div className="font-bold">{"Save your query for later"}</div>
            <div className="text-sm font-normal">{"You can then re-use this query for other datasets"}</div>
          </ModalHeader>
          <ModalBody>
            <Input
              label="Write a short description for your query"
              placeholder="Type a summary here"
              fullWidth
              onChange={(e) => setSavedQuerySummary(e.target.value)}
              variant="bordered"
            />
          </ModalBody>
          <ModalFooter>
            <Button
              variant="bordered"
              onPress={() => setSaveQueryModal(false)}
            >
              Close
            </Button>
            <Button
              disabled={!savedQuerySummary}
              endContent={<LuCheck />}
              onPress={_onSaveQuery}
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

SqlBuilder.propTypes = {
  dataRequest: PropTypes.object.isRequired,
  onChangeRequest: PropTypes.func.isRequired,
  onSave: PropTypes.func.isRequired,
  connection: PropTypes.object.isRequired,
  onDelete: PropTypes.func.isRequired,
};

export default SqlBuilder;
