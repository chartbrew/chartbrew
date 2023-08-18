import React, { useState, useEffect } from "react";
import PropTypes from "prop-types";
import { connect } from "react-redux";
import { withRouter } from "react-router";
import {
  Grid, Button, Container, Link, Row, Spacer, Text, Loading, Checkbox, Tooltip, useTheme, Divider,
} from "@nextui-org/react";
import AceEditor from "react-ace";
import { toast } from "react-toastify";
import {
  Chat, Delete, InfoCircle, People, Play
} from "react-iconly";

import "ace-builds/src-min-noconflict/mode-json";
import "ace-builds/src-min-noconflict/theme-tomorrow";
import "ace-builds/src-min-noconflict/theme-one_dark";

import {
  runDataRequest as runDataRequestAction,
} from "../../../actions/dataRequest";
import { changeTutorial as changeTutorialAction } from "../../../actions/tutorial";
import CustomerQuery from "./CustomerQuery";
import CampaignsQuery from "./CampaignsQuery";

/*
  The Customer.io data request builder
*/
function CustomerioBuilder(props) {
  const [cioRequest, setCioRequest] = useState({
    route: "",
  });
  const [result, setResult] = useState("");
  const [requestLoading, setRequestLoading] = useState(false);
  const [invalidateCache, setInvalidateCache] = useState(false);
  const [limitValue, setLimitValue] = useState(0);
  const [entity, setEntity] = useState("");
  const [conditions, setConditions] = useState({});
  const [saveLoading, setSaveLoading] = useState(false);

  const { isDark } = useTheme();

  const {
    dataRequest, match, onChangeRequest, runDataRequest, project,
    connection, onSave, responses, changeTutorial, // eslint-disable-line
    onDelete,
  } = props;

  // on init effect
  useEffect(() => {
    if (dataRequest) {
      let newRequestData = dataRequest;

      if (dataRequest.configuration && dataRequest.configuration.cioFilters) {
        setConditions(dataRequest.configuration.cioFilters);
      }

      if (!dataRequest.configuration) {
        newRequestData = {
          ...newRequestData,
          configuration: {
            populateAttributes: true,
          },
        };
      }

      if (dataRequest.route) {
        if (dataRequest.route.indexOf("customers") > -1) {
          setEntity("customers");
        } else if (dataRequest.route.indexOf("campaigns/") > -1) {
          setEntity("campaigns");
        }
      }

      if (dataRequest.itemsLimit || dataRequest.itemsLimit === 0) {
        setLimitValue(dataRequest.itemsLimit);
      }

      setCioRequest(newRequestData);

      // setTimeout(() => {
      //   changeTutorial("Customerio");
      // }, 1000);
    }
  }, []);

  useEffect(() => {
    const newApiRequest = cioRequest;

    onChangeRequest(newApiRequest);
  }, [cioRequest, connection]);

  useEffect(() => {
    if (responses && responses.length > 0) {
      const selectedResponse = responses.find((o) => o.id === dataRequest.id);
      if (selectedResponse?.data) {
        setResult(JSON.stringify(selectedResponse.data, null, 2));
      }
    }
  }, [responses]);

  const _onSelectCustomers = () => {
    setEntity("customers");
    setCioRequest({ ...cioRequest, method: "POST", route: "customers" });
  };

  const _onSelectCampaigns = () => {
    setEntity("campaigns");
    setCioRequest({ ...cioRequest, method: "GET", route: "campaigns" });
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
      const useCache = !invalidateCache;
      runDataRequest(match.params.projectId, match.params.chartId, dataRequest.id, useCache)
        .then(() => {
          setRequestLoading(false);
        })
        .catch((error) => {
          setRequestLoading(false);
          toast.error("The request failed. Please check your request 🕵️‍♂️");
          setResult(JSON.stringify(error, null, 2));
        });
    });
  };

  const _onUpdateCampaignConfig = (data) => {
    setCioRequest({
      ...cioRequest,
      route: `campaigns/${data.campaignId}/${data.requestRoute}`,
      configuration: {
        ...cioRequest.configuration,
        period: data.period,
        series: data.series,
        steps: data.steps,
        type: data.type && data.type,
        campaignId: data.campaignId,
        requestRoute: data.requestRoute,
        linksMode: data.linksMode,
        selectedLink: data.selectedLink,
        actionId: data.actionId,
        start: data.start,
        end: data.end,
      },
    });
  };

  const _onSavePressed = () => {
    setSaveLoading(true);
    onSave(cioRequest).then(() => {
      setSaveLoading(false);
    }).catch(() => {
      setSaveLoading(false);
    });
  };

  return (
    <div style={styles.container}>
      <Grid.Container>
        <Grid xs={12} sm={7}>
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
            <Row align="center" wrap="wrap">
              <Link
                css={{
                  background: entity === "customers" ? "$background" : "$backgroundContrast",
                  p: 5,
                  pr: 10,
                  pl: 10,
                  br: "$sm",
                  "@xsMax": { width: "90%" },
                  ai: "center",
                  color: "$text",
                }}
                onClick={() => _onSelectCustomers()}
              >
                <People />
                <Spacer x={0.2} />
                <Text>{"Customers"}</Text>
              </Link>
              <Spacer x={0.2} />
              <Link
                css={{
                  background: entity === "campaigns" ? "$background" : "$backgroundContrast",
                  p: 5,
                  pr: 10,
                  pl: 10,
                  br: "$sm",
                  "@xsMax": { width: "90%" },
                  ai: "center",
                  color: "$text",
                }}
                onClick={() => _onSelectCampaigns()}
              >
                <Chat />
                <Spacer x={0.2} />
                <Text>{"Campaigns"}</Text>
              </Link>
              <Spacer x={0.2} />
            </Row>

            {!entity && (
              <Row><Text i>Select which type of data you want to get started with</Text></Row>
            )}
            <Spacer y={1} />

            {entity === "customers" && (
              <Row>
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
              </Row>
            )}

            {entity === "campaigns" && (
              <Row>
                <CampaignsQuery
                  projectId={project.id}
                  connectionId={connection.id}
                  onUpdate={_onUpdateCampaignConfig}
                  request={cioRequest}
                />
              </Row>
            )}
          </Container>
        </Grid>
        <Grid xs={12} sm={5}>
          <Container>
            <Row className="Customerio-request-tut">
              <Button
                iconRight={requestLoading ? <Loading type="spinner" /> : <Play />}
                disabled={requestLoading}
                onClick={_onTest}
                css={{ width: "100%" }}
                shadow
              >
                Make the request
              </Button>
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
                content="If checked, Chartbrew will use cached data instead of making requests to your data source. The cache gets automatically invalidated when you change the collections and/or filters."
                css={{ zIndex: 10000, maxWidth: 500 }}
                placement="leftStart"
              >
                <InfoCircle size="small" />
              </Tooltip>
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
                  className="Customerio-result-tut"
                />
              </div>
            </Row>
            <Spacer y={0.5} />
            <Row align="center">
              <InfoCircle size="small" />
              <Spacer x={0.2} />
              <Text small>
                {"To keep the interface fast, not all the data might show up here."}
              </Text>
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

CustomerioBuilder.defaultProps = {
  dataRequest: null,
};

CustomerioBuilder.propTypes = {
  connection: PropTypes.object.isRequired,
  match: PropTypes.object.isRequired,
  onChangeRequest: PropTypes.func.isRequired,
  runDataRequest: PropTypes.func.isRequired,
  onSave: PropTypes.func.isRequired,
  responses: PropTypes.array.isRequired,
  dataRequest: PropTypes.object,
  changeTutorial: PropTypes.func.isRequired,
  project: PropTypes.object.isRequired,
  onDelete: PropTypes.func.isRequired,
};

const mapStateToProps = (state) => {
  return {
    responses: state.dataRequest.responses,
    project: state.project.active,
  };
};

const mapDispatchToProps = (dispatch) => {
  return {
    runDataRequest: (projectId, chartId, drId, getCache) => {
      return dispatch(runDataRequestAction(projectId, chartId, drId, getCache));
    },
    changeTutorial: (tutorial) => dispatch(changeTutorialAction(tutorial)),
  };
};

export default withRouter(connect(mapStateToProps, mapDispatchToProps)(CustomerioBuilder));
