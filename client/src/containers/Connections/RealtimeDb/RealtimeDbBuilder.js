import React, { useState, useEffect } from "react";
import PropTypes from "prop-types";
import { connect } from "react-redux";
import { withRouter } from "react-router";
import {
  Grid, Button, Container, Row, Input, Spacer, Divider, Badge, Text, Loading, Checkbox, Tooltip,
  useTheme,
} from "@nextui-org/react";
import AceEditor from "react-ace";
import _ from "lodash";
import { toast } from "react-toastify";

import "ace-builds/src-min-noconflict/mode-json";
import "ace-builds/src-min-noconflict/theme-tomorrow";
import "ace-builds/src-min-noconflict/theme-one_dark";

import { CloseSquare, InfoCircle, Play } from "react-iconly";
import {
  runRequest as runRequestAction,
} from "../../../actions/dataset";
import { changeTutorial as changeTutorialAction } from "../../../actions/tutorial";

/*
  The API Data Request builder
*/
function RealtimeDbBuilder(props) {
  const [firebaseRequest, setFirebaseRequest] = useState({
    route: "",
  });
  const [result, setResult] = useState("");
  const [requestSuccess, setRequestSuccess] = useState(false);
  const [requestLoading, setRequestLoading] = useState(false);
  const [requestError, setRequestError] = useState(false);
  const [projectId, setProjectId] = useState("");
  const [useCache, setUseCache] = useState(false);
  const [limitValue, setLimitValue] = useState(100);

  const { isDark } = useTheme();

  const {
    dataRequest, match, onChangeRequest, runRequest, dataset,
    connection, onSave, requests, changeTutorial, // eslint-disable-line
  } = props;

  // on init effect
  useEffect(() => {
    if (dataRequest) {
      // get the request data if it exists
      const requestBody = _.find(requests, { options: { id: dataset.id } });
      if (requestBody) {
        setResult(JSON.stringify(requestBody.data, null, 2));
      }

      if (connection && connection.firebaseServiceAccount) {
        try {
          setProjectId(JSON.parse(connection.firebaseServiceAccount).project_id);
        } catch (error) {
          //
        }
      }

      setFirebaseRequest(dataRequest);
      setUseCache(!!window.localStorage.getItem("_cb_use_cache"));

      // setTimeout(() => {
      //   changeTutorial("RealtimeDb");
      // }, 1000);
    }
  }, []);

  useEffect(() => {
    const newApiRequest = firebaseRequest;

    onChangeRequest(newApiRequest);
  }, [firebaseRequest, connection]);

  const _onChangeRoute = (value) => {
    setFirebaseRequest({ ...firebaseRequest, route: value });
  };

  const _onTest = () => {
    setRequestLoading(true);
    setRequestSuccess(false);
    setRequestError(false);

    onSave(firebaseRequest).then(() => {
      runRequest(match.params.projectId, match.params.chartId, dataset.id, useCache)
        .then((result) => {
          setRequestLoading(false);
          setResult(JSON.stringify(result.data, null, 2));
        })
        .catch((error) => {
          setRequestLoading(false);
          setRequestError(error);
          toast.error("The request failed. Please check your request 🕵️‍♂️");
          setResult(JSON.stringify(error, null, 2));
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

  const _onChangeLimitValue = (value) => {
    setLimitValue(value);
    if (firebaseRequest.configuration && firebaseRequest.configuration.limitToLast) {
      setFirebaseRequest({
        ...firebaseRequest,
        configuration: {
          ...firebaseRequest.configuration,
          limitToLast: value,
        },
      });
    }

    if (firebaseRequest.configuration && firebaseRequest.configuration.limitToFirst) {
      setFirebaseRequest({
        ...firebaseRequest,
        configuration: {
          ...firebaseRequest.configuration,
          limitToFirst: value,
        },
      });
    }
  };

  return (
    <div style={styles.container}>
      <Grid.Container>
        <Grid xs={12} sm={6} md={7}>
          <Container>
            <Row className="RealtimeDb-route-tut">
              <Input
                value={connection.connectionString || `https://${projectId || "<your_project>"}.firebaseio.com/`}
                fullWidth
                css={{ pointerEvents: "none" }}
              />
              <Spacer x={0.2} />
              <Input
                placeholder={"Enter the data path"}
                autoFocus
                value={firebaseRequest.route || ""}
                onChange={(e) => _onChangeRoute(e.target.value)}
                bordered
                fullWidth
                animated={false}
              />
            </Row>
            {(requestSuccess || requestError) && (
              <>
                <Spacer y={0.5} />
                <Row>
                  {requestSuccess && (
                    <>
                      <Badge color="success">
                        {`${requestSuccess.statusCode} ${requestSuccess.statusText}`}
                      </Badge>
                      <Spacer x={0.2} />
                      <Badge>
                        {`Length: ${result ? JSON.parse(result).length : 0}`}
                      </Badge>
                    </>
                  )}
                  {requestError && (
                    <Badge color="error">
                      {`${requestError.statusCode} ${requestError.statusText}`}
                    </Badge>
                  )}
                </Row>
              </>
            )}

            <Spacer y={0.5} />
            <Divider />
            <Spacer y={0.5} />

            <Row>
              <Text b>
                Order By
              </Text>
            </Row>
            <Spacer y={0.5} />
            <Row align="center">
              <Badge
                isSquared
                variant={"bordered"}
                color={!firebaseRequest.configuration || (firebaseRequest.configuration && firebaseRequest.configuration.orderBy !== "child") ? "netral" : "secondary"}
                onClick={() => (
                  setFirebaseRequest({
                    ...firebaseRequest,
                    configuration: {
                      ...firebaseRequest.configuration,
                      orderBy: "child"
                    }
                  })
                )}
              >
                {"Child key"}
              </Badge>
              <Spacer x={0.2} />
              <Badge
                isSquared
                variant="bordered"
                color={!firebaseRequest.configuration || (firebaseRequest.configuration && firebaseRequest.configuration.orderBy !== "key") ? "neutral" : "secondary"}
                onClick={() => (
                  setFirebaseRequest({
                    ...firebaseRequest,
                    configuration: {
                      ...firebaseRequest.configuration,
                      orderBy: "key",
                    }
                  })
                )}
              >
                {"Key"}
              </Badge>
              <Spacer x={0.2} />
              <Badge
                isSquared
                variant={"bordered"}
                color={!firebaseRequest.configuration || (firebaseRequest.configuration && firebaseRequest.configuration.orderBy !== "value") ? "bordered" : "secondary"}
                onClick={() => (
                  setFirebaseRequest({
                    ...firebaseRequest,
                    configuration: {
                      ...firebaseRequest.configuration,
                      orderBy: "value",
                    }
                  })
                )}
              >
                {"Value"}
              </Badge>
              {firebaseRequest.configuration && firebaseRequest.configuration.orderBy && (
                <>
                  <Spacer x={0.2} />
                  <Button
                    color="error"
                    bordered
                    icon={<CloseSquare size="small" />}
                    onClick={() => (
                      setFirebaseRequest({
                        ...firebaseRequest,
                        configuration: {
                          ...firebaseRequest.configuration,
                          orderBy: ""
                        }
                      })
                    )}
                    auto
                    size="xs"
                  >
                    {"Disable ordering"}
                  </Button>
                </>
              )}
            </Row>
            <Spacer y={0.5} />
            {firebaseRequest.configuration && firebaseRequest.configuration.orderBy === "child" && (
              <Row>
                <Input
                  placeholder="Enter a field to order by"
                  value={(firebaseRequest.configuration && firebaseRequest.configuration.key) || ""}
                  onChange={(e) => (
                    setFirebaseRequest({
                      ...firebaseRequest,
                      configuration: {
                        ...firebaseRequest.configuration,
                        key: e.target.value
                      }
                    })
                  )}
                  bordered
                  fullWidth
                />
              </Row>
            )}

            <Spacer y={0.5} />
            <Divider />
            <Spacer y={0.5} />

            <Row>
              <Text b>Limit results</Text>
            </Row>
            <Spacer y={0.5} />

            <Row align="center">
              <Badge
                isSquared
                variant={"bordered"}
                color={
                  !firebaseRequest.configuration
                  || (firebaseRequest.configuration && !firebaseRequest.configuration.limitToLast)
                    ? "netrual" : "secondary"
                }
                onClick={() => (
                  setFirebaseRequest({
                    ...firebaseRequest,
                    configuration: {
                      ...firebaseRequest.configuration,
                      limitToLast: limitValue,
                      limitToFirst: 0,
                    }
                  })
                )}
              >
                Limit to last
              </Badge>
              <Spacer x={0.2} />
              <Badge
                isSquared
                variant={"bordered"}
                color={
                  !firebaseRequest.configuration
                  || (firebaseRequest.configuration && !firebaseRequest.configuration.limitToFirst)
                    ? "neutral" : "secondary"
                }
                onClick={() => (
                  setFirebaseRequest({
                    ...firebaseRequest,
                    configuration: {
                      ...firebaseRequest.configuration,
                      limitToFirst: limitValue,
                      limitToLast: 0,
                    }
                  })
                )}
              >
                Limit to first
              </Badge>
              <Spacer x={0.2} />
              {firebaseRequest.configuration
                && (firebaseRequest.configuration.limitToLast
                  || firebaseRequest.configuration.limitToFirst)
                && (
                  <Button
                    icon={<CloseSquare size="small" />}
                    onClick={() => (
                      setFirebaseRequest({
                        ...firebaseRequest,
                        configuration: {
                          ...firebaseRequest.configuration,
                          limitToFirst: "",
                          limitToLast: "",
                        }
                      })
                    )}
                    auto
                    bordered
                    color="error"
                    size="xs"
                  >
                    Disable limit
                  </Button>
                )}
            </Row>
            <Spacer y={0.5} />
            <Row>
              <Input
                placeholder="How many records should return?"
                type="number"
                value={limitValue}
                onChange={(e) => e.target.value && _onChangeLimitValue(e.target.value)}
                disabled={
                  !firebaseRequest.configuration
                    || (
                      !firebaseRequest.configuration.limitToLast
                      && !firebaseRequest.configuration.limitToFirst
                    )
                }
                bordered
                fullWidth
              />
            </Row>
          </Container>
        </Grid>
        <Grid xs={12} sm={6} md={5}>
          <Container>
            <Row className="RealtimeDb-request-tut">
              <Button
                shadow
                iconRight={requestLoading ? <Loading type="points" /> : <Play />}
                disabled={requestLoading}
                onClick={_onTest}
                css={{ width: "100%" }}
              >
                Make the request
              </Button>
            </Row>
            <Spacer y={0.5} />
            <Row align="center">
              <Checkbox
                isSelected={!!useCache}
                onChange={_onChangeUseCache}
                size="sm"
              >
                Use cache
              </Checkbox>
              <Spacer x={0.2} />
              <Tooltip
                content="Use cache to avoid hitting the Firebase API every time you request data. The cache will be cleared when you change any of the settings."
                css={{ minWidth: 600, zIndex: 10000 }}
              >
                <InfoCircle size="small" />
              </Tooltip>
            </Row>
            <Spacer y={0.5} />
            <Row align="center">
              <div style={{ width: "100%" }}>
                <AceEditor
                  mode="json"
                  theme={isDark ? "one_dark" : "tomorrow"}
                  style={{ borderRadius: 10 }}
                  height="450px"
                  width="none"
                  value={result || ""}
                  onChange={() => setResult(result)}
                  name="resultEditor"
                  readOnly
                  editorProps={{ $blockScrolling: false }}
                  className="RealtimeDb-result-tut"
                />
              </div>
            </Row>
          </Container>
        </Grid>
      </Grid.Container>
    </div>
  );
}
const styles = {
  container: {
    flex: 1,
  },
};

RealtimeDbBuilder.defaultProps = {
  dataRequest: null,
};

RealtimeDbBuilder.propTypes = {
  dataset: PropTypes.object.isRequired,
  connection: PropTypes.object.isRequired,
  match: PropTypes.object.isRequired,
  onChangeRequest: PropTypes.func.isRequired,
  runRequest: PropTypes.func.isRequired,
  onSave: PropTypes.func.isRequired,
  requests: PropTypes.array.isRequired,
  dataRequest: PropTypes.object,
  changeTutorial: PropTypes.func.isRequired,
};

const mapStateToProps = (state) => {
  return {
    requests: state.dataset.requests,
  };
};

const mapDispatchToProps = (dispatch) => {
  return {
    runRequest: (projectId, chartId, datasetId) => {
      return dispatch(runRequestAction(projectId, chartId, datasetId));
    },
    changeTutorial: (tutorial) => dispatch(changeTutorialAction(tutorial)),
  };
};

export default withRouter(connect(mapStateToProps, mapDispatchToProps)(RealtimeDbBuilder));
