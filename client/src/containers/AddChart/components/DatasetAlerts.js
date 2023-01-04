import React, { useEffect, useState } from "react";
import PropTypes from "prop-types";
import {
  Badge, Button, Checkbox, Container, Dropdown, Input, Link, Loading,
  Modal, Row, Spacer, Switch, Text,
} from "@nextui-org/react";
import {
  Delete, Message, Notification, Plus, VolumeOff
} from "react-iconly";
import { connect } from "react-redux";
import { FaDiscord, FaSlack, FaTelegram } from "react-icons/fa";
import { TbWebhook } from "react-icons/tb";

import { getTeamMembers as getTeamMembersAction } from "../../../actions/team";
import {
  createAlert as createAlertAction,
  updateAlert as updateAlertAction,
  deleteAlert as deleteAlertAction,
} from "../../../actions/alert";
import autoUpdatePicture from "../../../assets/chartbrew-auto-update.jpg";

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

  useEffect(() => {
    getTeamMembers(team.id);
  }, []);

  useEffect(() => {
    setDatasetAlerts(alerts.filter((a) => a.dataset_id === datasetId));
  }, [alerts]);

  useEffect(() => {
    if (charts && chartId) {
      setChart(charts.find((c) => `${c.id}` === `${chartId}`));
    }
  }, [charts, chartId]);

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

    const alertToSave = { ...newAlert };

    // update alert timeout
    if (displayTimeout > -1) {
      alertToSave.timeout = _getSecondsTimeout(displayTimeout);
    }

    if (newAlert.id) {
      updateAlert(projectId, chartId, alertToSave)
        .then(() => {
          setOpen(false);
          setLoading(false);
          setNewAlert(initAlert);
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
        setNewAlert(initAlert);
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

  return (
    <div className="dataset-alerts-tut">
      <Container css={{ pl: 0, pr: 0 }}>
        <Row wrap="wrap">
          {datasetAlerts.length === 0 && (
            <Badge color="secondary" content={"New"} size="xs">
              <Button
                color="primary"
                auto
                iconRight={<Notification />}
                size="sm"
                onClick={_onOpen}
              >
                Set up alerts
              </Button>
            </Badge>
          )}
          {datasetAlerts.length > 0 && datasetAlerts.map((alert) => (
            <>
              <Button
                color={alert.active ? "primary" : "secondary"}
                auto
                bordered
                size="sm"
                css={{ mb: 5 }}
                onClick={() => _onEdit(alert)}
                iconRight={alert.active ? <Notification size="small" /> : <VolumeOff size="small" />}
              >
                {alert.type === "milestone" && "Milestone"}
                {alert.type === "threshold_above" && "Above threshold"}
                {alert.type === "threshold_below" && "Below threshold"}
                {alert.type === "threshold_between" && "Between thresholds"}
                {alert.type === "threshold_outside" && "Outside thresholds"}
                {alert.type === "anomaly" && "Anomaly detection"}
              </Button>
              <Spacer x={0.2} />
            </>
          ))}
        </Row>
        {datasetAlerts.length > 0 && (
          <>
            <Spacer y={0.5} />
            <Row>
              <Button
                color="primary"
                auto
                icon={<Plus />}
                size="sm"
                onClick={_onOpen}
                light
              >
                Set up new alert
              </Button>
            </Row>
          </>
        )}
      </Container>
      <Modal open={open} onClose={() => setOpen(false)} width="800px">
        <Modal.Header>
          <Text h4 css={{ ac: "center", d: "flex", flexDirection: "row" }}>
            {newAlert.id ? "Edit alert" : "Set up a new alert"}
            <Spacer x={0.5} />
            <Badge color="secondary" size="sm" css={{ pl: 10, pr: 10 }}>
              Beta
            </Badge>
          </Text>
        </Modal.Header>
        <Modal.Body>
          <Container>
            <Row align="center">
              <Dropdown>
                <Dropdown.Button auto color="primary" bordered>
                  {ruleTypes.find((r) => r.value === newAlert.type)?.label || "Select an alert type"}
                </Dropdown.Button>
                <Dropdown.Menu
                  onAction={(key) => setNewAlert({ ...newAlert, type: key })}
                  selectedKeys={[newAlert.type]}
                  selectionMode="single"
                  css={{ minWidth: "max-content" }}
                >
                  {ruleTypes.map((rule) => (
                    <Dropdown.Item key={rule.value}>
                      {rule.label}
                    </Dropdown.Item>
                  ))}
                </Dropdown.Menu>
              </Dropdown>
            </Row>
            <Spacer y={0.5} />

            {(newAlert.type === "milestone" || newAlert.type === "threshold_above" || newAlert.type === "threshold_below")
              && (
                <Row>
                  <Input
                    placeholder={newAlert.type === "milestone" ? "Enter a milestone" : "Enter a threshold"}
                    label={newAlert.type === "milestone" ? "Milestone" : "Threshold"}
                    type="number"
                    fullWidth
                    bordered
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
                  bordered
                  value={newAlert.rules.lower}
                  onChange={(e) => {
                    setNewAlert({
                      ...newAlert,
                      rules: { ...newAlert.rules, lower: e.target.value }
                    });
                  }}
                />
                <Spacer x={0.5} />
                <Input
                  placeholder="Enter a threshold"
                  label="Upper threshold"
                  type="number"
                  fullWidth
                  bordered
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
                <Container css={{ backgroundColor: "$blue100", p: 10, br: "$md" }}>
                  <Row>
                    <Text>
                      {"The anomaly detection is done automatically. Best to use this when you want to be notified when a time series is behaving differently than usual."}
                    </Text>
                  </Row>
                </Container>
              </Row>
            )}

            <Spacer y={1} />
            <Row>
              <Text>Where should we send the alerts?</Text>
            </Row>
            <Spacer y={0.5} />
            <Row wrap="wrap" align="center">
              <Button
                auto
                icon={<Message size="small" />}
                color="secondary"
                size="sm"
                bordered={!newAlert.mediums.email?.enabled}
                onClick={() => _onChangeMediums("email")}
              >
                Email
              </Button>
              <Spacer x={0.5} />
              <Badge color="secondary" content={"soon"} size="xs">
                <Button
                  auto
                  icon={<FaSlack />}
                  color="secondary"
                  size="sm"
                  bordered={!newAlert.mediums.slack?.enabled}
                  onClick={() => _onChangeMediums("slack")}
                  disabled
                  title="Coming soon"
                >
                  Slack
                </Button>
              </Badge>
              <Spacer x={0.5} />
              <Badge color="secondary" content={"soon"} size="xs">
                <Button
                  auto
                  icon={<FaTelegram />}
                  color="secondary"
                  size="sm"
                  bordered={!newAlert.mediums.telegram?.enabled}
                  onClick={() => _onChangeMediums("telegram")}
                  disabled
                  title="Coming soon"
                >
                  Telegram
                </Button>
              </Badge>
              <Spacer x={0.5} />
              <Badge color="secondary" content={"soon"} size="xs">
                <Button
                  auto
                  icon={<FaDiscord />}
                  color="secondary"
                  size="sm"
                  bordered={!newAlert.mediums.discord?.enabled}
                  onClick={() => _onChangeMediums("discord")}
                  disabled
                  title="Coming soon"
                >
                  Discord
                </Button>
              </Badge>
              <Spacer x={0.5} />
              <Badge color="secondary" content={"soon"} size="xs">
                <Button
                  auto
                  icon={<TbWebhook />}
                  color="secondary"
                  size="sm"
                  bordered={!newAlert.mediums.webhook?.enabled}
                  onClick={() => _onChangeMediums("webhook")}
                  disabled
                  title="Coming soon"
                >
                  Webhook
                </Button>
              </Badge>
            </Row>

            {newAlert.type && newAlert.type !== "milestone" && (
              <>
                <Spacer y={1} />
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

            {newAlert.mediums.email?.enabled && (
              <>
                <Spacer y={1} />
                <Row>
                  <Text>Who should receive the alerts?</Text>
                </Row>
                <Spacer y={0.5} />
                <Row wrap="wrap">
                  {teamMembers.map((member) => (
                    <Link onClick={() => _onChangeRecipient(member.email)}>
                      <Badge
                        color="primary"
                        isSquared
                        variant={newAlert.recipients.includes(member.email) ? "default" : "bordered"}
                        css={{ mb: 5 }}
                      >
                        {member.email}
                      </Badge>
                      <Spacer x={0.2} />
                    </Link>
                  ))}
                </Row>
              </>
            )}

            {newAlert.type && (
              <>
                <Spacer y={1} />
                <Row>
                  <Text b>Add a timeout between alerts of the same type</Text>
                </Row>
                <Row>
                  <Text small>By default, data is checked after each automatic chart update</Text>
                </Row>
                <Spacer y={0.5} />
                <Row>
                  <Input
                    placeholder="Enter a timeout"
                    type="number"
                    fullWidth
                    bordered
                    value={displayTimeout}
                    onChange={(e) => setDisplayTimeout(e.target.value)}
                  />
                  <Spacer x={0.5} />
                  <Dropdown>
                    <Dropdown.Button bordered>
                      {timeoutUnit}
                    </Dropdown.Button>
                    <Dropdown.Menu
                      onAction={(key) => setTimeoutUnit(key)}
                      selectedKeys={[timeoutUnit]}
                      selectionMode="single"
                    >
                      {timePeriods.map((period) => (
                        <Dropdown.Item key={period.value}>
                          {period.label}
                        </Dropdown.Item>
                      ))}
                    </Dropdown.Menu>
                  </Dropdown>
                </Row>
              </>
            )}

            {chart && !chart.autoUpdate && (
              <>
                <Spacer y={1} />
                <Row>
                  <Container css={{ backgroundColor: "$yellow100", p: 10, br: "$md" }}>
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
                <Spacer y={1} />
                <Row justify="center">
                  <img width="400" src={autoUpdatePicture} alt="Auto update tutorial" />
                </Row>
              </>
            )}
          </Container>
        </Modal.Body>
        <Modal.Footer>
          <Switch
            checked={newAlert.active}
            onChange={(e) => setNewAlert({ ...newAlert, active: e.target.checked })}
            size="sm"
            css={{ p: 0 }}
          />
          <Text>{newAlert.active ? "Alert enabled" : "Alert disabled"}</Text>
          {newAlert.id && (
            <Button
              auto
              color="error"
              icon={deleteLoading ? <Loading type="spinner" color="currentColor" /> : <Delete />}
              light
              onClick={() => _onDelete()}
              disabled={deleteLoading}
            >
              Delete alert
            </Button>
          )}
          <Button auto onClick={() => setOpen(false)} color="warning" flat>
            Close
          </Button>
          <Button
            auto
            onClick={() => _onSaveAlert()}
            color="primary"
            disabled={newAlert.mediums.length === 0 || !newAlert.type || loading}
            icon={loading ? <Loading type="spinner" color="currentColor" /> : null}
          >
            {newAlert.id ? "Update alert" : "Create alert"}
          </Button>
        </Modal.Footer>
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
};

const mapStateToProps = (state) => ({
  teamMembers: state.team.teamMembers,
  team: state.team.active,
  user: state.user.data,
  alerts: state.alert.data,
  charts: state.chart.data,
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
});

export default connect(mapStateToProps, mapDispatchToProps)(DatasetAlerts);
