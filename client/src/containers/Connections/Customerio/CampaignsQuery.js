import React, { useEffect, useState } from "react";
import PropTypes from "prop-types";
import {
  Dropdown, Form, Icon, Label
} from "semantic-ui-react";

import { runHelperMethod } from "../../../actions/connection";

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

// TODO: add a for loop to go through the max numbers based on the frequency

function CampaignsQuery(props) {
  const {
    projectId, connectionId, onUpdate, request,
  } = props;

  const [loading, setLoading] = useState(false);
  const [campaigns, setCampaigns] = useState([]);
  const [config, setConfig] = useState({});
  const [stepsOptions, setStepsOptions] = useState([]);

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
        if (request && !request.configuration) {
          setConfig({});
        } else {
          setConfig({
            ...request.configuration,
          });
        }

        // set default steps options
        _onChangeStepOptions((request.configuration && request.configuration.period) || "days");
      })
      .catch(() => setLoading(false));
  }, []);

  useEffect(() => {
    if (config && config.campaignId) {
      onUpdate(config);
    }
  }, [config]);

  const _onSelectCampaign = (cId) => {
    setConfig({
      ...config,
      campaignId: cId,
      requestRoute: "metrics",
    });
  };

  const _onSetSeries = (type) => {
    setConfig({
      ...config,
      series: type,
    });
  };

  const _onChangePeriod = (value) => {
    setConfig({
      ...config,
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
            <label>What would you like this dataset to show?</label>
            <Label.Group>
              <Label
                as="a"
                onClick={() => _onSetSeries("delivered")}
                color={config.series === "delivered" ? "primary" : null}
              >
                <Icon name="star outline" />
                Delivered
              </Label>
              <Label
                as="a"
                onClick={() => _onSetSeries("opened")}
                color={config.series === "opened" ? "primary" : null}
              >
                <Icon name="star outline" />
                Opened
              </Label>
              <Label
                as="a"
                onClick={() => _onSetSeries("clicked")}
                color={config.series === "clicked" ? "primary" : null}
              >
                <Icon name="star outline" />
                Clicked
              </Label>
              <Label
                as="a"
                onClick={() => _onSetSeries("converted")}
                color={config.series === "converted" ? "primary" : null}
              >
                <Icon name="star outline" />
                Converted
              </Label>
              <Label
                as="a"
                onClick={() => _onSetSeries("attempted")}
                color={config.series === "attempted" ? "primary" : null}
              >
                Attempted
              </Label>
              <Label
                as="a"
                onClick={() => _onSetSeries("bounced")}
                color={config.series === "bounced" ? "primary" : null}
              >
                Bounced
              </Label>
              <Label
                as="a"
                onClick={() => _onSetSeries("created")}
                color={config.series === "created" ? "primary" : null}
              >
                Created
              </Label>
              <Label
                as="a"
                onClick={() => _onSetSeries("drafted")}
                color={config.series === "drafted" ? "primary" : null}
              >
                Drafted
              </Label>
              <Label
                as="a"
                onClick={() => _onSetSeries("dropped")}
                color={config.series === "dropped" ? "primary" : null}
              >
                Dropped
              </Label>
              <Label
                as="a"
                onClick={() => _onSetSeries("failed")}
                color={config.series === "failed" ? "primary" : null}
              >
                Failed
              </Label>
              <Label
                as="a"
                onClick={() => _onSetSeries("sent")}
                color={config.series === "sent" ? "primary" : null}
              >
                Sent
              </Label>
              <Label
                as="a"
                onClick={() => _onSetSeries("spammed")}
                color={config.series === "spammed" ? "primary" : null}
              >
                Spammed
              </Label>
              <Label
                as="a"
                onClick={() => _onSetSeries("undeliverable")}
                color={config.series === "undeliverable" ? "primary" : null}
              >
                Undeliverable
              </Label>
              <Label
                as="a"
                onClick={() => _onSetSeries("unsubscribed")}
                color={config.series === "unsubscribed" ? "primary" : null}
              >
                Unsubscribed
              </Label>
              <Label
                as="a"
                onClick={() => _onSetSeries("2xx")}
                color={config.series === "2xx" ? "primary" : null}
              >
                2xx responses
              </Label>
              <Label
                as="a"
                onClick={() => _onSetSeries("3xx")}
                color={config.series === "3xx" ? "primary" : null}
              >
                3xx responses
              </Label>
              <Label
                as="a"
                onClick={() => _onSetSeries("4xx")}
                color={config.series === "4xx" ? "primary" : null}
              >
                4xx responses
              </Label>
              <Label
                as="a"
                onClick={() => _onSetSeries("5xx")}
                color={config.series === "5xx" ? "primary" : null}
              >
                5xx responses
              </Label>
            </Label.Group>
          </Form.Field>
        )}
        {config.campaignId && config.series && (
          <Form.Group widths={2}>
            <Form.Field>
              <label>Choose the period</label>
              <Dropdown
                selection
                search
                options={periodOptions}
                value={config.period}
                onChange={(e, data) => _onChangePeriod(data.value)}
              />
            </Form.Field>
            <Form.Field>
              <label>Max number of points on the chart</label>
              <Dropdown
                selection
                search
                options={stepsOptions}
                value={config.steps}
                onChange={(e, data) => _onChangeSteps(data.value)}
              />
            </Form.Field>
          </Form.Group>
        )}
        {config.campaignId && config.series && (
          <Form.Field>
            <label>Show the messages of the following types. Leave empty for *all* types</label>
            <Dropdown
              selection
              multiple
              search
              placeholder="Type of messages"
              options={messageOptions}
              value={config.type}
              onChange={(e, data) => _onChangeMessageTypes(data.value)}
              style={{ minWidth: 300 }}
            />
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
