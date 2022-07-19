import React, { useState } from "react";
import { connect } from "react-redux";
import PropTypes from "prop-types";
import { useWindowSize } from "react-use";
import {
  Breadcrumb, Button, Card, Container, Dimmer, Divider, Form,
  Header, Icon, Image, Input, Label, Segment, Transition,
} from "semantic-ui-react";
import { motion } from "framer-motion/dist/framer-motion";
import { ToastContainer, toast, Flip } from "react-toastify";
import "react-toastify/dist/ReactToastify.min.css";

import {
  blackTransparent, blue, dark, secondary, whiteTransparent
} from "../../config/colors";
import { createProject as createProjectAction } from "../../actions/project";
import { getTeams as getTeamsAction } from "../../actions/team";
import simpleanalyticsDash from "../Connections/SimpleAnalytics/simpleanalytics-template.jpeg";
import plausibleDash from "../Connections/Plausible/plausible-template.jpeg";
import gaDash from "../Connections/GoogleAnalytics/ga-template.jpeg";
import chartmogulDash from "../Connections/ChartMogul/chartmogul-template.jpeg";
import mailgunDash from "../Connections/Mailgun/mailgun-template.jpeg";
import connectionImages from "../../config/connectionImages";
import Navbar from "../../components/Navbar";

function Start(props) {
  const {
    teams, history, createProject, getTeams, user,
  } = props;

  const [onboardingStep, setOnboardingStep] = useState("project");
  const [projectName, setProjectName] = useState("");
  const [mode, setMode] = useState("");
  const [showBreadcrumbs, setShowBreadcrumbs] = useState(false);
  const [dimmed, setDimmed] = useState("");
  const [loading, setLoading] = useState(false);
  const [initiated, setInitiated] = useState(false);

  const { height } = useWindowSize();

  const _getOwnedTeam = () => {
    let team;
    teams.forEach((t) => {
      if (t.TeamRoles) {
        t.TeamRoles.forEach((tr) => {
          if (tr.user_id === user.id && tr.role === "owner") {
            team = t;
          }
        });
      }
    });

    return team;
  };

  const _onSelect = (type) => {
    if (loading) return;

    setLoading(true);
    const toastId = toast.loading("Creating your project...");
    setTimeout(() => {
      return createProject({
        name: projectName,
        team_id: _getOwnedTeam().id,
      })
        .then((project) => {
          // refresh teams to avoid the onboarding from appearing again
          getTeams(user.id);
          toast.update(toastId, { render: "🎉 Project created! One sec...", type: "success", isLoading: false });
          setTimeout(() => {
            setLoading(true);
            history.push(`${_getOwnedTeam().id}/${project.id}/connections?type=${type}&edit=true`);
          }, 1500);
        })
        .catch(() => {
          setLoading(true);
          toast.update(toastId, { render: "Oups! Something went wrong. Please try again.", type: "error", isLoading: false });
        });
    }, 1000);
  };

  const renderTemplateCard = (cardImage, connectionType, title) => {
    return (
      <Card
        className="project-segment"
        onClick={() => _onSelect(connectionType)}
        onMouseEnter={() => setDimmed(connectionType)}
        onMouseLeave={() => setDimmed("")}
      >
        <Transition visible={dimmed === connectionType}>
          <Dimmer inverted active={dimmed === connectionType}>
            {dimmed === connectionType && (
              <motion.div
                whileHover={{ scale: 1.2 }}
                animate={{ opacity: dimmed === connectionType ? 1 : 0 }}
              >
                <Button
                  color="blue"
                  loading={loading}
                >
                  {"Create "}
                  <Icon name="arrow right" size="small" />
                </Button>
              </motion.div>
            )}
          </Dimmer>
        </Transition>
        <Image src={cardImage} />
        <Card.Content textAlign="center" style={styles.smallerText}>
          <Card.Header>{title}</Card.Header>
        </Card.Content>
      </Card>
    );
  };

  const renderConnectionCard = (connectionType, title) => {
    return (
      <Card
        className="project-segment"
        onClick={() => _onSelect(connectionType)}
        onMouseEnter={() => setDimmed(connectionType)}
        onMouseLeave={() => setDimmed("")}
      >
        <Transition visible={dimmed === connectionType}>
          <Dimmer inverted active={dimmed === connectionType}>
            {dimmed === connectionType && (
              <motion.div
                whileHover={{ scale: 1.2 }}
                animate={{ opacity: dimmed === connectionType ? 1 : 0 }}
              >
                <Button
                  color="blue"
                  loading={loading}
                >
                  {"Create "}
                  <Icon name="arrow right" size="small" />
                </Button>
              </motion.div>
            )}
          </Dimmer>
        </Transition>
        <Image src={connectionImages[connectionType]} />
        <Card.Content textAlign="center" style={styles.smallerText}>
          <Card.Header>{title}</Card.Header>
        </Card.Content>
      </Card>
    );
  };

  return (
    <div style={styles.container(height)}>
      <Navbar hideTeam transparent color={dark} />
      <Segment basic style={{ paddingTop: 100 }}>
        <motion.div
          animate={{ opacity: [1, 1, 1, 1, 1, 1, 0], scale: 1, translateY: [0, 0, 0, 0, 0, -50] }}
          transition={{ duration: 2 }}
        >
          <Header textAlign="center" as="h1" size="massive" style={styles.titleText} inverted>
            <motion.div
              style={{ fontSize: "2em", marginBottom: 20 }}
              animate={{
                rotateZ: [0, 30, 0, 30, 0, 30, 0, 30, 0],
              }}
              transition={{ duration: 1.5 }}
              >
              {"👋"}
            </motion.div>
            <span style={{ fontSize: "1.5em" }}>{"Hi!"}</span>
          </Header>
        </motion.div>
        <motion.div animate={{ translateY: [0, 0, 0, 0, 0, 0, -100] }} transition={{ duration: 3 }}>
          <motion.div
            animate={{ opacity: [0, 0, 0, 0, 0, 1], scale: 1 }}
            transition={{ duration: 2.5 }}
          >
            <Header textAlign="center" as="h1" inverted size="massive" style={styles.titleText}>
              {"Set up your new Chartbrew project"}
              {onboardingStep === "project" && (
              <Header.Subheader>First, enter a name below</Header.Subheader>
              )}
              {onboardingStep === "mode" && (
              <Header.Subheader>Get started with one of the options below</Header.Subheader>
              )}
              {onboardingStep === "data" && (
              <Header.Subheader>
                {mode === "template" ? "Select a template to start with" : "Select a connection to start with"}
              </Header.Subheader>
              )}
            </Header>
          </motion.div>
          <Divider section hidden />

          {showBreadcrumbs && (
            <>
              <div style={{ textAlign: "center" }}>
                <Breadcrumb size="large" style={{ color: whiteTransparent(1) }}>
                  <Breadcrumb.Section
                    link={onboardingStep !== "project"}
                    style={{ color: onboardingStep === "project" ? whiteTransparent(1) : secondary }}
                    active={onboardingStep === "project"}
                    onClick={() => setOnboardingStep("project")}
                  >
                    Project
                  </Breadcrumb.Section>
                  {projectName && (
                    <Breadcrumb.Divider style={{ color: whiteTransparent(1) }} />
                  )}
                  {projectName && (
                    <Breadcrumb.Section
                      link={onboardingStep !== "mode"}
                      style={{ color: onboardingStep === "mode" ? whiteTransparent(1) : secondary }}
                      active={onboardingStep === "mode"}
                      onClick={() => setOnboardingStep("mode")}
                    >
                      Starting mode
                    </Breadcrumb.Section>
                  )}
                  {projectName && mode && (
                    <Breadcrumb.Divider style={{ color: whiteTransparent(1) }} />
                  )}
                  {projectName && mode && (
                    <Breadcrumb.Section
                      link={onboardingStep !== "data"}
                      style={{ color: onboardingStep === "data" ? whiteTransparent(1) : secondary }}
                      active={onboardingStep === "data"}
                      onClick={() => setOnboardingStep("data")}
                    >
                      {mode === "template" ? "Templates" : "Connections"}
                    </Breadcrumb.Section>
                  )}
                </Breadcrumb>
              </div>
              <Divider hidden />
            </>
          )}

          {onboardingStep === "project" && (
            <Container text>
              <motion.div
                animate={{
                  opacity: !initiated ? [0, 0, 0, 0, 0, 1] : [0, 1],
                  scale: [0.8, 0.8, 1]
                }}
                transition={{ duration: !initiated ? 3 : 0.5 }}
              >
                <Form size="huge" inverted>
                  <Form.Field>
                    <Input
                      placeholder="Name your cool project"
                      value={projectName}
                      onChange={(e, data) => setProjectName(data.value)}
                    />
                  </Form.Field>
                  <Form.Field>
                    <motion.div whileHover={{ scale: 1.1, translateX: 30 }}>
                      <Button
                        secondary
                        onClick={() => {
                          setOnboardingStep("mode");
                          setShowBreadcrumbs(true);
                          setInitiated(true);
                        }}
                        icon
                        size="huge"
                        disabled={projectName.length < 1}
                        style={{ color: blue }}
                      >
                        {"Next step "}
                        <Icon name="arrow right" />
                      </Button>
                    </motion.div>
                  </Form.Field>
                </Form>
              </motion.div>
            </Container>
          )}

          {onboardingStep === "mode" && (
            <Container text textAlign="center">
              <motion.div animate={{ scale: [0.8, 1] }} transition={{ duration: 0.3 }}>
                <Card.Group itemsPerRow={2}>
                  <Card
                    className="project-segment"
                    onClick={() => {
                      setMode("template");
                      setOnboardingStep("data");
                    }}
                    raised={mode === "template"}
                    color={mode === "template" ? "olive" : null}
                  >
                    {mode === "template" && (
                      <Label corner="right" color="olive">
                        <Icon name="checkmark" />
                      </Label>
                    )}
                    <Card.Content>
                      <Header icon>
                        <Icon name="magic" />
                        {"Start with a template"}
                      </Header>
                    </Card.Content>
                    <Card.Content description style={{ color: blackTransparent(0.8) }}>
                      <p style={{ fontSize: "1.2em" }}>
                        {"Get started with dashboards and charts already created for you"}
                      </p>
                    </Card.Content>
                  </Card>
                  <Card
                    className="project-segment"
                    onClick={() => {
                      setMode("connection");
                      setOnboardingStep("data");
                    }}
                    raised={mode === "connection"}
                    color={mode === "connection" ? "olive" : null}
                  >
                    {mode === "connection" && (
                      <Label corner="right" color="olive">
                        <Icon name="checkmark" />
                      </Label>
                    )}
                    <Card.Content>
                      <Header icon>
                        <Icon name="plug" />
                        {"Start with a connection"}
                      </Header>
                    </Card.Content>
                    <Card.Content description style={{ color: blackTransparent(0.8) }}>
                      <p style={{ fontSize: "1.2em" }}>
                        {"Connect to a data source and create charts from scratch"}
                      </p>
                    </Card.Content>
                  </Card>
                </Card.Group>
              </motion.div>
              <Divider hidden />
            </Container>
          )}

          <Container>
            {onboardingStep === "data" && mode === "template" && (
              <motion.div animate={{ scale: [0.8, 1] }} transition={{ duration: 0.3 }}>
                <Card.Group itemsPerRow={3} stackable>
                  {renderTemplateCard(simpleanalyticsDash, "saTemplate", "Simple Analytics")}
                  {renderTemplateCard(chartmogulDash, "cmTemplate", "ChartMogul")}
                  {renderTemplateCard(mailgunDash, "mailgunTemplate", "Mailgun")}
                  {renderTemplateCard(gaDash, "googleAnalyticsTemplate", "Google Analytics")}
                  {renderTemplateCard(plausibleDash, "plausibleTemplate", "Plausible Analytics")}
                </Card.Group>
              </motion.div>
            )}

            {onboardingStep === "data" && mode === "connection" && (
              <motion.div animate={{ scale: [0.8, 1] }} transition={{ duration: 0.3 }}>
                <Card.Group itemsPerRow={5} stackable>
                  {renderConnectionCard("api", "API")}
                  {renderConnectionCard("mongodb", "MongoDB")}
                  {renderConnectionCard("postgres", "PostgreSQL")}
                  {renderConnectionCard("mysql", "MySQL")}
                  {renderConnectionCard("firestore", "Firestore")}
                  {renderConnectionCard("realtimedb", "Realtime Database")}
                  {renderConnectionCard("googleAnalytics", "Google Analytics")}
                  {renderConnectionCard("customerio", "Customer.io")}
                </Card.Group>
              </motion.div>
            )}

            {onboardingStep === "data" && (
              <div>
                <Divider hidden />
                <p style={{ fontSize: "1.2em", color: whiteTransparent(0.7), textAlign: "center" }}>
                  <i>Make your selection to get started</i>
                </p>
              </div>
            )}
          </Container>

          <Divider section hidden />
        </motion.div>

        <ToastContainer
          position="bottom-right"
          autoClose={1500}
          hideProgressBar={false}
          newestOnTop={false}
          closeOnClick
          rtl={false}
          pauseOnVisibilityChange
          draggable
          pauseOnHover
          transition={Flip}
        />
      </Segment>

    </div>
  );
}

const styles = {
  container: (height) => ({
    backgroundColor: dark,
    minHeight: height + 20,
  }),
};

Start.propTypes = {
  teams: PropTypes.object.isRequired,
  history: PropTypes.object.isRequired,
  createProject: PropTypes.func.isRequired,
  user: PropTypes.object.isRequired,
  getTeams: PropTypes.func.isRequired,
};

const mapStateToProps = (state) => ({
  teams: state.team.data && state.team.data,
  user: state.user.data,
});

const mapDispatchToProps = (dispatch) => ({
  createProject: (data) => dispatch(createProjectAction(data)),
  getTeams: (userId) => dispatch(getTeamsAction(userId)),
});

export default connect(mapStateToProps, mapDispatchToProps)(Start);
