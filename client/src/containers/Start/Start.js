import React, { useState } from "react";
import { connect } from "react-redux";
import PropTypes from "prop-types";
import {
  Container, Card, Loading, Text, Spacer, Row, Link, Input, Button, Grid, useTheme,
} from "@nextui-org/react";
import { motion } from "framer-motion/dist/framer-motion";
import { ToastContainer, toast, Flip } from "react-toastify";
import "react-toastify/dist/ReactToastify.min.css";
import {
  ArrowRight, Category, MoreSquare, Setting
} from "react-iconly";

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
  const [loading, setLoading] = useState(false);
  const [initiated, setInitiated] = useState(false);

  const { isDark } = useTheme();

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
          if (type) {
            setTimeout(() => {
              setLoading(true);
              history.push(`${_getOwnedTeam().id}/${project.id}/connections?type=${type}&edit=true`);
            }, 1500);
          } else {
            setTimeout(() => {
              setLoading(false);
              history.push(`${_getOwnedTeam().id}/${project.id}/dashboard`);
            }, 1500);
          }
        })
        .catch(() => {
          setLoading(true);
          toast.update(toastId, { render: "Oups! Something went wrong. Please try again.", type: "error", isLoading: false });
        });
    }, 1000);
  };

  const _onSubmitProjectName = (e) => {
    if (e && e.preventDefault) e.preventDefault();
    setOnboardingStep("mode");
    setShowBreadcrumbs(true);
    setInitiated(true);
  };

  const renderTemplateCard = (cardImage, connectionType, title) => {
    return (
      <Grid xs={12} sm={6} md={4}>
        <Card isHoverable>
          <Card.Body>
            <Card.Image
              src={cardImage}
              objectFit="cover"
              width="100%"
              height={200}
              alt={title}
            />
          </Card.Body>
          <Card.Footer>
            <Row justify="space-between" align="center">
              <Text b>{title}</Text>
              <Button
                onClick={() => _onSelect(connectionType)}
                disabled={loading}
                auto
              >
                {!loading && "Select"}
                {loading && <Loading type="points" />}
              </Button>
            </Row>
          </Card.Footer>
        </Card>
      </Grid>
    );
  };

  const renderConnectionCard = (connectionType, title) => {
    return (
      <Grid xs={6} sm={4} md={3}>
        <Card isHoverable>
          <Card.Header>{title}</Card.Header>
          <Card.Body>
            <Card.Image
              src={connectionImages[connectionType]}
              objectFit="contain"
              width="100%"
              height={140}
              alt={title}
            />
          </Card.Body>
          <Card.Footer>
            <Button
              onClick={() => _onSelect(connectionType)}
              auto
              disabled={loading}
            >
              {!loading && "Select"}
              {loading && <Loading type="points" />}
            </Button>
          </Card.Footer>
        </Card>
      </Grid>
    );
  };

  return (
    <div>
      <Navbar hideTeam transparent />
      <Container>
        <Row justify="center" align="center">
          <motion.div
            animate={{ opacity: [1, 1, 1, 1, 1, 1, 0], scale: 1, translateY: [0, 0, 0, 0, 0, -50] }}
            transition={{ duration: 2 }}
          >
            <Text h1>
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
            </Text>
          </motion.div>
        </Row>
        <Row justify="center" align="center">
          <motion.div
            animate={{
              translateY: onboardingStep === "project" && !showBreadcrumbs ? [0, 0, 0, 0, 0, 0, -100] : [0, -250]
            }}
            transition={{ duration: onboardingStep === "project" ? 3 : 0.5 }}
          >
            <motion.div
              animate={{ opacity: [0, 0, 0, 0, 0, 1], scale: 1 }}
              transition={{ duration: 2.5 }}
            >
              <Container fluid>
                <Row justify="center" align="center">
                  <Text h1>
                    {"Set up your new Chartbrew project"}
                  </Text>
                </Row>
                <Row justify="center" align="center">
                  {onboardingStep === "project" && (
                    <Text h3>{"First, enter a name below"}</Text>
                  )}
                  {onboardingStep === "mode" && (
                    <Text h3>{"Get started with one of the options below"}</Text>
                  )}
                  {onboardingStep === "data" && (
                    <Text h3>
                      {mode === "template" ? "Select a template to start with" : "Select a connection to start with"}
                    </Text>
                  )}
                </Row>
              </Container>
            </motion.div>
            <Spacer y={1} />

            {showBreadcrumbs && (
              <Container>
                <Row justify="center" align="center">
                  <Link onClick={() => setOnboardingStep("project")}>
                    <Text
                      b={onboardingStep === "project"}
                      css={{ color: onboardingStep !== "project" ? "$text" : "$secondary" }}
                    >
                      Project
                    </Text>
                  </Link>
                  <Spacer x={1} />
                  {projectName && (
                    <Text css={{ color: "$accents6" }}>/</Text>
                  )}
                  <Spacer x={1} />
                  {projectName && (
                    <Link onClick={() => setOnboardingStep("mode")}>
                      <Text
                        css={{ color: onboardingStep !== "mode" ? "$text" : "$secondary" }}
                        b={onboardingStep === "mode"}
                      >
                        Starting mode
                      </Text>
                    </Link>
                  )}
                  <Spacer x={1} />
                  {projectName && mode && (
                    <Text css={{ color: "$accents6" }}>/</Text>
                  )}
                  <Spacer x={1} />
                  {projectName && mode && (
                    <Link onClick={() => setOnboardingStep("data")}>
                      <Text
                        css={{ color: onboardingStep !== "data" ? "$text" : "$secondary" }}
                        b={onboardingStep === "data"}
                      >
                        {mode === "template" ? "Templates" : "Connections"}
                      </Text>
                    </Link>
                  )}
                </Row>
              </Container>
            )}

            {onboardingStep === "project" && (
            <Container md>
              <Spacer y={1} />
              <motion.div
                animate={{
                  opacity: !initiated ? [0, 0, 0, 0, 0, 1] : [0, 1],
                  scale: [0.8, 0.8, 1]
                }}
                transition={{ duration: !initiated ? 3 : 0.5 }}
              >
                <form onSubmit={_onSubmitProjectName}>
                  <Input
                    placeholder="Name your cool project"
                    value={projectName}
                    onChange={(e) => setProjectName(e.target.value)}
                    size="xl"
                    fullWidth
                    bordered
                  />
                  <Spacer y={1} />
                  <Button
                    color="gradient"
                    onClick={_onSubmitProjectName}
                    iconRight={<ArrowRight />}
                    size="lg"
                    disabled={projectName.length < 1}
                    auto
                    shadow
                  >
                    {"Next step"}
                  </Button>
                </form>
              </motion.div>
            </Container>
            )}

            {onboardingStep === "mode" && (
            <Container md>
              <motion.div animate={{ scale: [0.8, 1] }} transition={{ duration: 0.3 }}>
                <Grid.Container gap={3}>
                  <Grid xs={12} sm={4}>
                    <Card
                      onClick={() => {
                        setMode("template");
                        setOnboardingStep("data");
                      }}
                      isHoverable
                      isPressable
                      variant={mode === "template" ? "shadow" : "bordered"}
                      css={{ p: "$8", mw: "400px" }}
                    >
                      <Card.Body>
                        <Row>
                          <Category size={"xlarge"} />
                        </Row>
                        <Row>
                          <Text h3>
                            {"Start with a template"}
                          </Text>
                        </Row>
                        <Spacer y={1} />
                        <Row>
                          <Text style={{ fontSize: "1.2em" }}>
                            {"Get started with dashboards and charts already created for you"}
                          </Text>
                        </Row>
                      </Card.Body>
                    </Card>
                  </Grid>
                  <Grid xs={12} sm={4}>
                    <Card
                      onClick={() => {
                        setMode("connection");
                        setOnboardingStep("data");
                      }}
                      isHoverable
                      isPressable
                      variant={mode === "connection" ? "shadow" : "bordered"}
                      css={{ p: "$8", mw: "400px" }}
                    >
                      <Card.Body>
                        <Row>
                          <Setting size={"xlarge"} />
                        </Row>
                        <Row>
                          <Text h3>
                            {"Start with a connection"}
                          </Text>
                        </Row>
                        <Spacer y={1} />
                        <Row>
                          <Text style={{ fontSize: "1.2em" }}>
                            {"Connect to a data source and create charts from scratch"}
                          </Text>
                        </Row>
                      </Card.Body>
                    </Card>
                  </Grid>
                  <Grid xs={12} sm={4}>
                    <Card
                      onClick={() => _onSelect()}
                      isHoverable
                      isPressable
                      variant={mode === "template" ? "shadow" : "bordered"}
                      css={{ p: "$8", mw: "400px" }}
                    >
                      <Card.Body>
                        <Row>
                          <MoreSquare size={"xlarge"} />
                        </Row>
                        <Row>
                          <Text h3>
                            {"Empty project"}
                          </Text>
                        </Row>
                        <Spacer y={1} />
                        <Row>
                          <Text style={{ fontSize: "1.2em" }}>
                            {"Create an empty project and choose what to do next"}
                          </Text>
                        </Row>
                      </Card.Body>
                    </Card>
                  </Grid>
                </Grid.Container>
              </motion.div>
              <Spacer y={1} />
            </Container>
            )}

            <Container>
              {onboardingStep === "data" && mode === "template" && (
              <motion.div animate={{ scale: [0.8, 1] }} transition={{ duration: 0.3 }}>
                <Grid.Container gap={2}>
                  {renderTemplateCard(simpleanalyticsDash, "saTemplate", "Simple Analytics")}
                  {renderTemplateCard(chartmogulDash, "cmTemplate", "ChartMogul")}
                  {renderTemplateCard(mailgunDash, "mailgunTemplate", "Mailgun")}
                  {renderTemplateCard(gaDash, "googleAnalyticsTemplate", "Google Analytics")}
                  {renderTemplateCard(plausibleDash, "plausibleTemplate", "Plausible Analytics")}
                </Grid.Container>
              </motion.div>
              )}

              {onboardingStep === "data" && mode === "connection" && (
              <motion.div animate={{ scale: [0.8, 1] }} transition={{ duration: 0.3 }}>
                <Grid.Container gap={2}>
                  {renderConnectionCard("api", "API")}
                  {renderConnectionCard("mongodb", "MongoDB")}
                  {renderConnectionCard("postgres", "PostgreSQL")}
                  {renderConnectionCard("mysql", "MySQL")}
                  {renderConnectionCard("firestore", "Firestore")}
                  {renderConnectionCard("realtimedb", "Realtime Database")}
                  {renderConnectionCard("googleAnalytics", "Google Analytics")}
                  {renderConnectionCard("customerio", "Customer.io")}
                </Grid.Container>
              </motion.div>
              )}

              {onboardingStep === "data" && (
              <div>
                <Spacer y={1} />
                <Text i css={{ fontSize: "1.2em", color: "$accents6", textAlign: "center" }}>
                  Make your selection to get started
                </Text>
              </div>
              )}
            </Container>

            <Spacer y={2} />
          </motion.div>
        </Row>

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
          theme={isDark ? "dark" : "light"}
        />
      </Container>

    </div>
  );
}

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
