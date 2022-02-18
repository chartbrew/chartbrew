import React, { useState, useEffect } from "react";
import PropTypes from "prop-types";
import { connect } from "react-redux";
import { withRouter } from "react-router";
import {
  Grid, Form, Input, Button, Icon, Label, Popup, Checkbox, Header, Divider, Message,
} from "semantic-ui-react";
import AceEditor from "react-ace";
import _ from "lodash";
import { toast } from "react-toastify";

import "ace-builds/src-min-noconflict/mode-json";
import "ace-builds/src-min-noconflict/theme-tomorrow";

import {
  runRequest as runRequestAction,
} from "../../../actions/dataset";
import { changeTutorial as changeTutorialAction } from "../../../actions/tutorial";
import { primaryTransparent } from "../../../config/colors";

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
      <Grid columns={2} stackable centered>
        <Grid.Column width={10}>
          <Form>
            <Form.Field className="RealtimeDb-route-tut">
              <Input
                label={connection.connectionString || `https://${projectId || "<your_project>"}.firebaseio.com/`}
                placeholder={"Enter the data path"}
                focus
                value={firebaseRequest.route || ""}
                onChange={(e, data) => _onChangeRoute(data.value)}
              />
            </Form.Field>
            <Form.Field>
              {requestSuccess && (
                <>
                  <Label color="green" style={{ marginBottom: 10 }}>
                    {`${requestSuccess.statusCode} ${requestSuccess.statusText}`}
                  </Label>
                  <Label style={{ marginBottom: 10 }}>
                    {`Length: ${result ? JSON.parse(result).length : 0}`}
                  </Label>
                </>
              )}
              {requestError && (
                <Label color="red" style={{ marginBottom: 10 }}>
                  {`${requestError.statusCode} ${requestError.statusText}`}
                </Label>
              )}
              <Divider />
            </Form.Field>
            <Form.Field>
              <Header as="h4">
                Order By
              </Header>
            </Form.Field>
            <Form.Group>
              <Form.Field>
                <Button
                  basic={!firebaseRequest.configuration || (firebaseRequest.configuration && firebaseRequest.configuration.orderBy !== "child")}
                  primary={firebaseRequest.configuration && firebaseRequest.configuration.orderBy === "child"}
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
                </Button>
                <Button
                  basic={!firebaseRequest.configuration || (firebaseRequest.configuration && firebaseRequest.configuration.orderBy !== "key")}
                  primary={firebaseRequest.configuration && firebaseRequest.configuration.orderBy === "key"}
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
                </Button>
                <Button
                  basic={!firebaseRequest.configuration || (firebaseRequest.configuration && firebaseRequest.configuration.orderBy !== "value")}
                  primary={firebaseRequest.configuration && firebaseRequest.configuration.orderBy === "value"}
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
                </Button>
                {firebaseRequest.configuration && firebaseRequest.configuration.orderBy && (
                  <Button
                    className="tertiary"
                    icon="x"
                    content="Disable ordering"
                    onClick={() => (
                      setFirebaseRequest({
                        ...firebaseRequest,
                        configuration: {
                          ...firebaseRequest.configuration,
                          orderBy: ""
                        }
                      })
                    )}
                  />
                )}
              </Form.Field>
            </Form.Group>
            {firebaseRequest.configuration && firebaseRequest.configuration.orderBy === "child" && (
              <Form.Field>
                <Input
                  placeholder="Enter a field to order by"
                  value={(firebaseRequest.configuration && firebaseRequest.configuration.key) || ""}
                  onChange={(e, data) => (
                    setFirebaseRequest({
                      ...firebaseRequest,
                      configuration: {
                        ...firebaseRequest.configuration,
                        key: data.value
                      }
                    })
                  )}
                />
              </Form.Field>
            )}
            <Form.Field>
              <Divider />
              <Header as="h4">Limit results</Header>
            </Form.Field>
            <Form.Field>
              <Button
                basic={
                  !firebaseRequest.configuration
                  || (firebaseRequest.configuration && !firebaseRequest.configuration.limitToLast)
                }
                primary={firebaseRequest.configuration && firebaseRequest.configuration.limitToLast}
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
                content="Limit to last"
              />
              <Button
                basic={
                  !firebaseRequest.configuration
                  || (firebaseRequest.configuration && !firebaseRequest.configuration.limitToFirst)
                }
                primary={
                  firebaseRequest.configuration && firebaseRequest.configuration.limitToFirst
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
                content="Limit to first"
              />
              {firebaseRequest.configuration
                && (firebaseRequest.configuration.limitToLast
                  || firebaseRequest.configuration.limitToFirst)
                && (
                  <Button
                    className="tertiary"
                    icon="x"
                    content="Disable limit"
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
                  />
                )}
            </Form.Field>
            <Form.Field>
              <Input
                placeholder="How many records should return?"
                type="number"
                value={limitValue}
                onChange={(e, data) => _onChangeLimitValue(data.value)}
                disabled={
                  !firebaseRequest.configuration
                    || (
                      !firebaseRequest.configuration.limitToLast
                      && !firebaseRequest.configuration.limitToFirst
                    )
                }
              />
            </Form.Field>
          </Form>

          <Divider />
          <Message icon size="small">
            <Icon name="wrench" />
            <Message.Content>
              <Message.Header>Realtime Database has just arrived</Message.Header>
              {"The integration was just added to Chartbrew. If you spot any issues, please let me know at "}
              <a href="mailto:raz@chartbrew.com?subject=Realtime Database feedback">raz@chartbrew.com</a>
            </Message.Content>
          </Message>
        </Grid.Column>
        <Grid.Column width={6}>
          <Form>
            <Form.Field className="RealtimeDb-request-tut">
              <Button
                primary
                icon
                labelPosition="right"
                loading={requestLoading}
                onClick={_onTest}
                fluid
              >
                <Icon name="play" />
                Make the request
              </Button>
            </Form.Field>
            <Form.Field>
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
                  <p>{"The cache gets automatically invalidated when you change the collections and/or filters."}</p>
                </>
              </Popup>
            </Form.Field>
          </Form>
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
            className="RealtimeDb-result-tut"
          />
        </Grid.Column>
      </Grid>
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
