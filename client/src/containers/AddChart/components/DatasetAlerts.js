import React, { useEffect, useState } from "react";
import PropTypes from "prop-types";
import {
  Badge, Button, Container, Dropdown, Input, Link, Loading, Modal, Row, Spacer, Text
} from "@nextui-org/react";
import { Message, Notification } from "react-iconly";
import { connect } from "react-redux";
import { FaDiscord, FaSlack, FaTelegram } from "react-icons/fa";
import { TbWebhook } from "react-icons/tb";

import { getTeamMembers as getTeamMembersAction } from "../../../actions/team";
import { createAlert as createAlertAction } from "../../../actions/alert";

const ruleTypes = [{
  label: "When a new value is detected",
  value: "new_value",
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
}];

function DatasetAlerts(props) {
  const {
    chartType, getTeamMembers, teamMembers, team, user, chartId, datasetId, projectId,
    createAlert,
  } = props;

  const [open, setOpen] = useState(false);
  const [loading, setLoading] = useState(false);
  const [alertType, setAlertType] = useState("");
  const [rule, setRule] = useState({});
  const [recipients, setRecipients] = useState([user.email]);
  const [mediums, setMediums] = useState({});

  useEffect(() => {
    getTeamMembers(team.id);
  }, []);

  const _onChangeRecipient = (email) => {
    if (recipients.includes(email)) {
      setRecipients(recipients.filter((r) => r !== email));
    } else {
      setRecipients([...recipients, email]);
    }
  };

  const _onChangeMediums = (medium) => {
    setMediums({
      ...mediums,
      [medium]: {
        enabled: !mediums[medium]?.enabled,
      }
    });
  };

  const _onSaveAlert = () => {
    const alert = {
      rules: {
        type: alertType,
        ...rule,
      },
      recipients,
      mediums,
      chart_id: chartId,
      dataset_id: datasetId,
      active: true,
    };

    setLoading(true);
    createAlert(projectId, chartId, alert)
      .then(() => {
        setOpen(false);
        setLoading(false);
      })
      .catch(() => {
        setLoading(false);
      });
  };

  return (
    <div className="dataset-alerts-tut">
      <Badge color="secondary" content={"New"} size="xs">
        <Button
          color="primary"
          auto
          iconRight={<Notification />}
          size="sm"
          onClick={() => setOpen(true)}
        >
          Set up alerts
        </Button>
      </Badge>

      <Modal open={open} onClose={() => setOpen(false)} width="800px">
        <Modal.Header>
          <Text h4 css={{ ac: "center", d: "flex", flexDirection: "row" }}>
            Set up a new alert
            <Spacer x={0.5} />
            <Badge color="secondary" size="sm" css={{ pl: 10, pr: 10 }}>
              Beta
            </Badge>
          </Text>
        </Modal.Header>
        <Modal.Body>
          <Container>
            <Row>
              <Dropdown>
                <Dropdown.Button auto color="primary" bordered>
                  {ruleTypes.find((r) => r.value === alertType)?.label || "Select an alert type"}
                </Dropdown.Button>
                <Dropdown.Menu
                  onAction={(key) => setAlertType(key)}
                  selectedKeys={[alertType]}
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

            {alertType === "new_value" && (
              <Row>
                <Text i>
                  {"You will be notified when a new value is found "}
                  {chartType === "axis" && "on the X Axis"}
                  {chartType === "patterns" && "on the chart."}
                </Text>
              </Row>
            )}

            {(alertType === "threshold_above" || alertType === "threshold_below") && (
              <Row>
                <Input
                  placeholder="Enter a threshold"
                  label="Threshold"
                  type="number"
                  fullWidth
                  bordered
                  value={rule.value}
                  onChange={(e) => setRule({ ...rule, value: e.target.value })}
                />
              </Row>
            )}

            {(alertType === "threshold_between" || alertType === "threshold_outside") && (
              <Row>
                <Input
                  placeholder="Enter a threshold"
                  label="Lower threshold"
                  type="number"
                  fullWidth
                  bordered
                  value={rule.lower}
                  onChange={(e) => setRule({ ...rule, lower: e.target.value })}
                />
                <Spacer x={0.5} />
                <Input
                  placeholder="Enter a threshold"
                  label="Upper threshold"
                  type="number"
                  fullWidth
                  bordered
                  value={rule.upper}
                  onChange={(e) => setRule({ ...rule, upper: e.target.value })}
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
                bordered={!mediums.email?.enabled}
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
                bordered={!mediums.slack?.enabled}
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
                bordered={!mediums.telegram?.enabled}
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
                bordered={!mediums.discord?.enabled}
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
                bordered={!mediums.webhook?.enabled}
                onClick={() => _onChangeMediums("webhook")}
                disabled
                title="Coming soon"
              >
                Webhook
              </Button>
            </Row>

            {mediums.email?.enabled && (
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
                        variant={recipients.includes(member.email) ? "default" : "bordered"}
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
          <Button auto onClick={() => setOpen(false)} color="warning" flat>
            Close
          </Button>
          <Button
            auto
            onClick={() => _onSaveAlert()}
            color="primary"
            disabled={mediums.length === 0 || !alertType || loading}
            icon={loading ? <Loading type="spinner" color="currentColor" /> : null}
          >
            Save
          </Button>
        </Modal.Footer>
      </Modal>
    </div>
  );
}

DatasetAlerts.propTypes = {
  chartType: PropTypes.string.isRequired,
  getTeamMembers: PropTypes.func.isRequired,
  teamMembers: PropTypes.array.isRequired,
  team: PropTypes.object.isRequired,
  user: PropTypes.object.isRequired,
  chartId: PropTypes.string.isRequired,
  datasetId: PropTypes.string.isRequired,
  createAlert: PropTypes.func.isRequired,
  projectId: PropTypes.string.isRequired,
};

const mapStateToProps = (state) => ({
  teamMembers: state.team.teamMembers,
  team: state.team.active,
  user: state.user.data,
});

const mapDispatchToProps = (dispatch) => ({
  getTeamMembers: (teamId) => dispatch(getTeamMembersAction(teamId)),
  createAlert: (projectId, chartId, alert) => (
    dispatch(createAlertAction(projectId, chartId, alert))
  ),
});

export default connect(mapStateToProps, mapDispatchToProps)(DatasetAlerts);
