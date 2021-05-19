import React, { useState } from "react";
import PropTypes from "prop-types";
import {
  Header, Container, Button, Segment, Grid, Card, Image, Form
} from "semantic-ui-react";

import simpleAnalyticsLogo from "../../../assets/simpleAnalytics.png";
import moreLogo from "../../../assets/moreComingSoon.png";
import chartmogulLogo from "../../../assets/ChartMogul.webp";
import mailgunLogo from "../../../assets/mailgun_logo.webp";
import SimpleAnalyticsTemplate from "../../Connections/SimpleAnalytics/SimpleAnalyticsTemplate";
import ChartMogulTemplate from "../../Connections/ChartMogul/ChartMogulTemplate";
import MailgunTemplate from "../../Connections/Mailgun/MailgunTemplate";

function ChartDescription(props) {
  const {
    name, onChange, history, onCreate, teamId, projectId, connections,
  } = props;

  const [error, setError] = useState(false);
  const [loading, setLoading] = useState(false);
  const [viewTemplates, setViewTemplates] = useState(false);
  const [formType, setFormType] = useState("");

  const _onNameChange = (e, data) => {
    onChange(data.value);
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
    <Grid centered columns={1} style={styles.container}>
      {!viewTemplates && (
        <Segment color="olive" compact padded textAlign="left">
          <Container text>
            <Header as="h2" icon textAlign="left">
              {"What are you brewing today?"}
              <Header.Subheader>
                {"Write a short summary of your visualization"}
              </Header.Subheader>
            </Header>
          </Container>

          <Container text style={styles.topBuffer}>
            <Form id="create-chart" style={{ marginBottom: 0 }}>
              <Form.Input
                type="text"
                placeholder="'User growth in the last month'"
                error={error}
                value={name}
                onChange={_onNameChange}
                size="big"
                fluid
                autoFocus
              />
            </Form>
            <div>
              <Button
                className="tertiary"
                size="small"
                content="Can't think of something?"
                onClick={_populateName}
                style={{ marginTop: "-1em" }}
              />
            </div>
          </Container>

          <div style={styles.topBuffer}>
            <Button
              loading={loading}
              type="submit"
              primary
              onClick={_onCreatePressed}
              size="big"
              form="create-chart"
              disabled={!name}
            >
              Create
            </Button>
            <Button
              secondary
              className="tertiary"
              onClick={() => history.goBack()}
              size="big"
              content="Go back"
            />
          </div>
        </Segment>
      )}

      {viewTemplates && (
        <Container textAlign="left">
          {!formType && (
            <Segment color="olive" compact padded>
              <Header as="h2" textAlign="center">
                {"Select one of the services you want to generate charts from"}
              </Header>
              <Card.Group itemsPerRow={5} stackable centered>
                <Card className="project-segment" onClick={() => setFormType("saTemplate")}>
                  <Image src={simpleAnalyticsLogo} />
                  <Card.Content textAlign="center">
                    <Card.Header>Simple Analytics</Card.Header>
                  </Card.Content>
                </Card>
                <Card className="project-segment" onClick={() => setFormType("cmTemplate")}>
                  <Image src={chartmogulLogo} />
                  <Card.Content textAlign="center">
                    <Card.Header>ChartMogul</Card.Header>
                  </Card.Content>
                </Card>
                <Card className="project-segment" onClick={() => setFormType("mailgunTemplate")}>
                  <Image src={mailgunLogo} />
                  <Card.Content textAlign="center">
                    <Card.Header>Mailgun</Card.Header>
                  </Card.Content>
                </Card>
                <Card>
                  <Image src={moreLogo} />
                  <Card.Content textAlign="center">
                    <Card.Header>More coming soon</Card.Header>
                  </Card.Content>
                </Card>
              </Card.Group>
            </Segment>
          )}

          {formType === "saTemplate"
            && (
              <SimpleAnalyticsTemplate
                teamId={teamId}
                projectId={projectId}
                onComplete={_onCompleteTemplate}
                connections={connections}
                onBack={() => setFormType("")}
              />
            )}
          {formType === "cmTemplate"
            && (
              <ChartMogulTemplate
                teamId={teamId}
                projectId={projectId}
                onComplete={_onCompleteTemplate}
                connections={connections}
                onBack={() => setFormType("")}
              />
            )}
          {formType === "mailgunTemplate"
            && (
              <MailgunTemplate
                teamId={teamId}
                projectId={projectId}
                onComplete={_onCompleteTemplate}
                connections={connections}
                onBack={() => setFormType("")}
              />
            )}
        </Container>
      )}

      <Container textAlign="center">
        <Button
          primary
          className="tertiary"
          icon={viewTemplates ? "pencil" : "magic"}
          content={viewTemplates ? "Create a chart from scratch instead" : "Or create from a template"}
          size="big"
          onClick={() => setViewTemplates(!viewTemplates)}
        />
      </Container>
    </Grid>
  );
}

const styles = {
  container: {
    marginTop: 50,
  },
  topBuffer: {
    marginTop: 50,
  },
};

ChartDescription.defaultProps = {
  name: "",
};

ChartDescription.propTypes = {
  name: PropTypes.string,
  onChange: PropTypes.func.isRequired,
  history: PropTypes.object.isRequired,
  onCreate: PropTypes.func.isRequired,
  teamId: PropTypes.string.isRequired,
  projectId: PropTypes.string.isRequired,
  connections: PropTypes.array.isRequired,
};

export default ChartDescription;
