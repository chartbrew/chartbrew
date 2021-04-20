import React, { useState } from "react";
import PropTypes from "prop-types";
import {
  Segment, Form, Button, Icon, Header, Label, Message, Container, Divider,
} from "semantic-ui-react";

import { generateDashboard } from "../../../actions/connection";

/*
  The Form used to configure the SimpleAnalytics template
*/
function SimpleAnalyticsTemplate(props) {
  const {
    teamId, projectId, addError, onComplete,
  } = props;

  const [loading, setLoading] = useState(false);
  const [connection, setConnection] = useState({});
  const [errors, setErrors] = useState({});

  const _onGenerateDashboard = () => {
    setErrors({});

    if (!connection.website || connection.website.length > 24) {
      setTimeout(() => {
        setErrors({ ...errors, website: "Please enter your website" });
      }, 100);
      return;
    }

    const data = { ...connection, team_id: teamId };
    setLoading(true);

    generateDashboard(projectId, data, "simpleanalytics")
      .then(() => {
        setTimeout(() => {
          onComplete();
        }, 2000);
      })
      .catch(() => {
        setLoading(false);
      });
  };

  return (
    <div style={styles.container}>
      <Segment style={styles.mainSegment}>
        <Header as="h3" style={{ marginBottom: 20 }}>
          Configure the template
        </Header>

        <div style={styles.formStyle}>
          <Form>
            <Form.Field error={!!errors.name} required>
              <label>Enter your Simple Analytics website</label>
              <Form.Input
                placeholder="Which is the website you want to see the stats for?"
                value={connection.website || ""}
                onChange={(e, data) => {
                  setConnection({ ...connection, website: data.value });
                }}
              />
              {errors.website
                && (
                  <Label basic color="red" pointing>
                    {errors.website}
                  </Label>
                )}
            </Form.Field>

            <Form.Field>
              <label>Enter your Simple Analytics API key (if the website is private)</label>
              <Form.Input
                placeholder="sa-api-key-*"
                value={connection.apiKey || ""}
                onChange={(e, data) => {
                  setConnection({ ...connection, apiKey: data.value });
                }}
              />
            </Form.Field>
          </Form>
        </div>

        {addError
          && (
            <Message negative>
              <Message.Header>{"Server error while trying to save your connection"}</Message.Header>
              <p>Please try adding your connection again.</p>
            </Message>
          )}

        <Divider hidden />
        <Container fluid textAlign="right">
          <Button
            primary
            loading={loading}
            onClick={_onGenerateDashboard}
            icon
            labelPosition="right"
            style={styles.saveBtn}
          >
            <Icon name="magic" />
            Create your dashboard
          </Button>
        </Container>
      </Segment>
    </div>
  );
}
const styles = {
  container: {
    flex: 1,
  },
  mainSegment: {
    padding: 20,
  },
  formStyle: {
    marginTop: 20,
    marginBottom: 20,
  },
  saveBtn: {
    marginRight: 0,
  },
};

SimpleAnalyticsTemplate.defaultProps = {
  addError: null,
};

SimpleAnalyticsTemplate.propTypes = {
  teamId: PropTypes.string.isRequired,
  projectId: PropTypes.string.isRequired,
  onComplete: PropTypes.func.isRequired,
  addError: PropTypes.bool,
};

export default SimpleAnalyticsTemplate;
