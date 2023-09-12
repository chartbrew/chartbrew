import React, { useState, useEffect } from "react";
import PropTypes from "prop-types";
import {
  Button, Input, Spacer, Link, Card, Tabs, Tab, CardBody, Image, CardFooter,
} from "@nextui-org/react";
import { connect } from "react-redux";
import { withRouter } from "react-router";
import { Link as RouterLink } from "react-router-dom";

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
import Container from "../../../components/Container";
import Text from "../../../components/Text";
import Row from "../../../components/Row";

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
    <Container className={"bg-content2 rounded-md p-10"}>
      <Row align="center" wrap="wrap" className={"flex gap-1 ml-0"}>
        <Tabs selectedKey={selectedMenu} onSelectionChange={(key) => setSelectedMenu(key)}>
          <Tab key="emptyChart" value="emptyChart" label="Create from scratch" />
          <Tab key="communityTemplates" value="communityTemplates" label="Community templates" />
          <Tab key="customTemplates" value="customTemplates" label="Custom templates" />
        </Tabs>
      </Row>
      <Spacer y={2} />
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
              <Spacer y={2} />
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
                    color={error ? "danger" : "primary"}
                    description={error}
                    value={name}
                    onChange={_onNameChange}
                    size="lg"
                    fullWidth
                    autoFocus
                    variant="bordered"
                  />
                </form>
              </Row>
              <Spacer y={1} />
              <Row align="center">
                <Link
                  onClick={_populateName}
                >
                  <Text className={"text-primary"}>{"Can't think of something?"}</Text>
                </Link>
              </Row>

              {noConnections && (
                <>
                  <Spacer y={2} />
                  <Row>
                    <Container className={"bg-blue-100 p-10 rounded-md"}>
                      <Row>
                        <Text h5>
                          {"You haven't connected to any data source yet. Create charts from a template instead or "}
                          <RouterLink to={`/${match.params.teamId}/${match.params.projectId}/connections`}>
                            {"create a data source first"}
                          </RouterLink>
                        </Text>
                      </Row>
                    </Container>
                  </Row>
                </>
              )}

              <Spacer y={2} />
              <Row align="center">
                <Button
                  disabled={!name}
                  isLoading={loading}
                  type="submit"
                  onClick={_onCreatePressed}
                  form="create-chart"
                  auto
                  size="lg"
                >
                  Start editing
                </Button>
                <Spacer x={1} />
                <Link
                  onClick={() => history.goBack()}
                >
                  <Text b className={"text-secondary"}>Go back</Text>
                </Link>
              </Row>
            </>
          )}
          {selectedMenu === "communityTemplates" && (
            <Row align="center">
              <div className="grid grid-cols-12 gap-2">
                <div className="col-span-4 sm:col-span-12 md:col-span-6">
                  <Card variant="flat" isPressable isHoverable className="project-segment" onClick={() => setFormType("saTemplate")}>
                    <CardBody className="p-10">
                      <Image className="object-cover" width="300" height="300" src={simpleanalyticsDash} />
                    </CardBody>
                    <CardFooter>
                      <Row wrap="wrap" justify="center" align="center">
                        <Text h4>
                          Simple Analytics
                        </Text>
                      </Row>
                    </CardFooter>
                  </Card>
                </div>
                <div className="col-span-4 sm:col-span-12 md:col-span-6">
                  <Card variant="flat" isPressable isHoverable className="project-segment" onClick={() => setFormType("cmTemplate")}>
                    <CardBody className="p-0">
                      <Image className="object-cover" width="300" height="300" src={chartmogulDash} />
                    </CardBody>
                    <CardFooter>
                      <Row wrap="wrap" justify="center" align="center">
                        <Text h4>
                          ChartMogul
                        </Text>
                      </Row>
                    </CardFooter>
                  </Card>
                </div>
                <div className="col-span-4 sm:col-span-12 md:col-span-6">
                  <Card variant="flat" isPressable isHoverable className="project-segment" onClick={() => setFormType("mailgunTemplate")}>
                    <CardBody className="p-0">
                      <Image className="object-cover" width="300" height="300" src={mailgunDash} />
                    </CardBody>
                    <CardFooter>
                      <Row wrap="wrap" justify="center" align="center">
                        <Text h4>
                          Mailgun
                        </Text>
                      </Row>
                    </CardFooter>
                  </Card>
                </div>
                <div className="col-span-4 sm:col-span-12 md:col-span-6">
                  <Card variant="flat" isPressable isHoverable className="project-segment" onClick={() => setFormType("googleAnalyticsTemplate")}>
                    <CardBody className="p-0">
                      <Image className="object-cover" width="300" height="300" src={gaDash} />
                    </CardBody>
                    <CardFooter>
                      <Row wrap="wrap" justify="center" align="center">
                        <Text h4>
                          Google Analytics
                        </Text>
                      </Row>
                    </CardFooter>
                  </Card>
                </div>
                <div className="col-span-4 sm:col-span-12 md:col-span-6">
                  <Card variant="flat" isPressable isHoverable className="project-segment" onClick={() => setFormType("plausibleTemplate")}>
                    <CardBody className="p-0">
                      <Image className="object-cover" width="300" height="300" src={plausibleDash} />
                    </CardBody>
                    <CardFooter>
                      <Row wrap="wrap" justify="center" align="center">
                        <Text h4>
                          Plausible Analytics
                        </Text>
                      </Row>
                    </CardFooter>
                  </Card>
                </div>
              </div>
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
