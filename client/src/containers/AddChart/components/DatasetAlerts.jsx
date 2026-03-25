import React, { Fragment, useEffect, useRef, useState } from "react";
import PropTypes from "prop-types";
import {
  Chip, Button, Checkbox, Input, Link, Modal,
  Switch, Select, Label, ListBox,
} from "@heroui/react";
import { useDispatch, useSelector } from "react-redux";
import {
  LuBellOff, LuBellPlus, LuBellRing, LuMail, LuPlus, LuRefreshCw, LuSlack, LuTrash, LuWebhook
} from "react-icons/lu";

import { getTeamMembers, selectTeam, selectTeamMembers } from "../../../slices/team";
import {
  getChartAlerts, createAlert, updateAlert, deleteAlert, selectAlerts,
} from "../../../slices/alert";
import {
  getTeamIntegrations,
  selectIntegrations,
} from "../../../slices/integration";
import autoUpdatePicture from "../../../assets/chartbrew-auto-update.webp";
import Container from "../../../components/Container";
import Text from "../../../components/Text";
import Row from "../../../components/Row";
import { selectCharts } from "../../../slices/chart";
import { selectUser } from "../../../slices/user";

const ruleTypes = [{
  label: "When reaching a milestone",
  value: "milestone",
}, {
  label: "When value is above a threshold",
  value: "threshold_above",
}, {
  label: "When value is below a threshold",
  value: "threshold_below",
}, {
  label: "When value is between two thresholds",
  value: "threshold_between",
}, {
  label: "When value is outside two thresholds",
  value: "threshold_outside",
}, {
  label: "When anomaly is detected",
  value: "anomaly",
}];

const timePeriods = [{
  label: "Minutes",
  value: "minutes",
}, {
  label: "Hours",
  value: "hours",
}, {
  label: "Days",
  value: "days",
}];

function DatasetAlerts(props) {
  const {
    chartId, cdcId, projectId, onChanged = () => {},
  } = props;

  const team = useSelector(selectTeam);
  const user = useSelector(selectUser);
  const teamMembers = useSelector(selectTeamMembers);
  const charts = useSelector(selectCharts);
  const integrations = useSelector(selectIntegrations);

  const initAlert = {
    rules: {},
    recipients: [user.email],
    mediums: {
      email: {
        enabled: true,
      }
    },
    chart_id: chartId,
    cdc_id: cdcId,
    active: true,
    timeout: 600,
  };

  const [open, setOpen] = useState(false);
  const [loading, setLoading] = useState(false);
  const [deleteLoading, setDeleteLoading] = useState(false);
  const [newAlert, setNewAlert] = useState(initAlert);
  const [displayTimeout, setDisplayTimeout] = useState(10);
  const [timeoutUnit, setTimeoutUnit] = useState("minutes");
  const [chart, setChart] = useState({});
  const [showAutoUpdate, setShowAutoUpdate] = useState(false);
  const [selectedIntegrations, setSelectedIntegrations] = useState([]);

  const dispatch = useDispatch();
  const alerts = useSelector(selectAlerts).filter((a) => a.cdc_id === cdcId);
  const project = useSelector((state) => state.project?.active);

  const initRef = useRef(false);

  useEffect(() => {
    dispatch(getTeamMembers({ team_id: team.id }));
    dispatch(getTeamIntegrations({ team_id: team.id }));

    if (!initRef.current && alerts?.length === 0) {
      dispatch(getChartAlerts({
        project_id: projectId,
        chart_id: chartId
      }));
      initRef.current = true;
    }
  }, []);

  useEffect(() => {
    if (charts && chartId) {
      setChart(charts.find((c) => `${c.id}` === `${chartId}`));
    }
  }, [charts, chartId]);

  const _filterTeamMembers = () => {
    const userRole = team.TeamRoles?.find((tr) => tr.user_id === user.id);
    if (!userRole) return [];

    if (userRole.role === "teamOwner" || userRole.role === "teamAdmin") {
      return teamMembers;
    }

    if (userRole.role === "projectEditor") {
      return teamMembers.filter((tm) => tm.TeamRoles?.find((tr) => tr.projects.includes(parseInt(projectId, 10)) && (tr.role === "projectAdmin" || tr.role === "projectEditor" || tr.role === "projectViewer")));
    }

    return [{ ...user }];
  };

  const _onRefreshIntegrationList = () => {
    dispatch(getTeamIntegrations({ team_id: team.id }));
  };

  const _onCreateNewIntegration = () => {
    window.open("/integrations", "_blank");
  };

  const _onChangeRecipient = (email) => {
    if (newAlert.recipients.includes(email)) {
      setNewAlert({ ...newAlert, recipients: newAlert.recipients.filter((r) => r !== email) });
    } else {
      setNewAlert({ ...newAlert, recipients: [...newAlert.recipients, email] });
    }
  };

  const _onOpen = () => {
    setNewAlert(initAlert);
    setOpen(true);
    setSelectedIntegrations([]);
  };

  const _onChangeMediums = (medium) => {
    setNewAlert({
      ...newAlert,
      mediums: {
        ...newAlert.mediums,
        [medium]: {
          enabled: !newAlert.mediums[medium]?.enabled,
        }
      }
    });
  };

  const _onSaveAlert = () => {
    setLoading(true);

    const alertToSave = { ...newAlert, alertIntegrations: selectedIntegrations };

    // update alert timeout
    if (displayTimeout > -1) {
      alertToSave.timeout = _getSecondsTimeout(displayTimeout);
    }

    if (newAlert.id) {
      dispatch(updateAlert({
        project_id: projectId,
        chart_id: chartId,
        data: alertToSave
      }))
        .then(() => {
          setOpen(false);
          setLoading(false);
          _refreshForm();
        })
        .catch(() => {
          setLoading(false);
        });

      onChanged();
      return;
    }

    dispatch(createAlert({
      project_id: projectId,
      chart_id: chartId,
      data: alertToSave
    }))
      .then(() => {
        setOpen(false);
        setLoading(false);
        _refreshForm();
      })
      .catch(() => {
        setLoading(false);
      });

    onChanged();
  };

  const _onEdit = (alert) => {
    setNewAlert(alert);
    let newDisplayTimeout = alert.timeout;
    if (alert.timeout > 60 * 60 * 24 && alert.timeout % (60 * 60 * 24) === 0) {
      newDisplayTimeout = parseInt(alert.timeout / (60 * 60 * 24), 10);
      setTimeoutUnit("days");
    } else if (alert.timeout > 60 * 60 && alert.timeout % (60 * 60) === 0) {
      newDisplayTimeout = parseInt(alert.timeout / (60 * 60), 10);
      setTimeoutUnit("hours");
    } else {
      newDisplayTimeout = parseInt(alert.timeout / 60, 10);
      setTimeoutUnit("minutes");
    }
    setDisplayTimeout(newDisplayTimeout);

    // set selected integrations
    if (alert.AlertIntegrations) {
      setSelectedIntegrations(alert.AlertIntegrations);
    }

    setOpen(true);
  };

  const _onDelete = () => {
    if (!newAlert.id) return;
    setDeleteLoading(true);
    dispatch(deleteAlert({
      project_id: projectId,
      chart_id: chartId,
      alert_id: newAlert.id
    }))
      .then(() => {
        setOpen(false);
        setDeleteLoading(false);
      })
      .catch(() => {
        setDeleteLoading(false);
      });
  };

  const _getSecondsTimeout = (value) => {
    let newValue = value;
    // change timeout based on the timeoutUnit
    if (timeoutUnit === "minutes") {
      newValue = value * 60;
    } else if (timeoutUnit === "hours") {
      newValue = value * 60 * 60;
    } else if (timeoutUnit === "days") {
      newValue = value * 60 * 60 * 24;
    }

    return newValue;
  };

  const _toggleAutoUpdate = () => {
    setShowAutoUpdate(!showAutoUpdate);
  };

  const _onSelectIntegration = (integration) => {
    // enable/disable integration
    let found = false;
    const newSelection = selectedIntegrations.map((si) => {
      if (si.integration_id === integration.id) {
        found = true;
        return {
          id: si.id,
          alert_id: si.alert_id,
          integration_id: integration.id,
          enabled: !si.enabled
        };
      }

      return si;
    });

    if (!found) {
      newSelection.push({
        alert_id: newAlert.id,
        integration_id: integration.id,
        enabled: true
      });
    }

    setSelectedIntegrations(newSelection);
  };

  const _refreshForm = () => {
    setNewAlert(initAlert);
    setSelectedIntegrations([]);
    dispatch(getChartAlerts({
      project_id: projectId,
      chart_id: chartId
    }));
  };

  return (
    <div className="dataset-alerts-tut chart-cdc-alert">
      <Container className={"pl-0 pr-0"}>
        <div className="flex flex-wrap items-center gap-2">
          {alerts.length === 0 && (
            <Link onPress={_onOpen} className="flex items-center cursor-pointer">
              <LuBellPlus size={24} />
              <div className="w-2" />
              <div className="text-sm text-foreground">Set up alerts</div>
            </Link>
          )}
          {alerts.length > 0 && alerts.map((alert) => (
            <Fragment key={alert.id}>
              <Button
                color={alert.active ? "primary" : "default"}
                variant="secondary"
                size="sm"
                onPress={() => _onEdit(alert)}
                endContent={alert.active ? <LuBellRing /> : <LuBellOff />}
              >
                {alert.type === "milestone" && "Milestone"}
                {alert.type === "threshold_above" && "Above threshold"}
                {alert.type === "threshold_below" && "Below threshold"}
                {alert.type === "threshold_between" && "Between thresholds"}
                {alert.type === "threshold_outside" && "Outside thresholds"}
                {alert.type === "anomaly" && "Anomaly detection"}
              </Button>
            </Fragment>
          ))}
        </div>
        {alerts.length > 0 && (
          <div className="mt-2">
            <Button
              startContent={<LuPlus />}
              size="sm"
              onPress={_onOpen}
              variant="tertiary"
            >
              Set up new alert
            </Button>
          </div>
        )}
      </Container>
      <Modal.Backdrop isOpen={open} onOpenChange={setOpen}>
        <Modal.Container size="2xl">
          <Modal.Dialog>
          <Modal.Header>
            <Modal.Heading>{newAlert.id ? "Edit alert" : "Set up a new alert"}</Modal.Heading>
          </Modal.Header>
          <Modal.Body>
            <div>
              <Row align="center">
                <Select
                  variant="secondary"
                  placeholder="Select an alert type"
                  value={newAlert.type || null}
                  onChange={(value) => setNewAlert({ ...newAlert, type: value })}
                  selectionMode="single"
                  aria-label="Select an alert type"
                >
                  <Label>Alert type</Label>
                  <Select.Trigger>
                    <Select.Value />
                    <Select.Indicator />
                  </Select.Trigger>
                  <Select.Popover>
                    <ListBox>
                      {ruleTypes.map((rule) => (
                        <ListBox.Item key={rule.value} id={rule.value} textValue={rule.label}>
                          {rule.label}
                          <ListBox.ItemIndicator />
                        </ListBox.Item>
                      ))}
                    </ListBox>
                  </Select.Popover>
                </Select>
              </Row>
              <div className="h-2" />

              {(newAlert.type === "milestone" || newAlert.type === "threshold_above" || newAlert.type === "threshold_below")
                && (
                  <Row>
                    <Input
                      placeholder={newAlert.type === "milestone" ? "Enter a milestone" : "Enter a threshold"}
                      label={newAlert.type === "milestone" ? "Milestone" : "Threshold"}
                      type="number"
                      fullWidth
                      variant="secondary"
                      value={newAlert.rules.value}
                      onChange={(e) => {
                        setNewAlert({
                          ...newAlert,
                          rules: { ...newAlert.rules, value: e.target.value }
                        });
                      }}
                    />
                  </Row>
                )}

              {(newAlert.type === "threshold_between" || newAlert.type === "threshold_outside") && (
                <Row>
                  <Input
                    placeholder="Enter a threshold"
                    label="Lower threshold"
                    type="number"
                    fullWidth
                    variant="secondary"
                    value={newAlert.rules.lower}
                    onChange={(e) => {
                      setNewAlert({
                        ...newAlert,
                        rules: { ...newAlert.rules, lower: e.target.value }
                      });
                    }}
                  />
                  <div className="w-2" />
                  <Input
                    placeholder="Enter a threshold"
                    label="Upper threshold"
                    type="number"
                    fullWidth
                    variant="secondary"
                    value={newAlert.rules.upper}
                    onChange={(e) => {
                      setNewAlert({
                        ...newAlert,
                        rules: { ...newAlert.rules, upper: e.target.value }
                      });
                    }}
                  />
                </Row>
              )}

              {newAlert.type === "anomaly" && (
                <div className="text-sm text-gray-500">
                  {"The anomaly detection is done automatically. Best to use this if you want to be notified when a time series is behaving differently than usual."}
                </div>
              )}

              <div className="h-8" />
              {newAlert.type && (
                <>
                  <Row>
                    <Text b>Where should we send the alerts?</Text>
                  </Row>
                  <div className="h-2" />
                  <div className="flex flex-wrap items-center gap-2">
                    <Button
                      startContent={<LuMail />}
                      size="sm"
                      variant={!newAlert.mediums.email?.enabled ? "outline" : "secondary"}
                      onPress={() => _onChangeMediums("email")}
                    >
                      Email
                    </Button>
                    {integrations && integrations.map((integration) => (
                      <>
                        <Button
                          startContent={
                            integration.type === "webhook" ? <LuWebhook />
                              : integration.type === "slack" ? <LuSlack />
                                : null
                          }
                          size="sm"
                          variant={
                            selectedIntegrations.length === 0
                            || !selectedIntegrations.find(
                              (i) => i.integration_id === integration.id && i.enabled
                            ) ? "outline" : "secondary"
                          }
                          onPress={() => _onSelectIntegration(integration)}
                        >
                          {integration.name}
                        </Button>
                      </>
                    ))}
                    <Button
                      startContent={<LuPlus size={18} />}
                      variant="tertiary"
                      size="sm"
                      onPress={_onCreateNewIntegration}
                    >
                      Create integrations
                    </Button>
                    <Button
                      startContent={<LuRefreshCw size={18} />}
                      variant="tertiary"
                      size="sm"
                      onPress={_onRefreshIntegrationList}
                    >
                      Refresh list
                    </Button>
                  </div>
                  {newAlert.mediums.email?.enabled && (
                  <>
                    <div className="h-8" />
                    <Row>
                      <Text b>Email alerts - Who should receive them?</Text>
                    </Row>
                    <div className="h-2" />
                    <Row wrap="wrap" className={"gap-2"}>
                      {_filterTeamMembers().map((member) => (
                        <Link key={member.email} onPress={() => _onChangeRecipient(member.email)}>
                          <Chip
                            color="secondary"
                            size="sm"
                            variant={newAlert.recipients.includes(member.email) ? "primary" : "soft"}
                            className="rounded-sm cursor-pointer"
                          >
                            {member.email}
                          </Chip>
                        </Link>
                      ))}
                    </Row>
                  </>
                  )}
                </>
              )}

              {newAlert.type && (
                <>
                  <div className="h-16" />
                  <Row>
                    <Text b>Add a timeout between alerts of the same type</Text>
                  </Row>
                  <Row>
                    <Text size="sm">By default, data is checked after each automatic chart update</Text>
                  </Row>
                  <div className="h-2" />
                  <Row>
                    <Input
                      label="Enter a timeout"
                      type="number"
                      fullWidth
                      variant="secondary"
                      value={displayTimeout}
                      onChange={(e) => setDisplayTimeout(e.target.value)}
                    />
                    <div className="w-2" />
                    <Select
                      variant="secondary"
                      value={timeoutUnit || null}
                      onChange={(value) => setTimeoutUnit(value)}
                      selectionMode="single"
                      aria-label="Select a time unit"
                    >
                      <Label>Time unit</Label>
                      <Select.Trigger>
                        <Select.Value />
                        <Select.Indicator />
                      </Select.Trigger>
                      <Select.Popover>
                        <ListBox>
                          {timePeriods.map((period) => (
                            <ListBox.Item key={period.value} id={period.value} textValue={period.label}>
                              {period.label}
                              <ListBox.ItemIndicator />
                            </ListBox.Item>
                          ))}
                        </ListBox>
                      </Select.Popover>
                    </Select>
                  </Row>
                </>
              )}

              {newAlert.type && newAlert.type !== "milestone" && (
                <>
                  <div className="h-4" />
                  <Row>
                    <Checkbox
                      isSelected={newAlert.oneTime}
                      onChange={(checked) => setNewAlert({ ...newAlert, oneTime: checked })}
                    >
                      Disable this alert after sending once
                    </Checkbox>
                  </Row>
                </>
              )}

              {chart && !chart?.autoUpdate && !project?.updateSchedule && (
                <>
                  <div className="h-8" />
                  <Row>
                    <Container className={"border-2 border-primary p-5 rounded-md"}>
                      <Row>
                        <div className="text-sm">
                          {"In order for the alert to trigger, you must enable automatic dashboard or chart updates."}
                          <div className="h-1" />
                          <Link onPress={_toggleAutoUpdate} className="text-sm">
                            {showAutoUpdate ? "Hide picture" : "Show how to do it"}
                          </Link>
                        </div>
                      </Row>
                    </Container>
                  </Row>
                </>
              )}

              {showAutoUpdate && (
                <>
                  <div className="h-4" />
                  <Row justify="center">
                    <img width="100%" src={autoUpdatePicture} alt="Auto update tutorial" />
                  </Row>
                </>
              )}
            </div>
          </Modal.Body>
          <Modal.Footer>
            <Switch
              isSelected={newAlert.active}
              onChange={(e) => setNewAlert({ ...newAlert, active: e.target.checked })}
              size="sm"
            >
              <Text>{newAlert.active ? "Alert enabled" : "Alert disabled"}</Text>
            </Switch>
            <div className="w-2" />
            {newAlert.id && (
              <Button
                color="danger"
                endContent={<LuTrash />}
                variant="tertiary"
                onPress={() => _onDelete()}
                isPending={deleteLoading}
              >
                Delete alert
              </Button>
            )}
            <Button onPress={() => setOpen(false)} variant="secondary">
              Close
            </Button>
            <Button
              onPress={() => _onSaveAlert()}
              color="primary"
              isDisabled={newAlert.mediums.length === 0 || !newAlert.type}
              isPending={loading}
            >
              {newAlert.id ? "Update alert" : "Create alert"}
            </Button>
          </Modal.Footer>
          </Modal.Dialog>
        </Modal.Container>
      </Modal.Backdrop>
    </div>
  );
}

DatasetAlerts.propTypes = {
  chartId: PropTypes.string.isRequired,
  cdcId: PropTypes.string.isRequired,
  projectId: PropTypes.string.isRequired,
  onChanged: PropTypes.func,
};

export default DatasetAlerts;
