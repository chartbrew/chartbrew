import React, { useEffect, useState } from "react";
import PropTypes from "prop-types";
import {
  Badge, Button, Col, Container, Divider, Dropdown, Grid, Input, Link,
  Loading, Popover, Row, Spacer, Switch, Text, Tooltip,
} from "@nextui-org/react";
import {
  format, getUnixTime, subDays, endOfDay, startOfDay
} from "date-fns";
import { DateRangePicker } from "react-date-range";
import { enGB } from "date-fns/locale";

import { ChevronDown, InfoCircle, Calendar } from "react-iconly";
import { runHelperMethod } from "../../../actions/connection";
import { primary, secondary } from "../../../config/colors";
import MessageTypeLabels from "./MessageTypeLabels";
import { defaultStaticRanges, defaultInputRanges } from "../../../config/dateRanges";

const periodOptions = [
  { key: "hours", value: "hours", text: "Hourly" },
  { key: "days", value: "days", text: "Daily" },
  { key: "weeks", value: "weeks", text: "Weekly" },
  { key: "months", value: "months", text: "Monthly" },
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
  const [journeyStart, setJourneyStart] = useState(startOfDay(subDays(new Date(), 30)));
  const [journeyEnd, setJourneyEnd] = useState(endOfDay(new Date()));

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
              color: campaign.active ? "success" : "error",
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

          if (request.configuration.start && request.configuration.end) {
            setJourneyStart(new Date(parseInt(request.configuration.start, 10) * 1000));
            setJourneyEnd(new Date(parseInt(request.configuration.end, 10) * 1000));
          } else {
            newConfig = {
              ...newConfig,
              start: getUnixTime(journeyStart),
              end: getUnixTime(journeyEnd),
            };
          }

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
    _fetchActions(newConfig);
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

  const _onChangeJourneyRange = (range) => {
    const newStartDate = startOfDay(new Date(range.selection.startDate));
    const newEndDate = endOfDay(new Date(range.selection.endDate));

    setJourneyStart(newStartDate);
    setJourneyEnd(newEndDate);

    setConfig({
      ...config,
      start: getUnixTime(newStartDate),
      end: getUnixTime(newEndDate),
    });
  };

  return (
    <Container css={{ pr: 0, pl: 0 }}>
      <Row>
        <Dropdown>
          <Dropdown.Trigger>
            <Input
              bordered
              label="Choose one of your campaigns"
              animated={false}
              contentRight={loading ? <Loading type="spinner" /> : <ChevronDown />}
              value={
                (config.campaignId && campaigns.find((c) => c.value === config.campaignId)?.text)
                || "Choose a campaign"
              }
            />
          </Dropdown.Trigger>
          <Dropdown.Menu
            onAction={(key) => _onSelectCampaign(key)}
            selectedKeys={[config.campaignId]}
            selectionMode="single"
          >
            {campaigns.map((campaign) => (
              <Dropdown.Item
                key={campaign.key}
                icon={<Badge color={campaign.label.color}>{campaign.label.content}</Badge>}
              >
                {campaign.text}
              </Dropdown.Item>
            ))}
          </Dropdown.Menu>
        </Dropdown>
      </Row>
      <Spacer y={1} />
      {config.campaignId && (
        <Row wrap="wrap">
          <Link
            css={{
              background: config.requestRoute.indexOf("metrics") === 0 ? "$background" : "$backgroundContrast",
              p: 5,
              pr: 10,
              pl: 10,
              br: "$sm",
              "@xsMax": { width: "90%" },
              ai: "center",
              color: "$text",
            }}
            onClick={_onSelectCampaignMetrics}
          >
            <Text>{"Campaign metrics"}</Text>
          </Link>
          <Spacer x={0.2} />
          <Link
            css={{
              background: config.requestRoute.indexOf("actions") === 0 ? "$background" : "$backgroundContrast",
              p: 5,
              pr: 10,
              pl: 10,
              br: "$sm",
              "@xsMax": { width: "90%" },
              ai: "center",
              color: "$text",
            }}
            onClick={_onSelectActionMetrics}
          >
            <Text>{"Action metrics"}</Text>
          </Link>
          <Spacer x={0.2} />
          <Link
            css={{
              background: config.requestRoute.indexOf("journey_metrics") === 0 ? "$background" : "$backgroundContrast",
              p: 5,
              pr: 10,
              pl: 10,
              br: "$sm",
              "@xsMax": { width: "90%" },
              ai: "center",
              color: "$text",
            }}
            onClick={_onSelectJourneyMetrics}
          >
            <Text>{"Journey metrics"}</Text>
          </Link>
        </Row>
      )}

      <Spacer y={0.5} />
      <Divider />
      <Spacer y={0.5} />

      {config.campaignId && config.requestRoute.indexOf("actions") === 0 && (
        <Row>
          <Dropdown>
            <Dropdown.Trigger>
              <Input
                bordered
                label="Select an action to view the metrics"
                animated={false}
                contentRight={actionsLoading ? <Loading type="spinner" /> : <ChevronDown />}
                fullWidth
                value={
                  (config.actionId
                    && availableActions.find((a) => a.value === config.actionId)?.text)
                  || "Select an action"
                }
              />
            </Dropdown.Trigger>
            <Dropdown.Menu
              onAction={(key) => _onSelectAction(key)}
              selectedKeys={[config.actionId]}
              selectionMode="single"
              css={{ minWidth: "max-content" }}
            >
              {availableActions.map((action) => (
                <Dropdown.Item key={action.key} value={action.value}>
                  {action.text}
                </Dropdown.Item>
              ))}
            </Dropdown.Menu>
          </Dropdown>
        </Row>
      )}
      {config.campaignId
        && (config.requestRoute.indexOf("metrics") === 0
          || config.requestRoute.indexOf("actions") > -1
          || config.requestRoute === "journey_metrics")
        && (
        <>
          <Spacer y={0.5} />
          <Row>
            <Text size={14}>What would you like this dataset to show?</Text>
          </Row>
          <Spacer y={0.2} />
          <Row wrap="wrap">
            <MessageTypeLabels
              selected={config.series}
              onSelect={_onSetSeries}
              mode={config.requestRoute === "journey_metrics" ? "journeys" : "messages"}
              showPrimary={config.requestRoute !== "journey_metrics"}
            />
          </Row>
          <Spacer y={0.5} />
          {(config.requestRoute.indexOf("/metrics") > -1 || config.requestRoute.indexOf("metrics") === 0) && (
            <>
              <Row>
                <Text size={14}>Or show the campaign link metrics</Text>
              </Row>
              <Spacer y={0.2} />
              <Row>
                <Badge
                  onClick={_onShowCampaingLinkMetrics}
                  color="primary"
                  variant={config.requestRoute.indexOf("metrics/links") > -1 ? "default" : "bordered"}
                  css={{ cursor: "pointer" }}
                >
                  {`Show ${config.requestRoute.indexOf("actions") > -1 ? "action" : "campaign"} link metrics`}
                </Badge>
              </Row>
            </>
          )}
        </>
        )}

      {config.campaignId
        && (config.requestRoute.indexOf("metrics") === 0
          || (config.requestRoute.indexOf("actions") === 0 && config.actionId)
        )
        && (
        <>
          <Spacer y={0.5} />
          <Row>
            <Grid.Container gap={0.5}>
              <Grid xs={12} sm={(config.series || config.actionId) ? 4 : 6}>
                <Dropdown>
                  <Dropdown.Trigger>
                    <Input
                      bordered
                      label="Choose the period"
                      animated={false}
                      contentRight={<ChevronDown />}
                      fullWidth
                      value={(periodOptions.find((p) => p.value === config.period)?.text) || "Choose a period"}
                    />
                  </Dropdown.Trigger>
                  <Dropdown.Menu
                    onAction={(key) => _onChangePeriod(key)}
                    selectedKeys={[config.period]}
                    selectionMode="single"
                  >
                    {periodOptions.map((period) => (
                      <Dropdown.Item key={period.key}>
                        {period.text}
                      </Dropdown.Item>
                    ))}
                  </Dropdown.Menu>
                </Dropdown>
              </Grid>
              <Grid xs={12} sm={(config.series || config.actionId) ? 4 : 6}>
                <Dropdown>
                  <Dropdown.Trigger>
                    <Input
                      bordered
                      label="Max number of steps"
                      animated={false}
                      contentRight={<ChevronDown />}
                      fullWidth
                      value={(stepsOptions.find((p) => p.value === config.steps)?.text) || "Choose a number"}
                    />
                  </Dropdown.Trigger>
                  <Dropdown.Menu
                    onAction={(key) => _onChangeSteps(key)}
                    selectedKeys={[config.steps]}
                    selectionMode="single"
                  >
                    {stepsOptions.map((steps) => (
                      <Dropdown.Item key={steps.key}>
                        {steps.text}
                      </Dropdown.Item>
                    ))}
                  </Dropdown.Menu>
                </Dropdown>
              </Grid>

              {(config.series || config.actionId) && (
                <Grid xs={12} sm={4} direction="column" justify="center">
                  <Text size={14}>Leave empty for *all* types</Text>
                  <Dropdown>
                    <Dropdown.Button flat>
                      Message types
                      <Spacer x={0.2} />
                      {config.type && config.type.length > 0 && (
                        <Badge variant="default" color="secondary" size="sm">
                          {config.type.length}
                        </Badge>
                      )}
                      {config.type && config.type.length === 0 && (
                        <Badge color="secondary" size="sm" variant="flat">
                          All
                        </Badge>
                      )}
                    </Dropdown.Button>
                    <Dropdown.Menu
                      onAction={(key) => {
                        // add to the list if not already in it
                        if (!config.type || !config.type.includes(key)) {
                          _onChangeMessageTypes(!config.type ? [key] : [...config.type, key]);
                        } else {
                          setConfig({ ...config, type: config.type.filter((t) => t !== key) });
                        }
                      }}
                      selectedKeys={config.type || []}
                      selectionMode="multiple"
                    >
                      {messageOptions.map((message) => (
                        <Dropdown.Item key={message.key}>
                          {message.text}
                        </Dropdown.Item>
                      ))}
                    </Dropdown.Menu>
                  </Dropdown>
                </Grid>
              )}
            </Grid.Container>
          </Row>
          {config.requestRoute.indexOf("links") > -1 && (
            <>
              <Spacer y={1} />
              <Row>
                <Grid.Container gap={0.5}>
                  <Grid xs={12} sm={6} direction="column">
                    <Text size={14}>Visualization type</Text>
                    <div style={styles.row}>
                      <Button
                        onClick={() => setConfig({ ...config, linksMode: "total" })}
                        size="sm"
                        bordered={config.linksMode !== "total"}
                        auto
                        color="secondary"
                      >
                        Total clicks
                      </Button>
                      <Spacer x={0.2} />
                      <Button
                        onClick={() => _onSelectClickTimeseries()}
                        bordered={config.linksMode !== "links"}
                        size="sm"
                        auto
                        color="secondary"
                      >
                        Click timeseries
                      </Button>
                    </div>
                  </Grid>
                  <Grid xs={12} sm={6} direction="column" justify="center">
                    <Text size={14}>Unique clicks per customer</Text>
                    <Switch
                      checked={config.unique}
                      onChange={() => setConfig({ ...config, unique: !config.unique })}
                      size="sm"
                    />
                  </Grid>
                </Grid.Container>
              </Row>
              {config.linksMode === "links" && (
                <>
                  <Spacer y={1} />
                  <Row align="center">
                    <Grid.Container gap={0.5}>
                      <Grid xs={12} sm={9}>
                        <Dropdown>
                          <Dropdown.Trigger>
                            <Input
                              bordered
                              label="Select a link"
                              animated={false}
                              contentRight={linksLoading ? <Loading type="spinner" /> : <ChevronDown />}
                              fullWidth
                              value={config.selectedLink || "Select a link"}
                            />
                          </Dropdown.Trigger>
                          <Dropdown.Menu
                            onAction={(key) => setConfig({ ...config, selectedLink: key })}
                            selectedKeys={[config.selectedLink]}
                            selectionMode="single"
                            css={{ minWidth: "max-content" }}
                          >
                            {availableLinks.map((link) => (
                              <Dropdown.Item key={link.key}>
                                {link.text}
                              </Dropdown.Item>
                            ))}
                          </Dropdown.Menu>
                        </Dropdown>
                      </Grid>
                      <Grid xs={12} sm={3} alignItems="flex-end">
                        <Button
                          onClick={() => _onSelectClickTimeseries()}
                          auto
                          color="secondary"
                        >
                          Refresh links
                        </Button>
                        <Spacer x={0.2} />
                        <Tooltip
                          content="You can select only one link, but if you wish to compare multiple links on the same chart, you can create a new dataset with another link."
                          css={{ zIndex: 10000, maxWidth: 500 }}
                        >
                          <InfoCircle />
                        </Tooltip>
                      </Grid>
                    </Grid.Container>
                  </Row>
                </>
              )}
            </>
          )}
        </>
        )}

      {config.campaignId && config.requestRoute === "journey_metrics" && config.series && (
        <>
          <Spacer y={0.5} />
          <Row>
            <Popover>
              <Popover.Trigger>
                <Input
                  label="Select the start and end date of the journey"
                  placeholder="Click to select a date"
                  contentLeft={<Calendar />}
                  bordered
                  fullWidth
                  value={`${format(journeyStart, "dd MMMM yyyy")} - ${format(journeyEnd, "dd MMMM yyyy")}`}
                />
              </Popover.Trigger>
              <Popover.Content>
                <DateRangePicker
                  locale={enGB}
                  direction="horizontal"
                  rangeColors={[secondary, primary]}
                  ranges={[{ startDate: journeyStart, endDate: journeyEnd, key: "selection" }]}
                  onChange={_onChangeJourneyRange}
                  staticRanges={defaultStaticRanges}
                  inputRanges={defaultInputRanges}
                />
              </Popover.Content>
            </Popover>
            <Spacer x={0.5} />
            <Dropdown>
              <Dropdown.Trigger>
                <Input
                  bordered
                  label="Select the period"
                  animated={false}
                  contentRight={<ChevronDown />}
                  fullWidth
                  value={
                    config.period && periodOptions.find((p) => p.value === config.period)?.text
                  }
                />
              </Dropdown.Trigger>
              <Dropdown.Menu
                onAction={(key) => _onChangePeriod(key)}
                selectedKeys={[config.period]}
                selectionMode="single"
              >
                {periodOptions.map((period) => (
                  <Dropdown.Item key={period.value}>
                    {period.text}
                  </Dropdown.Item>
                ))}
              </Dropdown.Menu>
            </Dropdown>
          </Row>
          <Spacer y={0.5} />
          <Row>
            <Col>
              <Text size={14}>Type of messages. Leave empty for *all* types</Text>
              <Dropdown>
                <Dropdown.Button flat>
                  Message types
                  <Spacer x={0.2} />
                  {config.type && config.type.length > 0 && (
                    <Badge variant="default" color="secondary" size="sm">
                      {config.type.length}
                    </Badge>
                  )}
                  {config.type && config.type.length === 0 && (
                    <Badge color="secondary" size="sm" variant="flat">
                      All
                    </Badge>
                  )}
                </Dropdown.Button>
                <Dropdown.Menu
                  onAction={(key) => {
                    // add to the list if not already in it
                    if (!config.type || !config.type.includes(key)) {
                      _onChangeMessageTypes(!config.type ? [key] : [...config.type, key]);
                    } else {
                      setConfig({ ...config, type: config.type.filter((t) => t !== key) });
                    }
                  }}
                  selectedKeys={config.type || []}
                  selectionMode="multiple"
                >
                  {messageOptions.map((message) => (
                    <Dropdown.Item key={message.key}>
                      {message.text}
                    </Dropdown.Item>
                  ))}
                </Dropdown.Menu>
              </Dropdown>
            </Col>
          </Row>
        </>
      )}

      {config.campaignId
      && (
        ((config.series || config.requestRoute === "metrics/links") && config.period && config.steps)
        || (config.actionId && config.period && config.steps && (config.series || config.requestRoute.indexOf("metrics/links") > -1))
      ) && (
        <>
          <Spacer y={1} />
          <Text>
            Looking good! You can now press the
            <strong style={{ color: primary }}>{" \"Make the request\" "}</strong>
            button
          </Text>
        </>
      )}
    </Container>
  );
}

const styles = {
  row: {
    display: "flex",
    flexDirection: "row",
    alignItems: "center",
  },
};

CampaignsQuery.propTypes = {
  projectId: PropTypes.number.isRequired,
  connectionId: PropTypes.number.isRequired,
  onUpdate: PropTypes.func.isRequired,
  request: PropTypes.object.isRequired,
};

export default CampaignsQuery;
