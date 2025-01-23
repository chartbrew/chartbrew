import React, { Fragment, useEffect, useRef, useState } from "react";
import PropTypes from "prop-types";
import {
  Chip, Button, Checkbox, Input, Link, Modal, Spacer,
  Switch, ModalHeader, ModalBody, ModalFooter, Select, SelectItem, ModalContent,
} from "@heroui/react";
import { connect, useDispatch, useSelector } from "react-redux";
import {
  LuBellOff, LuBellPlus, LuBellRing, LuMail, LuPlus, LuRefreshCw, LuSlack, LuTrash, LuWebhook
} from "react-icons/lu";

import { getTeamMembers, selectTeam, selectTeamMembers } from "../../../slices/team";
import {
  getChartAlerts, createAlert, updateAlert, deleteAlert, selectAlerts,
} from "../../../slices/alert";
import {
  getTeamIntegrations as getTeamIntegrationsAction,
} from "../../../actions/integration";
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
    chartId, cdcId, projectId, getTeamIntegrations, integrations, onChanged = () => {},
  } = props;

  const team = useSelector(selectTeam);
  const user = useSelector(selectUser);
  const teamMembers = useSelector(selectTeamMembers);
  const charts = useSelector(selectCharts);

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
    getTeamIntegrations(team.id);

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
    getTeamIntegrations(team.id);
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
            <Link onClick={_onOpen} className="flex items-center cursor-pointer">
              <LuBellPlus size={24} />
              <Spacer x={0.5} />
              <Text>Set up alerts</Text>
            </Link>
          )}
          {alerts.length > 0 && alerts.map((alert) => (
            <Fragment key={alert.id}>
              <Button
                color={alert.active ? "primary" : "default"}
                auto
                variant="bordered"
                size="sm"
                onClick={() => _onEdit(alert)}
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
              auto
              startContent={<LuPlus />}
              size="sm"
              onClick={_onOpen}
              variant="light"
            >
              Set up new alert
            </Button>
          </div>
        )}
      </Container>
      <Modal isOpen={open} onClose={() => setOpen(false)} size="2xl">
        <ModalContent>
          <ModalHeader>
            <Text size="h4">
              {newAlert.id ? "Edit alert" : "Set up a new alert"}
            </Text>
          </ModalHeader>
          <ModalBody>
            <div>
              <Row align="center">
                <Select
                  variant="bordered"
                  placeholder="Select an alert type"
                  label="Alert type"
                  renderValue={(
                    <Text>
                      {ruleTypes.find((r) => r.value === newAlert.type)?.label}
                    </Text>
                  )}
                  selectedKeys={[newAlert.type]}
                  onSelectionChange={(keys) => setNewAlert({ ...newAlert, type: keys.currentKey })}
                  selectionMode="single"
                  aria-label="Select an alert type"
                >
                  {ruleTypes.map((rule) => (
                    <SelectItem key={rule.value} textValue={rule.label}>
                      {rule.label}
                    </SelectItem>
                  ))}
                </Select>
              </Row>
              <Spacer y={1} />

              {(newAlert.type === "milestone" || newAlert.type === "threshold_above" || newAlert.type === "threshold_below")
                && (
                  <Row>
                    <Input
                      placeholder={newAlert.type === "milestone" ? "Enter a milestone" : "Enter a threshold"}
                      label={newAlert.type === "milestone" ? "Milestone" : "Threshold"}
                      type="number"
                      fullWidth
                      variant="bordered"
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
                    variant="bordered"
                    value={newAlert.rules.lower}
                    onChange={(e) => {
                      setNewAlert({
                        ...newAlert,
                        rules: { ...newAlert.rules, lower: e.target.value }
                      });
                    }}
                  />
                  <Spacer x={1} />
                  <Input
                    placeholder="Enter a threshold"
                    label="Upper threshold"
                    type="number"
                    fullWidth
                    variant="bordered"
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

              <Spacer y={4} />
              {newAlert.type && (
                <>
                  <Row>
                    <Text b>Where should we send the alerts?</Text>
                  </Row>
                  <Spacer y={1} />
                  <div className="flex flex-wrap items-center gap-2">
                    <Button
                      auto
                      startContent={<LuMail />}
                      color="secondary"
                      size="sm"
                      variant={!newAlert.mediums.email?.enabled ? "bordered": "solid"}
                      onClick={() => _onChangeMediums("email")}
                    >
                      Email
                    </Button>
                    {integrations && integrations.map((integration) => (
                      <>
                        <Button
                          auto
                          startContent={
                            integration.type === "webhook" ? <LuWebhook />
                              : integration.type === "slack" ? <LuSlack />
                                : null
                          }
                          color="secondary"
                          size="sm"
                          variant={
                            selectedIntegrations.length === 0
                            || !selectedIntegrations.find(
                              (i) => i.integration_id === integration.id && i.enabled
                            ) ? "bordered" : "solid"
                          }
                          onClick={() => _onSelectIntegration(integration)}
                        >
                          {integration.name}
                        </Button>
                      </>
                    ))}
                    <Button
                      startContent={<LuPlus size={18} />}
                      color="primary"
                      variant="light"
                      size="sm"
                      onClick={_onCreateNewIntegration}
                    >
                      Create integrations
                    </Button>
                    <Button
                      startContent={<LuRefreshCw size={18} />}
                      color="primary"
                      variant="light"
                      size="sm"
                      onClick={_onRefreshIntegrationList}
                    >
                      Refresh list
                    </Button>
                  </div>
                  {newAlert.mediums.email?.enabled && (
                  <>
                    <Spacer y={4} />
                    <Row>
                      <Text b>Email alerts - Who should receive them?</Text>
                    </Row>
                    <Spacer y={1} />
                    <Row wrap="wrap" className={"gap-2"}>
                      {_filterTeamMembers().map((member) => (
                        <Link key={member.email} onClick={() => _onChangeRecipient(member.email)}>
                          <Chip
                            color="secondary"
                            radius="sm"
                            size="sm"
                            variant={newAlert.recipients.includes(member.email) ? "solid" : "faded"}
                            className="cursor-pointer"
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
                  <Spacer y={8} />
                  <Row>
                    <Text b>Add a timeout between alerts of the same type</Text>
                  </Row>
                  <Row>
                    <Text size="sm">By default, data is checked after each automatic chart update</Text>
                  </Row>
                  <Spacer y={1} />
                  <Row>
                    <Input
                      label="Enter a timeout"
                      type="number"
                      fullWidth
                      variant="bordered"
                      value={displayTimeout}
                      onChange={(e) => setDisplayTimeout(e.target.value)}
                    />
                    <Spacer x={1} />
                    <Select
                      variant="bordered"
                      label="Time unit"
                      renderValue={(
                        <Text>{timeoutUnit}</Text>
                      )}
                      selectedKeys={[timeoutUnit]}
                      onSelectionChange={(keys) => setTimeoutUnit(keys.currentKey)}
                      selectionMode="single"
                      aria-label="Select a time unit"
                    >
                      {timePeriods.map((period) => (
                        <SelectItem key={period.value} textValue={period.label}>
                          {period.label}
                        </SelectItem>
                      ))}
                    </Select>
                  </Row>
                </>
              )}

              {newAlert.type && newAlert.type !== "milestone" && (
                <>
                  <Spacer y={2} />
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
                  <Spacer y={4} />
                  <Row>
                    <Container className={"border-2 border-primary p-5 rounded-md"}>
                      <Row>
                        <div className="text-sm">
                          {"In order for the alert to trigger, you must enable automatic dashboard or chart updates."}
                          <Spacer y={0.5} />
                          <Link onClick={_toggleAutoUpdate} className="text-sm">
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
                  <Spacer y={2} />
                  <Row justify="center">
                    <img width="100%" src={autoUpdatePicture} alt="Auto update tutorial" />
                  </Row>
                </>
              )}
            </div>
          </ModalBody>
          <ModalFooter>
            <Switch
              isSelected={newAlert.active}
              onChange={(e) => setNewAlert({ ...newAlert, active: e.target.checked })}
              size="sm"
            >
              <Text>{newAlert.active ? "Alert enabled" : "Alert disabled"}</Text>
            </Switch>
            <Spacer x={1} />
            {newAlert.id && (
              <Button
                auto
                color="danger"
                endContent={<LuTrash />}
                variant="light"
                onClick={() => _onDelete()}
                isLoading={deleteLoading}
              >
                Delete alert
              </Button>
            )}
            <Button onClick={() => setOpen(false)} variant="bordered">
              Close
            </Button>
            <Button
              auto
              onClick={() => _onSaveAlert()}
              color="primary"
              disabled={newAlert.mediums.length === 0 || !newAlert.type}
              isLoading={loading}
            >
              {newAlert.id ? "Update alert" : "Create alert"}
            </Button>
          </ModalFooter>
        </ModalContent>
      </Modal>
    </div>
  );
}

DatasetAlerts.propTypes = {
  chartId: PropTypes.string.isRequired,
  cdcId: PropTypes.string.isRequired,
  projectId: PropTypes.string.isRequired,
  getTeamIntegrations: PropTypes.func.isRequired,
  integrations: PropTypes.array.isRequired,
  onChanged: PropTypes.func,
};

const mapStateToProps = (state) => ({
  integrations: state.integration.data,
});

const mapDispatchToProps = (dispatch) => ({
  getTeamIntegrations: (teamId) => dispatch(getTeamIntegrationsAction(teamId)),
});

export default connect(mapStateToProps, mapDispatchToProps)(DatasetAlerts);
