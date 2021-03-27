import React, { useState, useEffect } from "react";
import PropTypes from "prop-types";
import { connect } from "react-redux";
import { withRouter } from "react-router";
import {
  Grid, Form, Input, Button, Icon, Label,
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

/*
  The API Data Request builder
*/
function FirebaseBuilder(props) {
  const [firebaseRequest, setFirebaseRequest] = useState({
    route: "",
  });
  const [result, setResult] = useState("");
  const [requestSuccess, setRequestSuccess] = useState(false);
  const [requestLoading, setRequestLoading] = useState(false);
  const [requestError, setRequestError] = useState(false);

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

      // setTimeout(() => {
      //   changeTutorial("FirebaseBuilder");
      // }, 1000);
    }
  }, []);

  useEffect(() => {
    const newApiRequest = firebaseRequest;

    onChangeRequest(newApiRequest);
  }, [firebaseRequest, connection]);

  const _onChangeRoute = (value) => {
    if (value[0] !== "/") {
      value = `/${value}`; // eslint-disable-line
    }

    setFirebaseRequest({ ...firebaseRequest, route: value });
  };

  const _onTest = () => {
    setRequestLoading(true);
    setRequestSuccess(false);
    setRequestError(false);

    onSave().then(() => {
      runRequest(match.params.projectId, match.params.chartId, dataset.id)
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

  return (
    <div style={styles.container}>
      <Grid columns={2} stackable centered>
        <Grid.Column width={10}>
          <Form>
            <Form.Field className="FirebaseBuilder-route-tut">
              <Input
                label={`https://${connection.firebaseServiceAccount.project_id}.firebaseio.com`}
                placeholder={"/users.json?orderBy=\"age\""}
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
            </Form.Field>
            <Form.Group>
              <Form.Field>
                <Input
                  label="orderBy"
                  placeholder="Enter a key name"
                  value={firebaseRequest.orderBy || ""}
                  onChange={(e, data) => (
                    setFirebaseRequest({ ...firebaseRequest, orderBy: data.value })
                  )}
                />
              </Form.Field>
              <Form.Field>
                <Button onClick={() => setFirebaseRequest({ ...firebaseRequest, orderBy: "$key" })}>
                  {" $key "}
                </Button>
                <Button onClick={() => setFirebaseRequest({ ...firebaseRequest, orderBy: "$value" })}>
                  {" $value "}
                </Button>
                <Button onClick={() => setFirebaseRequest({ ...firebaseRequest, orderBy: "$priority" })}>
                  {" $priority "}
                </Button>
              </Form.Field>
            </Form.Group>
          </Form>
        </Grid.Column>
        <Grid.Column width={6}>
          <Form>
            <Form.Field className="FirebaseBuilder-request-tut">
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
            className="FirebaseBuilder-result-tut"
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

FirebaseBuilder.defaultProps = {
  dataRequest: null,
};

FirebaseBuilder.propTypes = {
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

export default withRouter(connect(mapStateToProps, mapDispatchToProps)(FirebaseBuilder));
