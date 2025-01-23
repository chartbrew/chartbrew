import React, { useEffect, useState } from "react";
import PropTypes from "prop-types";
import {
  Chip, Button, Divider, Input, Popover, Spacer, Switch, Tooltip, Select,
  SelectItem, Tabs, Tab, PopoverTrigger, PopoverContent,
} from "@heroui/react";
import {
  format, getUnixTime, subDays, endOfDay, startOfDay
} from "date-fns";
import { DateRangePicker } from "react-date-range";
import { enGB } from "date-fns/locale";

import { runHelperMethod } from "../../../slices/connection";
import { primary, secondary } from "../../../config/colors";
import MessageTypeLabels from "./MessageTypeLabels";
import { defaultStaticRanges, defaultInputRanges } from "../../../config/dateRanges";
import Row from "../../../components/Row";
import Text from "../../../components/Text";
import { LuCalendarDays, LuInfo } from "react-icons/lu";
import { useDispatch } from "react-redux";
import { useParams } from "react-router";

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
    connectionId, onUpdate, request,
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

  const dispatch = useDispatch();
  const params = useParams();

  useEffect(() => {
    // get segments
    setLoading(true);
    dispatch(runHelperMethod({
      team_id: params.teamId,
      connection_id: connectionId,
      methodName: "getAllCampaigns"
    }))
      .then((data) => {
        const campaignData = data.payload;
        const campaignOptions = campaignData.map((campaign) => {
          return {
            text: campaign.name,
            value: campaign.id,
            key: campaign.id,
            label: {
              content: campaign.active ? "Running" : "Stopped",
              color: campaign.active ? "success" : "danger",
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
    dispatch(runHelperMethod({
      team_id: params.teamId,
      connection_id: connectionId,
      methodName: "getCampaignActions",
      params: { campaignId: fetchConfig.campaignId }
    }))
      .then((data) => {
        const actions = data.payload;
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
    dispatch(runHelperMethod({
      team_id: params.teamId,
      connection_id: connectionId,
      methodName: "getCampaignLinks",
      params: {
        campaignId: newConfig.campaignId,
        actionId: newConfig.requestRoute.indexOf("actions") > -1 ? newConfig.actionId : null,
      },
    }))
      .then((data) => {
        const links = data.payload;
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

  const _getSelectedTab = () => {
    if (config.requestRoute.indexOf("metrics") === 0) return "metrics";
    if (config.requestRoute.indexOf("actions") === 0) return "actions";
    if (config.requestRoute.indexOf("journey_metrics") === 0) return "journey_metrics";
    return "";  
  }

  return (
    <div className={"w-full"}>
      <Row>
        <Select
          variant="bordered"
          label="Choose one of your campaigns"
          onSelectionChange={(keys) => _onSelectCampaign(keys.currentKey)}
          selectedKeys={[config.campaignId]}
          selectionMode="single"
          isLoading={loading}
          aria-label="Select a campaign"
        >
          {campaigns.map((campaign) => (
            <SelectItem
              key={campaign.key}
              startContent={(
                <Chip color={campaign.label.color} size="sm" className="min-w-[70px] text-center" variant="flat">
                  {campaign.label.content}
                </Chip>
              )}
              textValue={campaign.text}
            >
              {campaign.text}
            </SelectItem>
          ))}
        </Select>
      </Row>
      <Spacer y={2} />
      {config.campaignId && (
        <Row wrap="wrap">
          <Tabs
            selectedKey={_getSelectedTab()}
            onSelectionChange={(key) => {
              if (key === "metrics") _onSelectCampaignMetrics();
              if (key === "actions") _onSelectActionMetrics();
              if (key === "journey_metrics") _onSelectJourneyMetrics();
            }}
          >
            <Tab key="metrics" title="Metrics" />
            <Tab key="actions" title="Actions" />
            <Tab key="journey_metrics" title="Journey metrics" />
          </Tabs>
        </Row>
      )}

      <Spacer y={2} />
      <Divider />
      <Spacer y={4} />

      {config.campaignId && config.requestRoute.indexOf("actions") === 0 && (
        <Row>
          <Select
            variant="bordered"
            label="Select an action to view the metrics"
            isLoading={actionsLoading}
            onSelectionChange={(keys) => _onSelectAction(keys.currentKey)}
            selectedKeys={[config.actionId]}
            selectionMode="single"
            aria-label="Select an action"
          >
            {availableActions.map((action) => (
              <SelectItem key={action.key} textValue={action.text}>
                {action.text}
              </SelectItem>
            ))}
          </Select>
        </Row>
      )}
      {config.campaignId
        && (config.requestRoute.indexOf("metrics") === 0
          || config.requestRoute.indexOf("actions") > -1
          || config.requestRoute === "journey_metrics")
        && (
        <>
          <Spacer y={2} />
          <Row>
            <Text>What would you like this dataset to show?</Text>
          </Row>
          <Spacer y={1} />
          <Row wrap="wrap">
            <MessageTypeLabels
              selected={config.series}
              onSelect={_onSetSeries}
              mode={config.requestRoute === "journey_metrics" ? "journeys" : "messages"}
              showPrimary={config.requestRoute !== "journey_metrics"}
            />
          </Row>
          <Spacer y={2} />
          {(config.requestRoute.indexOf("/metrics") > -1 || config.requestRoute.indexOf("metrics") === 0) && (
            <>
              <Row>
                <Text>Or show the campaign link metrics</Text>
              </Row>
              <Spacer y={1} />
              <Row>
                <Chip
                  onClick={_onShowCampaingLinkMetrics}
                  color="primary"
                  variant={config.requestRoute.indexOf("metrics/links") > -1 ? "solid" : "bordered"}
                  className="cursor-pointer"
                >
                  {`Show ${config.requestRoute.indexOf("actions") > -1 ? "action" : "campaign"} link metrics`}
                </Chip>
              </Row>
              <Spacer y={2} />
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
          <Spacer y={2} />
          <div className="flex flex-row gap-2 w-full">
            <Select
              variant="bordered"
              label="Choose the period"
              onSelectionChange={(keys) => _onChangePeriod(keys.currentKey)}
              selectedKeys={[config.period]}
              selectionMode="single"
              aria-label="Select a period"
            >
              {periodOptions.map((period) => (
                <SelectItem key={period.key} textValue={period.text}>
                  {period.text}
                </SelectItem>
              ))}
            </Select>
            <Select
              variant="bordered"
              label="Max number of steps"
              onSelectionChange={(keys) => _onChangeSteps(keys.currentKey)}
              selectedKeys={[config.steps]}
              selectionMode="single"
              aria-label="Select the number of steps"
            >
              {stepsOptions.map((steps) => (
                <SelectItem key={steps.key} textValue={steps.text}>
                  {steps.text}
                </SelectItem>
              ))}
            </Select>
          </div>
        
          {(config.series || config.actionId) && (
            <div className="mt-2">
              <Select
                variant="bordered"
                label="Message types"
                renderValue={(items) => (
                  <div className="flex flex-wrap gap-2">
                    {items.map((item) => (
                      <Chip key={item.key} variant="flat" size="sm">
                        {item.textValue}
                      </Chip>
                    ))}
                  </div>
                )}
                onSelectionChange={(keys) => {
                  // add to the list if not already in it
                  if (!config.type || !config.type.includes(keys.currentKey)) {
                    _onChangeMessageTypes(!config.type ? [keys.currentKey] : [...config.type, keys.currentKey]);
                  } else {
                    setConfig({ ...config, type: [...keys] });
                  }
                }}
                selectedKeys={config.type || []}
                selectionMode="multiple"
                aria-label="Select message types"
              >
                {messageOptions.map((message) => (
                  <SelectItem key={message.key} textValue={message.text}>
                    {message.text}
                  </SelectItem>
                ))}
              </Select>
            </div>
          )}
          {config.requestRoute.indexOf("links") > -1 && (
            <>
              <Spacer y={2} />
              <Row>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-2 items-end">
                  <div>
                    <Text>Visualization type</Text>
                    <div style={styles.row}>
                      <Button
                        onClick={() => setConfig({ ...config, linksMode: "total" })}
                        size="sm"
                        variant={config.linksMode !== "total" ? "bordered" : "solid"}
                        color="secondary"
                      >
                        Total clicks
                      </Button>
                      <Spacer x={1} />
                      <Button
                        onClick={() => _onSelectClickTimeseries()}
                        variant={config.linksMode !== "links" ? "bordered" : "solid"}
                        size="sm"
                        color="secondary"
                      >
                        Click timeseries
                      </Button>
                    </div>
                  </div>
                  <div>
                    <Switch
                      isSelected={config.unique}
                      onChange={() => setConfig({ ...config, unique: !config.unique })}
                      size="sm"
                    >
                      Unique clicks per customer
                    </Switch>
                  </div>
                </div>
              </Row>
              {config.linksMode === "links" && (
                <>
                  <Spacer y={2} />
                  <Row align="center">
                    <div className="grid grid-cols-12 gap-2">
                      <div className="col-span-12 md:col-span-9">
                        <Select
                          variant="bordered"
                          placeholder="Select a link"
                          isLoading={linksLoading}
                          onSelectionChange={(keys) => setConfig({ ...config, selectedLink: keys.currentKey })}
                          selectedKeys={[config.selectedLink]}
                          selectionMode="single"
                          aria-label="Select a link"
                        >
                          {availableLinks.map((link) => (
                            <SelectItem key={link.key} textValue={link.text}>
                              {link.text}
                            </SelectItem>
                          ))}
                        </Select>
                      </div>
                      <div className="col-span-12 md:col-span-3 flex items-center">
                        <Button
                          onClick={() => _onSelectClickTimeseries()}
                          color="secondary"
                        >
                          Refresh links
                        </Button>
                        <Spacer x={1} />
                        <Tooltip
                          content="You can select only one link, but if you wish to compare multiple links on the same chart, you can create a new dataset with another link."
                          className="max-w-[500px]"
                        >
                          <div><LuInfo /></div>
                        </Tooltip>
                      </div>
                    </div>
                  </Row>
                </>
              )}
            </>
          )}
        </>
        )}

      {config.campaignId && config.requestRoute === "journey_metrics" && config.series && (
        <>
          <Spacer y={2} />
          <Row>
            <Popover>
              <PopoverTrigger>
                <Input
                  label="Select the start and end date of the journey"
                  placeholder="Click to select a date"
                  startContent={<LuCalendarDays />}
                  variant="bordered"
                  fullWidth
                  value={`${format(journeyStart, "dd MMMM yyyy")} - ${format(journeyEnd, "dd MMMM yyyy")}`}
                  classNames={{ input: "text-start" }}
                />
              </PopoverTrigger>
              <PopoverContent>
                <DateRangePicker
                  locale={enGB}
                  direction="horizontal"
                  rangeColors={[secondary, primary]}
                  ranges={[{ startDate: journeyStart, endDate: journeyEnd, key: "selection" }]}
                  onChange={_onChangeJourneyRange}
                  staticRanges={defaultStaticRanges}
                  inputRanges={defaultInputRanges}
                />
              </PopoverContent>
            </Popover>
            <Spacer x={1} />
            <Select
              variant="bordered"
              label="Select the period"
              onSelectionChange={(keys) => _onChangePeriod(keys.currentKey)}
              selectedKeys={[config.period]}
              selectionMode="single"
              aria-label="Select a period"
            >
              {periodOptions.map((period) => (
                <SelectItem key={period.value} textValue={period.text}>
                  {period.text}
                </SelectItem>
              ))}
            </Select>
          </Row>
          <Spacer y={2} />
          <Row>
            <Select
              variant="bordered"
              label="Message types"
              renderValue={(items) => (
                <div className="flex flex-wrap gap-2">
                  {items.map((item) => (
                    <Chip key={item.key} variant="flat" size="sm">
                      {item.textValue}
                    </Chip>
                  ))}
                </div>
              )}
              onSelectionChange={(keys) => {
                // add to the list if not already in it
                if (!config.type || !config.type.includes(keys.currentKey)) {
                  _onChangeMessageTypes(!config.type ? [keys.currentKey] : [...config.type, keys.currentKey]);
                } else {
                  setConfig({ ...config, type: [...keys] });
                }
              }}
              selectedKeys={config.type || []}
              selectionMode="multiple"
              aria-label="Select message types"
            >
              {messageOptions.map((message) => (
                <SelectItem key={message.key} textValue={message.text}>
                  {message.text}
                </SelectItem>
              ))}
            </Select>
          </Row>
        </>
      )}

      {config.campaignId
      && (
        ((config.series || config.requestRoute === "metrics/links") && config.period && config.steps)
        || (config.actionId && config.period && config.steps && (config.series || config.requestRoute.indexOf("metrics/links") > -1))
      ) && (
        <>
          <Spacer y={4} />
          <Text>
            Looking good! You can now press the
            <strong className="text-primary">{" \"Make the request\" "}</strong>
            button
          </Text>
        </>
      )}
    </div>
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
  connectionId: PropTypes.number.isRequired,
  onUpdate: PropTypes.func.isRequired,
  request: PropTypes.object.isRequired,
};

export default CampaignsQuery;
