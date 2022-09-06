import React, { useState, useEffect } from "react";
import PropTypes from "prop-types";
import {
  Button, Container, Input, Row, Spacer, Text, Link, Grid, Card,
} from "@nextui-org/react";
import { connect } from "react-redux";
import { withRouter } from "react-router";
import { Edit, Scan } from "react-iconly";
import { FaMagic } from "react-icons/fa";

import SimpleAnalyticsTemplate from "../../Connections/SimpleAnalytics/SimpleAnalyticsTemplate";
import ChartMogulTemplate from "../../Connections/ChartMogul/ChartMogulTemplate";
import MailgunTemplate from "../../Connections/Mailgun/MailgunTemplate";
import GaTemplate from "../../Connections/GoogleAnalytics/GaTemplate";
import CustomTemplates from "../../Connections/CustomTemplates/CustomTemplates";
import PlausibleTemplate from "../../Connections/Plausible/PlausibleTemplate";
import canAccess from "../../../config/canAccess";
import plausibleDash from "../../Connections/Plausible/plausible-template.jpeg";
import simpleanalyticsDash from "../../Connections/SimpleAnalytics/simpleanalytics-template.jpeg";
import chartmogulDash from "../../Connections/ChartMogul/chartmogul-template.jpeg";
import mailgunDash from "../../Connections/Mailgun/mailgun-template.jpeg";
import gaDash from "../../Connections/GoogleAnalytics/ga-template.jpeg";

function ChartDescription(props) {
  const {
    name, onChange, history, onCreate, teamId, projectId, connections, templates,
    match, user, team, noConnections,
  } = props;

  const [error, setError] = useState(false);
  const [loading, setLoading] = useState(false);
  const [formType, setFormType] = useState("");
  const [selectedMenu, setSelectedMenu] = useState("emptyChart");

  useEffect(() => {
    if (!name) _populateName();
  }, []);

  const _onNameChange = (e) => {
    onChange(e.target.value);
  };

  const _onCreatePressed = () => {
    if (!name) {
      setError(true);
      return;
    }
    setLoading(true);
    onCreate()
      .then(() => setLoading(false))
      .catch(() => setLoading(false));
  };

  const _onCompleteTemplate = () => {
    history.push(`/${teamId}/${projectId}/dashboard`);
    setTimeout(() => {
      window.location.reload();
    }, 500);
  };

  const _populateName = () => {
    const names = [
      "Awesome", "Majestic", "Spectacular", "Superb", "Grandiose", "Charty", "Breathtaking", "Awe-inspiring",
      "Chartiful", "Beautiful", "Super", "Formidable", "Stunning", "Astonishing", "Magnificent",
    ];
    onChange(`${names[Math.floor(Math.random() * names.length)]} chart`);
  };

  return (
    <Container
      css={{
        backgroundColor: "$backgroundContrast",
        br: "$md",
        p: 10,
        "@xs": {
          p: 20,
        },
        "@sm": {
          p: 20,
        },
        "@md": {
          p: 20,
          m: 20,
        },
        "@lg": {
          p: 20,
          m: 20,
        },
      }}
    >
      <Row align="center" wrap="wrap" gap={1} css={{ marginLeft: 0 }}>
        <Link
          css={{
            background: selectedMenu === "emptyChart" ? "$background" : "$backgroundContrast",
            p: 5,
            pr: 10,
            pl: 10,
            br: "$sm",
            "@xsMax": { width: "90%" },
            ai: "center",
            color: "$text",
          }}
          onClick={() => {
            setSelectedMenu("emptyChart");
            setFormType("");
          }}
        >
          <Edit />
          <Spacer x={0.2} />
          <Text>{" Create from scratch"}</Text>
        </Link>
        <Spacer x={0.2} />
        <Link
          css={{
            background: selectedMenu === "communityTemplates" ? "$background" : "$backgroundContrast",
            p: 5,
            pr: 10,
            pl: 10,
            br: "$sm",
            "@xsMax": { width: "90%" },
            ai: "center",
            color: "$text",
          }}
          onClick={() => {
            setSelectedMenu("communityTemplates");
            setFormType("");
          }}
        >
          <FaMagic size={20} />
          <Spacer x={0.2} />
          <Text>{" Community templates"}</Text>
        </Link>
        <Spacer x={0.2} />
        <Link
          css={{
            background: selectedMenu === "customTemplates" ? "$background" : "$backgroundContrast",
            p: 5,
            pr: 10,
            pl: 10,
            br: "$sm",
            "@xsMax": { width: "90%" },
            ai: "center",
            color: "$text",
          }}
          onClick={() => {
            setSelectedMenu("customTemplates");
            setFormType("");
          }}
        >
          <Scan />
          <Spacer x={0.2} />
          <Text>{" Custom templates"}</Text>
        </Link>
      </Row>
      <Spacer y={1} />
      {!formType && (
        <>
          {selectedMenu === "emptyChart" && (
            <>
              <Row align="center">
                <Text h3>
                  {"What are you brewing today?"}
                </Text>
              </Row>
              <Row align="center">
                <Text>
                  {"Write a short summary of your visualization"}
                </Text>
              </Row>
              <Spacer y={1} />
              <Row align="center">
                <form
                  id="create-chart"
                  onSubmit={(e) => {
                    e.preventDefault();
                    _onCreatePressed();
                  }}
                  style={{ width: "100%" }}
                >
                  <Input
                    placeholder="'User growth in the last month'"
                    helperColor="error"
                    helperText={error}
                    value={name}
                    onChange={_onNameChange}
                    size="lg"
                    fullWidth
                    autoFocus
                    bordered
                  />
                </form>
              </Row>
              <Spacer y={0.5} />
              <Row align="center">
                <Link
                  onClick={_populateName}
                >
                  <Text css={{ color: "$primary", userSelect: "none" }}>{"Can't think of something?"}</Text>
                </Link>
              </Row>

              {noConnections && (
                <>
                  <Spacer y={1} />
                  <Row>
                    <Container css={{ backgroundColor: "$orange300", p: 10 }}>
                      <Row>
                        <Text h5>
                          {"You haven't connected to any data source yet. Create charts from a template instead or "}
                          <Link to={`/${match.params.teamId}/${match.params.projectId}/connections`}>
                            {"create a data source first"}
                          </Link>
                        </Text>
                      </Row>
                      <Row>
                        <Text>Please try again</Text>
                      </Row>
                    </Container>
                  </Row>
                </>
              )}

              <Spacer y={1} />
              <Row align="center">
                <Button
                  disabled={loading || !name}
                  type="submit"
                  onClick={_onCreatePressed}
                  form="create-chart"
                  shadow
                  auto
                  size="lg"
                >
                  Start editing
                </Button>
                <Spacer x={0.5} />
                <Link
                  onClick={() => history.goBack()}
                >
                  <Text b css={{ color: "$secondary" }}>Go back</Text>
                </Link>
              </Row>
            </>
          )}
          {selectedMenu === "communityTemplates" && (
            <Row align="center">
              <Grid.Container gap={2}>
                <Grid xs={12} sm={6} md={4}>
                  <Card variant="flat" isPressable isHoverable className="project-segment" onClick={() => setFormType("saTemplate")}>
                    <Card.Body css={{ p: 0 }}>
                      <Card.Image objectFit="cover" width="300" height="300" src={simpleanalyticsDash} />
                    </Card.Body>
                    <Card.Footer>
                      <Row wrap="wrap" justify="center" align="center">
                        <Text h4>
                          Simple Analytics
                        </Text>
                      </Row>
                    </Card.Footer>
                  </Card>
                </Grid>
                <Grid xs={12} sm={6} md={4}>
                  <Card variant="flat" isPressable isHoverable className="project-segment" onClick={() => setFormType("cmTemplate")}>
                    <Card.Body css={{ p: 0 }}>
                      <Card.Image objectFit="cover" width="300" height="300" src={chartmogulDash} />
                    </Card.Body>
                    <Card.Footer>
                      <Row wrap="wrap" justify="center" align="center">
                        <Text h4>
                          ChartMogul
                        </Text>
                      </Row>
                    </Card.Footer>
                  </Card>
                </Grid>
                <Grid xs={12} sm={6} md={4}>
                  <Card variant="flat" isPressable isHoverable className="project-segment" onClick={() => setFormType("mailgunTemplate")}>
                    <Card.Body css={{ p: 0 }}>
                      <Card.Image objectFit="cover" width="300" height="300" src={mailgunDash} />
                    </Card.Body>
                    <Card.Footer>
                      <Row wrap="wrap" justify="center" align="center">
                        <Text h4>
                          Mailgun
                        </Text>
                      </Row>
                    </Card.Footer>
                  </Card>
                </Grid>
                <Grid xs={12} sm={6} md={4}>
                  <Card variant="flat" isPressable isHoverable className="project-segment" onClick={() => setFormType("googleAnalyticsTemplate")}>
                    <Card.Body css={{ p: 0 }}>
                      <Card.Image objectFit="cover" width="300" height="300" src={gaDash} />
                    </Card.Body>
                    <Card.Footer>
                      <Row wrap="wrap" justify="center" align="center">
                        <Text h4>
                          Google Analytics
                        </Text>
                      </Row>
                    </Card.Footer>
                  </Card>
                </Grid>
                <Grid xs={12} sm={6} md={4}>
                  <Card variant="flat" isPressable isHoverable className="project-segment" onClick={() => setFormType("plausibleTemplate")}>
                    <Card.Body css={{ p: 0 }}>
                      <Card.Image objectFit="cover" width="300" height="300" src={plausibleDash} />
                    </Card.Body>
                    <Card.Footer>
                      <Row wrap="wrap" justify="center" align="center">
                        <Text h4>
                          Plausible Analytics
                        </Text>
                      </Row>
                    </Card.Footer>
                  </Card>
                </Grid>
              </Grid.Container>
            </Row>
          )}

          {selectedMenu === "customTemplates" && (
            <Row align="center">
              <CustomTemplates
                templates={templates.data}
                loading={templates.loading}
                teamId={match.params.teamId}
                projectId={match.params.projectId}
                connections={connections}
                onComplete={_onCompleteTemplate}
                isAdmin={canAccess("admin", user.id, team.TeamRoles)}
              />
            </Row>
          )}
        </>
      )}

      {formType === "saTemplate" && selectedMenu === "communityTemplates"
        && (
          <SimpleAnalyticsTemplate
            teamId={teamId}
            projectId={projectId}
            onComplete={_onCompleteTemplate}
            connections={connections}
            onBack={() => setFormType("")}
          />
        )}
      {formType === "cmTemplate" && selectedMenu === "communityTemplates"
        && (
          <ChartMogulTemplate
            teamId={teamId}
            projectId={projectId}
            onComplete={_onCompleteTemplate}
            connections={connections}
            onBack={() => setFormType("")}
          />
        )}
      {formType === "mailgunTemplate" && selectedMenu === "communityTemplates"
        && (
          <MailgunTemplate
            teamId={teamId}
            projectId={projectId}
            onComplete={_onCompleteTemplate}
            connections={connections}
            onBack={() => setFormType("")}
          />
        )}
      {formType === "googleAnalyticsTemplate" && selectedMenu === "communityTemplates"
        && (
          <GaTemplate
            teamId={teamId}
            projectId={projectId}
            onComplete={_onCompleteTemplate}
            connections={connections}
            onBack={() => setFormType("")}
          />
        )}
      {formType === "plausibleTemplate" && selectedMenu === "communityTemplates"
        && (
          <PlausibleTemplate
            teamId={teamId}
            projectId={projectId}
            onComplete={_onCompleteTemplate}
            connections={connections}
            onBack={() => setFormType("")}
          />
        )}
    </Container>
  );
}

ChartDescription.defaultProps = {
  name: "",
  noConnections: false,
};

ChartDescription.propTypes = {
  name: PropTypes.string,
  onChange: PropTypes.func.isRequired,
  history: PropTypes.object.isRequired,
  onCreate: PropTypes.func.isRequired,
  teamId: PropTypes.string.isRequired,
  projectId: PropTypes.string.isRequired,
  connections: PropTypes.array.isRequired,
  match: PropTypes.object.isRequired,
  team: PropTypes.object.isRequired,
  user: PropTypes.object.isRequired,
  templates: PropTypes.object.isRequired,
  noConnections: PropTypes.bool,
};

const mapStateToProps = (state) => ({
  team: state.team.active,
  user: state.user.data,
});

export default withRouter(connect(mapStateToProps)(ChartDescription));
