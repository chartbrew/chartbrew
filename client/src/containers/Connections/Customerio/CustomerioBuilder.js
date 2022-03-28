import React, { useState, useEffect } from "react";
import PropTypes from "prop-types";
import { connect } from "react-redux";
import { withRouter } from "react-router";
import {
  Grid, Form, Button, Icon, Popup, Checkbox, Divider, Message, Menu, Label,
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
import CustomerQuery from "./CustomerQuery";

/*
  The Customer.io data request builder
*/
function CustomerioBuilder(props) {
  const [cioRequest, setCioRequest] = useState({
    route: "",
  });
  const [result, setResult] = useState("");
  const [requestLoading, setRequestLoading] = useState(false);
  const [useCache, setUseCache] = useState(false);
  const [limitValue, setLimitValue] = useState(100);
  const [entity, setEntity] = useState("");
  const [conditions, setConditions] = useState({});

  const {
    dataRequest, match, onChangeRequest, runRequest, dataset, project,
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

      setCioRequest(dataRequest);
      setUseCache(!!window.localStorage.getItem("_cb_use_cache"));

      if (dataRequest.configuration && dataRequest.configuration.cioFilters) {
        setConditions(dataRequest.configuration.cioFilters);
      }

      if (dataRequest.route) {
        setEntity(dataRequest.route);
      }

      if (dataRequest.itemsLimit || dataRequest.itemsLimit === 0) {
        setLimitValue(dataRequest.itemsLimit);
      }

      // setTimeout(() => {
      //   changeTutorial("Customerio");
      // }, 1000);
    }
  }, []);

  useEffect(() => {
    const newApiRequest = cioRequest;

    onChangeRequest(newApiRequest);
  }, [cioRequest, connection]);

  const _onSelectCustomers = () => {
    setEntity("customers");
    setCioRequest({ ...cioRequest, method: "POST", route: "customers" });
  };

  const _onUpdateCustomerConditions = (conditions) => {
    setConditions(conditions);
    setCioRequest({
      ...cioRequest,
      configuration: {
        ...cioRequest.configuration,
        cioFilters: conditions
      },
    });
  };

  const _onTest = () => {
    setRequestLoading(true);

    const drData = {
      ...cioRequest,
      itemsLimit: limitValue,
    };

    onSave(drData).then(() => {
      runRequest(match.params.projectId, match.params.chartId, dataset.id, useCache)
        .then((result) => {
          setRequestLoading(false);
          setResult(JSON.stringify(result.data, null, 2));
        })
        .catch((error) => {
          setRequestLoading(false);
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

  return (
    <div style={styles.container}>
      <Grid columns={2} stackable centered>
        <Grid.Column width={10}>
          <Menu secondary>
            <Menu.Item
              name="Customers"
              active={entity === "customers"}
              onClick={() => _onSelectCustomers()}
            />
            <Menu.Item
              disabled
              active={entity === "campaigns"}
              onClick={() => setEntity("campaigns")}
            >
              Campaigns
              <Label size="tiny">coming soon!</Label>
            </Menu.Item>
            <Menu.Item
              active={entity === "messages"}
              onClick={() => setEntity("messages")}
              disabled
            >
              Messages
              <Label size="tiny">coming soon!</Label>
            </Menu.Item>
          </Menu>
          <Divider />

          {entity === "customers" && (
            <CustomerQuery
              conditions={conditions}
              onUpdateConditions={_onUpdateCustomerConditions}
              limit={limitValue}
              onUpdateLimit={(value) => setLimitValue(value)}
              projectId={project.id}
              connectionId={connection.id}
              populateAttributes={
                cioRequest.configuration && cioRequest.configuration.populateAttributes
              }
              onChangeAttributes={() => {
                setCioRequest({
                  ...cioRequest,
                  configuration: {
                    ...cioRequest.configuration,
                    populateAttributes: !cioRequest.configuration.populateAttributes,
                  }
                });
              }}
            />
          )}

          <Divider />
          <Message icon size="small">
            <Icon name="wrench" />
            <Message.Content>
              <Message.Header>Customer.io integration has just arrived</Message.Header>
              {"If you spot any issues or have any feedback, please let me know at "}
              <a href="mailto:raz@chartbrew.com?subject=Customer.io integration feedback">
                {"raz@chartbrew.com"}
              </a>
            </Message.Content>
          </Message>
        </Grid.Column>
        <Grid.Column width={6}>
          <Form>
            <Form.Field className="Customerio-request-tut">
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
            className="Customerio-result-tut"
          />
          <p>
            <Icon name="exclamation circle" />
            <small>{"To keep the interface fast, not all the data might show up here."}</small>
          </p>
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

CustomerioBuilder.defaultProps = {
  dataRequest: null,
};

CustomerioBuilder.propTypes = {
  dataset: PropTypes.object.isRequired,
  connection: PropTypes.object.isRequired,
  match: PropTypes.object.isRequired,
  onChangeRequest: PropTypes.func.isRequired,
  runRequest: PropTypes.func.isRequired,
  onSave: PropTypes.func.isRequired,
  requests: PropTypes.array.isRequired,
  dataRequest: PropTypes.object,
  changeTutorial: PropTypes.func.isRequired,
  project: PropTypes.object.isRequired,
};

const mapStateToProps = (state) => {
  return {
    requests: state.dataset.requests,
    project: state.project.active,
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

export default withRouter(connect(mapStateToProps, mapDispatchToProps)(CustomerioBuilder));
