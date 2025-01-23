import React, { useState, useEffect } from "react";
import PropTypes from "prop-types";
import {
  Button, Input, Spacer, Link, Card, Tabs, Tab, CardBody, Image, CardFooter, Divider,
} from "@heroui/react";
import { connect, useSelector } from "react-redux";
import { useNavigate, useParams } from "react-router-dom";
import { LuArrowLeft, LuArrowRight } from "react-icons/lu";

import SimpleAnalyticsTemplate from "../../Connections/SimpleAnalytics/SimpleAnalyticsTemplate";
import ChartMogulTemplate from "../../Connections/ChartMogul/ChartMogulTemplate";
import MailgunTemplate from "../../Connections/Mailgun/MailgunTemplate";
import GaTemplate from "../../Connections/GoogleAnalytics/GaTemplate";
import CustomTemplates from "../../Connections/CustomTemplates/CustomTemplates";
import PlausibleTemplate from "../../Connections/Plausible/PlausibleTemplate";
import canAccess from "../../../config/canAccess";
import Container from "../../../components/Container";
import Text from "../../../components/Text";
import Row from "../../../components/Row";
import availableTemplates from "../../../modules/availableTemplates";
import { selectTeam } from "../../../slices/team";
import { selectUser } from "../../../slices/user";

function ChartDescription(props) {
  const {
    name, onChange, onCreate, teamId, projectId, connections, templates,
  } = props;

  const [error, setError] = useState(false);
  const [loading, setLoading] = useState(false);
  const [formType, setFormType] = useState("");
  const [selectedMenu, setSelectedMenu] = useState("emptyChart");

  const navigate = useNavigate();
  const params = useParams();
  const team = useSelector(selectTeam);
  const user = useSelector(selectUser);

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
    navigate(`/${teamId}/${projectId}/dashboard`);
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

  const _canAccess = (role) => {
    return canAccess(role, user.id, team.TeamRoles);
  };

  return (
    <Container className={"bg-content1 rounded-md p-5 mt-10"}>
      <Row align="center" wrap="wrap">
        <Tabs selectedKey={selectedMenu} onSelectionChange={(key) => setSelectedMenu(key)}>
          <Tab key="emptyChart" title="Create from scratch" />
          <Tab key="communityTemplates" title="Community templates" isDisabled={!_canAccess("teamAdmin")} />
          <Tab key="customTemplates" title="Custom templates" isDisabled={!_canAccess("teamAdmin")} />
        </Tabs>
      </Row>
      <Spacer y={4} />
      {!formType && (
        <>
          {selectedMenu === "emptyChart" && (
            <>
              <Row align="center">
                <Text size="h3">
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

              <Spacer y={4} />
              <Row align="center">
                <Button
                  isDisabled={!name}
                  isLoading={loading}
                  type="submit"
                  onClick={_onCreatePressed}
                  form="create-chart"
                  color="primary"
                  size="lg"
                  endContent={<LuArrowRight />}
                >
                  Start editing
                </Button>
              </Row>
            </>
          )}
          {selectedMenu === "communityTemplates" && (
            <Row align="center">
              <div className="grid grid-cols-12 gap-2">
                {availableTemplates.map((t) => (
                  <div key={t.type} className="col-span-12 sm:col-span-6 md:col-span-4 lg:col-span-3">
                    <Card
                      isPressable
                      isHoverable
                      onClick={() => setFormType(t.type)}
                    >
                      <CardBody className="p-0">
                        <Image className="object-cover" width="300" height="300" src={t.image} />
                      </CardBody>
                      <CardFooter>
                        <Row wrap="wrap" justify="center" align="center">
                          <Text size="h4">
                            {t.name}
                          </Text>
                        </Row>
                      </CardFooter>
                    </Card>
                  </div>
                ))}
              </div>
            </Row>
          )}

          {selectedMenu === "customTemplates" && (
            <Row align="center">
              <CustomTemplates
                templates={templates.data}
                loading={templates.loading}
                teamId={params.teamId}
                projectId={params.projectId}
                connections={connections}
                onComplete={_onCompleteTemplate}
                isAdmin={canAccess("teamAdmin", user.id, team.TeamRoles)}
              />
            </Row>
          )}
        </>
      )}

      {formType && (
        <>
          <Row align={"start"} justify={"start"}>
            <Button
              variant="flat"
              onClick={() => setFormType("")}
              startContent={<LuArrowLeft />}
              size="small"
            >
              Back
            </Button>
          </Row>

          <Spacer y={2} />
          <Divider />
          <Spacer y={4} />
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
};

ChartDescription.propTypes = {
  name: PropTypes.string,
  onChange: PropTypes.func.isRequired,
  onCreate: PropTypes.func.isRequired,
  teamId: PropTypes.string.isRequired,
  projectId: PropTypes.string.isRequired,
  connections: PropTypes.array.isRequired,
  templates: PropTypes.object.isRequired,
};

const mapStateToProps = () => ({
});

export default connect(mapStateToProps)(ChartDescription);
