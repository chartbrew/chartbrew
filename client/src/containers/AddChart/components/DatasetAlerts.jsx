import React, { useEffect, useState } from "react";
import PropTypes from "prop-types";
import {
  Chip, Button, Checkbox, Dropdown, Input, Link, Modal, Spacer,
  Switch, ModalHeader, ModalBody, ModalFooter, Select,
} from "@nextui-org/react";
import {
  Delete, Message, Notification, Plus, VolumeOff
} from "react-iconly";
import { connect } from "react-redux";
import { FaSlack } from "react-icons/fa";
import { TbWebhook } from "react-icons/tb";
import { HiRefresh } from "react-icons/hi";

import { getTeamMembers as getTeamMembersAction } from "../../../actions/team";
import {
  getChartAlerts as getChartAlertsAction,
  createAlert as createAlertAction,
  updateAlert as updateAlertAction,
  deleteAlert as deleteAlertAction,
} from "../../../actions/alert";
import {
  getTeamIntegrations as getTeamIntegrationsAction,
} from "../../../actions/integration";
import autoUpdatePicture from "../../../assets/chartbrew-auto-update.jpg";
import Container from "../../../components/Container";
import Text from "../../../components/Text";
import Row from "../../../components/Row";

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
    getTeamMembers, teamMembers, team, user, chartId, datasetId, projectId,
    createAlert, alerts, updateAlert, deleteAlert, charts,
    getTeamIntegrations, integrations, getChartAlerts,
  } = props;

  const initAlert = {
    rules: {},
    recipients: [user.email],
    mediums: {
      email: {
        enabled: true,
      }
    },
    chart_id: chartId,
    dataset_id: datasetId,
    active: true,
    timeout: 600,
  };

  const [open, setOpen] = useState(false);
  const [loading, setLoading] = useState(false);
  const [deleteLoading, setDeleteLoading] = useState(false);
  const [datasetAlerts, setDatasetAlerts] = useState([]);
  const [newAlert, setNewAlert] = useState(initAlert);
  const [displayTimeout, setDisplayTimeout] = useState(10);
  const [timeoutUnit, setTimeoutUnit] = useState("minutes");
  const [chart, setChart] = useState({});
  const [showAutoUpdate, setShowAutoUpdate] = useState(false);
  const [selectedIntegrations, setSelectedIntegrations] = useState([]);

  useEffect(() => {
    getTeamMembers(team.id);
    getTeamIntegrations(team.id);
  }, []);

  useEffect(() => {
    if (alerts) {
      const filteredAlerts = alerts.filter((a) => a.dataset_id === datasetId);
      setDatasetAlerts(filteredAlerts);
    }
  }, [alerts]);

  useEffect(() => {
    if (charts && chartId) {
      setChart(charts.find((c) => `${c.id}` === `${chartId}`));
    }
  }, [charts, chartId]);

  const _onRefreshIntegrationList = () => {
    getTeamIntegrations(team.id);
  };

  const _onCreateNewIntegration = () => {
    window.open(`/${team.id}/${projectId}/integrations`, "_blank");
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
      updateAlert(projectId, chartId, alertToSave)
        .then(() => {
          setOpen(false);
          setLoading(false);
          _refreshForm();
        })
        .catch(() => {
          setLoading(false);
        });
      return;
    }

    createAlert(projectId, chartId, alertToSave)
      .then(() => {
        setOpen(false);
        setLoading(false);
        _refreshForm();
      })
      .catch(() => {
        setLoading(false);
      });
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
    deleteAlert(projectId, chartId, newAlert.id)
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
    getChartAlerts(projectId, chartId);
  };

  return (
    <div className="dataset-alerts-tut">
      <Container className={"pl-0 pr-0"}>
        <Row wrap="wrap">
          {datasetAlerts.length === 0 && (
            <Button
              color="primary"
              auto
              endContent={<Notification />}
              size="sm"
              onClick={_onOpen}
            >
              Set up alerts
            </Button>
          )}
          {datasetAlerts.length > 0 && datasetAlerts.map((alert) => (
            <>
              <Button
                color={alert.active ? "primary" : "secondary"}
                auto
                variant="bordered"
                size="sm"
                className="mb-5"
                onClick={() => _onEdit(alert)}
                endContent={alert.active ? <Notification size="small" /> : <VolumeOff size="small" />}
              >
                {alert.type === "milestone" && "Milestone"}
                {alert.type === "threshold_above" && "Above threshold"}
                {alert.type === "threshold_below" && "Below threshold"}
                {alert.type === "threshold_between" && "Between thresholds"}
                {alert.type === "threshold_outside" && "Outside thresholds"}
                {alert.type === "anomaly" && "Anomaly detection"}
              </Button>
              <Spacer x={0.5} />
            </>
          ))}
        </Row>
        {datasetAlerts.length > 0 && (
          <>
            <Spacer y={1} />
            <Row>
              <Button
                color="primary"
                auto
                startContent={<Plus />}
                size="sm"
                onClick={_onOpen}
                variant="light"
              >
                Set up new alert
              </Button>
            </Row>
          </>
        )}
      </Container>
      <Modal isOpen={open} onClose={() => setOpen(false)} className="w-[800px]">
        <ModalHeader>
          <Text size="h4">
            {newAlert.id ? "Edit alert" : "Set up a new alert"}
          </Text>
        </ModalHeader>
        <ModalBody>
          <Container>
            <Row align="center">
              <Select
                variant="bordered"
                renderValue={(
                  <Text>
                    {ruleTypes.find((r) => r.value === newAlert.type)?.label || "Select an alert type"}
                  </Text>
                )}
                selectedKeys={[newAlert.type]}
                onSelectionChange={(key) => setNewAlert({ ...newAlert, type: key })}
                selectionMode="single"
              >
                {ruleTypes.map((rule) => (
                  <Dropdown.Item key={rule.value}>
                    {rule.label}
                  </Dropdown.Item>
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
              <Row>
                <Text i>
                  {"The anomaly detection is done automatically. Best to use this if you want to be notified when a time series is behaving differently than usual."}
                </Text>
              </Row>
            )}

            <Spacer y={2} />
            {newAlert.type && (
              <>
                <Row>
                  <Text b>Where should we send the alerts?</Text>
                </Row>
                <Spacer y={1} />
                <Row wrap="wrap" align="center">
                  <Button
                    auto
                    startContent={<Message size="small" />}
                    color="secondary"
                    size="sm"
                    variant={!newAlert.mediums.email?.enabled ? "bordered": "filled"}
                    onClick={() => _onChangeMediums("email")}
                  >
                    Email
                  </Button>
                  <Spacer x={1} />
                  {integrations && integrations.map((integration) => (
                    <>
                      <Button
                        auto
                        startContent={
                          integration.type === "webhook" ? <TbWebhook />
                            : integration.type === "slack" ? <FaSlack />
                              : null
                        }
                        color="secondary"
                        size="sm"
                        variant={
                          selectedIntegrations.length === 0
                          || !selectedIntegrations.find(
                            (i) => i.integration_id === integration.id && i.enabled
                          ) ? "bordered" : "filled"
                        }
                        onClick={() => _onSelectIntegration(integration)}
                      >
                        {integration.name}
                      </Button>
                      <Spacer x={0.6} />
                    </>
                  ))}
                </Row>
                <Spacer y={1} />
                <Row>
                  <Button
                    auto
                    startContent={<Plus size="small" />}
                    color="primary"
                    variant="light"
                    size="sm"
                    onClick={_onCreateNewIntegration}
                  >
                    Create integrations
                  </Button>
                  <Button
                    auto
                    startContent={<HiRefresh size={18} />}
                    color="primary"
                    variant="light"
                    size="sm"
                    onClick={_onRefreshIntegrationList}
                  >
                    Refresh list
                  </Button>
                </Row>
                {newAlert.mediums.email?.enabled && (
                <>
                  <Spacer y={2} />
                  <Row>
                    <Text b>Email alerts - Who should receive them?</Text>
                  </Row>
                  <Spacer y={1} />
                  <Row wrap="wrap">
                    {teamMembers.map((member) => (
                      <Link key={member.email} onClick={() => _onChangeRecipient(member.email)}>
                        <Chip
                          color="primary"
                          radius="sm"
                          variant={newAlert.recipients.includes(member.email) ? "default" : "bordered"}
                          className="mb-5"
                        >
                          {member.email}
                        </Chip>
                        <Spacer x={0.5} />
                      </Link>
                    ))}
                  </Row>
                </>
                )}
              </>
            )}

            {newAlert.type && (
              <>
                <Spacer y={2} />
                <Row>
                  <Text b>Add a timeout between alerts of the same type</Text>
                </Row>
                <Row>
                  <Text small>By default, data is checked after each automatic chart update</Text>
                </Row>
                <Spacer y={1} />
                <Row>
                  <Input
                    placeholder="Enter a timeout"
                    type="number"
                    fullWidth
                    variant="bordered"
                    value={displayTimeout}
                    onChange={(e) => setDisplayTimeout(e.target.value)}
                  />
                  <Spacer x={1} />
                  <Select
                    variant="bordered"
                    renderValue={(
                      <Text>{timeoutUnit}</Text>
                    )}
                    selectedKeys={[timeoutUnit]}
                    onSelectionChange={(key) => setTimeoutUnit(key)}
                    selectionMode="single"
                  >
                    {timePeriods.map((period) => (
                      <Dropdown.Item key={period.value}>
                        {period.label}
                      </Dropdown.Item>
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
                    size="sm"
                  >
                    Disable this alert after sending once
                  </Checkbox>
                </Row>
              </>
            )}

            {chart && !chart.autoUpdate && (
              <>
                <Spacer y={2} />
                <Row>
                  <Container className={"bg-secondary-100 p-10 rounded-md"}>
                    <Row>
                      <Text>
                        {"In order for the alert to trigger, you must enable automatic chart updates from the dashboard."}
                        <Link onClick={_toggleAutoUpdate}>
                          {showAutoUpdate ? "Hide picture" : "Show how to do it"}
                        </Link>
                      </Text>
                    </Row>
                  </Container>
                </Row>
              </>
            )}

            {showAutoUpdate && (
              <>
                <Spacer y={2} />
                <Row justify="center">
                  <img width="400" src={autoUpdatePicture} alt="Auto update tutorial" />
                </Row>
              </>
            )}
          </Container>
        </ModalBody>
        <ModalFooter>
          <Switch
            isSelected={newAlert.active}
            onChange={(e) => setNewAlert({ ...newAlert, active: e.target.checked })}
            size="sm"
            className="p-0"
          />
          <Text>{newAlert.active ? "Alert enabled" : "Alert disabled"}</Text>
          {newAlert.id && (
            <Button
              auto
              color="danger"
              endContent={<Delete />}
              variant="light"
              onClick={() => _onDelete()}
              isLoading={deleteLoading}
            >
              Delete alert
            </Button>
          )}
          <Button auto onClick={() => setOpen(false)} color="warning" variant="flat">
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
      </Modal>
    </div>
  );
}

DatasetAlerts.propTypes = {
  getTeamMembers: PropTypes.func.isRequired,
  teamMembers: PropTypes.array.isRequired,
  team: PropTypes.object.isRequired,
  user: PropTypes.object.isRequired,
  chartId: PropTypes.string.isRequired,
  datasetId: PropTypes.string.isRequired,
  createAlert: PropTypes.func.isRequired,
  projectId: PropTypes.string.isRequired,
  alerts: PropTypes.array.isRequired,
  updateAlert: PropTypes.func.isRequired,
  deleteAlert: PropTypes.func.isRequired,
  charts: PropTypes.array.isRequired,
  getTeamIntegrations: PropTypes.func.isRequired,
  integrations: PropTypes.array.isRequired,
  getChartAlerts: PropTypes.func.isRequired,
};

const mapStateToProps = (state) => ({
  teamMembers: state.team.teamMembers,
  team: state.team.active,
  user: state.user.data,
  alerts: state.alert.data,
  charts: state.chart.data,
  integrations: state.integration.data,
});

const mapDispatchToProps = (dispatch) => ({
  getTeamMembers: (teamId) => dispatch(getTeamMembersAction(teamId)),
  createAlert: (projectId, chartId, alert) => (
    dispatch(createAlertAction(projectId, chartId, alert))
  ),
  updateAlert: (projectId, chartId, alert) => (
    dispatch(updateAlertAction(projectId, chartId, alert))
  ),
  deleteAlert: (projectId, chartId, alertId) => (
    dispatch(deleteAlertAction(projectId, chartId, alertId))
  ),
  getTeamIntegrations: (teamId) => dispatch(getTeamIntegrationsAction(teamId)),
  getChartAlerts: (projectId, chartId) => dispatch(getChartAlertsAction(projectId, chartId)),
});

export default connect(mapStateToProps, mapDispatchToProps)(DatasetAlerts);
