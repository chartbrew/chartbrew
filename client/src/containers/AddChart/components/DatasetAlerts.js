import React, { useEffect, useState } from "react";
import PropTypes from "prop-types";
import {
  Badge, Button, Container, Dropdown, Input, Link, Loading, Modal, Row, Spacer, Switch, Text
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

const ruleTypes = [{
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
}];

function DatasetAlerts(props) {
  const {
    getTeamMembers, teamMembers, team, user, chartId, datasetId, projectId,
    createAlert, alerts, updateAlert, deleteAlert,
  } = props;

  const initAlert = {
    rules: {},
    recipients: [user.email],
    mediums: {},
    chart_id: chartId,
    dataset_id: datasetId,
    active: true,
  };

  const [open, setOpen] = useState(false);
  const [loading, setLoading] = useState(false);
  const [deleteLoading, setDeleteLoading] = useState(false);
  const [datasetAlerts, setDatasetAlerts] = useState([]);
  const [newAlert, setNewAlert] = useState(initAlert);

  useEffect(() => {
    getTeamMembers(team.id);
  }, []);

  useEffect(() => {
    setDatasetAlerts(alerts.filter((a) => a.dataset_id === datasetId));
  }, [alerts]);

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

    if (newAlert.id) {
      updateAlert(projectId, chartId, newAlert)
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

    createAlert(projectId, chartId, newAlert)
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
                iconRight={alert.active ? <Notification /> : <VolumeOff />}
              >
                {alert.type === "new_value" && "New value"}
                {alert.type === "threshold_above" && "Above threshold"}
                {alert.type === "threshold_below" && "Below threshold"}
                {alert.type === "threshold_between" && "Between thresholds"}
                {alert.type === "threshold_outside" && "Outside thresholds"}
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
                Set new alert
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

            {(newAlert.type === "threshold_above" || newAlert.type === "threshold_below") && (
              <Row>
                <Input
                  placeholder="Enter a threshold"
                  label="Threshold"
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

            <Spacer y={1} />
            <Row>
              <Text>Where should we send the alerts?</Text>
            </Row>
            <Spacer y={0.5} />
            <Row wrap="wrap">
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
              <Spacer x={0.5} />
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
              <Spacer x={0.5} />
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
              <Spacer x={0.5} />
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
            </Row>

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
};

const mapStateToProps = (state) => ({
  teamMembers: state.team.teamMembers,
  team: state.team.active,
  user: state.user.data,
  alerts: state.alert.data,
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
