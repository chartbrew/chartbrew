import React, { useEffect, useState } from "react";
import PropTypes from "prop-types";
import {
  Button,
  Checkbox,
  Divider,
  Dropdown, Form, Icon, Label, Menu, Popup
} from "semantic-ui-react";

import { runHelperMethod } from "../../../actions/connection";
import { primary } from "../../../config/colors";
import MessageTypeLabels from "./MessageTypeLabels";

const periodOptions = [
  { key: "hours", value: "hours", text: "Hours" },
  { key: "days", value: "days", text: "Days" },
  { key: "weeks", value: "weeks", text: "Weeks" },
  { key: "months", value: "months", text: "Months" },
];

const messageOptions = [
  { key: "email", value: "email", text: "Email" },
  { key: "webhook", value: "webhook", text: "Webhook" },
  { key: "twilio", value: "twilio", text: "Twilio" },
  { key: "urban_airship", value: "urban_airship", text: "Urban Airship" },
  { key: "slack", value: "slack", text: "Slack" },
  { key: "push", value: "push", text: "Push" },
];

const configDefaults = {
  requestRoute: "",
  linksMode: "total",
  unique: false,
  steps: 30,
};

// TODO: add a for loop to go through the max numbers based on the frequency

function CampaignsQuery(props) {
  const {
    projectId, connectionId, onUpdate, request,
  } = props;

  const [loading, setLoading] = useState(false);
  const [campaigns, setCampaigns] = useState([]);
  const [config, setConfig] = useState(configDefaults);
  const [stepsOptions, setStepsOptions] = useState([]);
  const [availableLinks, setAvailableLinks] = useState([]);
  const [linksLoading, setLinksLoading] = useState(false);
  const [availableActions, setAvailableActions] = useState([]);
  const [actionsLoading, setActionsLoading] = useState(false);

  useEffect(() => {
    // get segments
    setLoading(true);
    runHelperMethod(projectId, connectionId, "getAllCampaigns")
      .then((campaignData) => {
        const campaignOptions = campaignData.map((campaign) => {
          return {
            text: campaign.name,
            value: campaign.id,
            key: campaign.id,
            label: {
              content: campaign.active ? "Running" : "Stopped",
              color: campaign.active ? "green" : "red",
              size: "tiny",
              icon: campaign.active ? "circle" : "square",
            },
          };
        });

        setCampaigns(campaignOptions);
        setLoading(false);

        // initialize the config state
        let newConfig = { ...config };
        if (request && request.configuration) {
          newConfig = {
            ...newConfig,
            ...request.configuration,
          };

          setConfig(newConfig);

          if (request.configuration.linksMode === "links" && request.configuration.selectedLink) {
            _onSelectClickTimeseries(newConfig);
          }

          _fetchActions(newConfig);
        }

        // set default steps options
        _onChangePeriod((request.configuration && request.configuration.period) || "days", newConfig);
      })
      .catch(() => setLoading(false));
  }, []);

  useEffect(() => {
    if (config && config.campaignId) {
      onUpdate(config);
    }
  }, [config]);

  useEffect(() => {
    _onSelectClickTimeseries();
  }, [config.requestRoute]);

  const _onSelectCampaign = (cId) => {
    const newConfig = {
      ...config,
      campaignId: cId,
    };
    setConfig(newConfig);

    _onSelectClickTimeseries(newConfig);
  };

  const _onSelectCampaignMetrics = () => {
    setConfig({
      ...config,
      requestRoute: "metrics",
    });
  };

  const _fetchActions = (fetchConfig = config) => {
    setActionsLoading(true);
    runHelperMethod(projectId, connectionId, "getCampaignActions", { campaignId: fetchConfig.campaignId })
      .then((actions) => {
        setActionsLoading(false);
        setAvailableActions(actions.map((a) => ({
          key: a.id,
          value: a.id,
          text: a.name,
        })));
      })
      .catch(() => {
        setActionsLoading(false);
      });
  };

  const _onSelectActionMetrics = () => {
    let requestRoute = "actions";
    if (config.actionId) {
      requestRoute = `actions/${config.actionId}/metrics`;
    }

    setConfig({
      ...config,
      requestRoute,
    });

    if (availableActions.length === 0) {
      setActionsLoading(true);
      _fetchActions();
    }
  };

  const _onSelectJourneyMetrics = () => {
    setConfig({
      ...config,
      requestRoute: "journey_metrics",
    });
  };

  const _onShowCampaingLinkMetrics = () => {
    if (config.requestRoute.indexOf("links") === -1) {
      setConfig({
        ...config,
        series: "",
        requestRoute: `${config.requestRoute}/links`,
      });
    }
  };

  const _onSelectAction = (value) => {
    const newConfig = {
      ...config,
      actionId: value,
      requestRoute: `actions/${value}/metrics`,
    };

    setConfig(newConfig);

    _onSelectClickTimeseries(newConfig);
  };

  const _onSetSeries = (type) => {
    setConfig({
      ...config,
      series: type,
      requestRoute: config.requestRoute.replace("/links", ""),
    });
  };

  const _onChangePeriod = (value, newConfig = config) => {
    setConfig({
      ...newConfig,
      period: value,
    });

    _onChangeStepOptions(value);
  };

  const _onChangeSteps = (value) => {
    setConfig({
      ...config,
      steps: value,
    });
  };

  const _onChangeMessageTypes = (value) => {
    setConfig({
      ...config,
      type: value,
    });
  };

  const _onChangeStepOptions = (type) => {
    const steps = [];
    const valueTemplate = (index, period) => ({
      key: index,
      value: index,
      text: `last ${index} ${period}${(index > 1 && "s") || ""}`
    });

    if (type === "days") {
      for (let i = 45; i > 0; i--) {
        steps.push(valueTemplate(i, "day"));
      }
    } else if (type === "hours") {
      for (let i = 24; i > 0; i--) {
        steps.push(valueTemplate(i, "hour"));
      }
    } else if (type === "weeks") {
      for (let i = 12; i > 0; i--) {
        steps.push(valueTemplate(i, "week"));
      }
    } else if (type === "months") {
      for (let i = 12; i > 0; i--) {
        steps.push(valueTemplate(i, "month"));
      }
    }

    setStepsOptions(steps);
  };

  const _onSelectClickTimeseries = (conf) => {
    let newConfig = conf;
    if (!conf) newConfig = config;

    setConfig({ ...newConfig, linksMode: "links" });
    setLinksLoading(true);
    runHelperMethod(projectId, connectionId, "getCampaignLinks", {
      campaignId: newConfig.campaignId,
      actionId: newConfig.requestRoute.indexOf("actions") > -1 ? newConfig.actionId : null,
    })
      .then((links) => {
        if (links) {
          const newAvailableLinks = links.map((link) => {
            return {
              key: link,
              value: link,
              text: link,
            };
          });
          setAvailableLinks(newAvailableLinks);
        }

        setLinksLoading(false);
      })
      .catch(() => {
        setLinksLoading(false);
      });
  };

  return (
    <div>
      <Form size="small">
        <Form.Field>
          <label>Choose one of your campaigns</label>
          <Dropdown
            selection
            search
            placeholder="Choose a campaign"
            value={config.campaignId}
            options={campaigns}
            style={{ minWidth: 300 }}
            onChange={(e, data) => _onSelectCampaign(data.value)}
            loading={loading}
            disabled={loading}
          />
        </Form.Field>
        {config.campaignId && (
          <Form.Field>
            <Menu secondary size="small">
              <Menu.Item
                name="Campaign metrics"
                active={config.requestRoute.indexOf("metrics") === 0}
                onClick={_onSelectCampaignMetrics}
              />
              <Menu.Item
                name="Action metrics"
                active={config.requestRoute.indexOf("actions") === 0}
                onClick={_onSelectActionMetrics}
              />
              <Menu.Item
                name="Journey metrics"
                active={config.requestRoute.indexOf("journey_metrics") === 0}
                onClick={_onSelectJourneyMetrics}
              />
            </Menu>
            <Divider />
          </Form.Field>
        )}
        {config.campaignId && config.requestRoute.indexOf("actions") === 0 && (
          <Form.Field>
            <label>Select an action to view the metrics</label>
            <Dropdown
              selection
              search
              options={availableActions}
              value={config.actionId}
              onChange={(e, data) => _onSelectAction(data.value)}
              loading={actionsLoading}
              disabled={actionsLoading}
            />
          </Form.Field>
        )}
        {config.campaignId
          && (config.requestRoute.indexOf("metrics") === 0 || config.requestRoute.indexOf("actions") > -1)
          && (
          <>
            <Form.Field>
              <label>What would you like this dataset to show?</label>
              <MessageTypeLabels
                selected={config.series}
                onSelect={_onSetSeries}
              />
            </Form.Field>
            {(config.requestRoute.indexOf("/metrics") > -1 || config.requestRoute.indexOf("metrics") === 0) && (
              <Form.Field>
                <label>Or show the campaign link metrics</label>
                <Label
                  as="a"
                  onClick={_onShowCampaingLinkMetrics}
                  color={config.requestRoute.indexOf("metrics/links") > -1 ? "primary" : null}
                >
                  {"Show "}
                  {config.requestRoute.indexOf("actions") > -1 ? "action" : "campaign"}
                  {" link metrics"}
                </Label>
              </Form.Field>
            )}
          </>
          )}

        {config.campaignId
          && (config.requestRoute.indexOf("metrics") === 0
            || (config.requestRoute.indexOf("actions") === 0 && config.actionId)
          )
          && (
          <>
            <Form.Group widths={3}>
              <Form.Field width={4}>
                <label>Choose the period</label>
                <Dropdown
                  selection
                  search
                  options={periodOptions}
                  value={config.period}
                  onChange={(e, data) => _onChangePeriod(data.value)}
                />
              </Form.Field>
              <Form.Field width={6}>
                <label>Max number of points on the chart</label>
                <Dropdown
                  selection
                  search
                  options={stepsOptions}
                  value={config.steps}
                  onChange={(e, data) => _onChangeSteps(data.value)}
                />
              </Form.Field>
              {(config.series || config.actionId) && (
                <Form.Field width={6}>
                  <label>Type of messages. Leave empty for *all* types</label>
                  <Dropdown
                    selection
                    multiple
                    search
                    placeholder="Enter types to filter"
                    options={messageOptions}
                    value={config.type}
                    onChange={(e, data) => _onChangeMessageTypes(data.value)}
                    style={{ minWidth: 300 }}
                />
                </Form.Field>
              )}
            </Form.Group>
            {config.requestRoute.indexOf("links") > -1 && (
              <>
                <Form.Group widths={2}>
                  <Form.Field>
                    <label>Visualization type</label>
                    <Button
                      content="Total clicks"
                      onClick={() => setConfig({ ...config, linksMode: "total" })}
                      primary={config.linksMode === "total"}
                      size="tiny"
                    />
                    <Button
                      content="Clicks timeseries"
                      onClick={() => _onSelectClickTimeseries()}
                      primary={config.linksMode === "links"}
                      size="tiny"
                    />
                  </Form.Field>
                  <Form.Field>
                    <label>Unique clicks per customer</label>
                    <Checkbox
                      toggle
                      checked={config.unique}
                      onChange={() => setConfig({ ...config, unique: !config.unique })}
                    />
                  </Form.Field>
                </Form.Group>
                {config.linksMode === "links" && (
                  <Form.Group widths={2}>
                    <Form.Field width={13}>
                      <label>
                        {"Select a link "}
                        <Popup
                          trigger={(
                            <Icon name="question circle outline" color="primary" />
                          )}
                          inverted
                          content="You can select only one link, but if you wish to compare multiple links on the same chart, you can create a new dataset with another link."
                          size="small"
                        />
                      </label>
                      <Dropdown
                        options={availableLinks}
                        loading={linksLoading}
                        value={config.selectedLink}
                        onChange={(e, data) => setConfig({ ...config, selectedLink: data.value })}
                        selection
                        search
                      />
                    </Form.Field>
                    <Form.Field width={3}>
                      <label>&nbsp;</label>
                      <Button
                        content="Refresh links"
                        size="small"
                        onClick={() => _onSelectClickTimeseries()}
                      />
                    </Form.Field>
                  </Form.Group>
                )}
              </>
            )}
          </>
          )}

        {config.campaignId
        && (
          ((config.series || config.requestRoute === "metrics/links") && config.period && config.steps)
          || (config.actionId && config.period && config.steps && (config.series || config.requestRoute.indexOf("metrics/links") > -1))
        ) && (
          <Form.Field>
            <p>
              Looking good! You can now press the
              <strong style={{ color: primary }}>{" \"Make the request\" "}</strong>
              button
            </p>
          </Form.Field>
        )}
      </Form>
    </div>
  );
}

CampaignsQuery.propTypes = {
  projectId: PropTypes.number.isRequired,
  connectionId: PropTypes.number.isRequired,
  onUpdate: PropTypes.func.isRequired,
  request: PropTypes.object.isRequired,
};

export default CampaignsQuery;
