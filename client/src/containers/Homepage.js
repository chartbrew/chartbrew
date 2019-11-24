import React, { Component } from "react";
import PropTypes from "prop-types";
import { connect } from "react-redux";

import { Link } from "react-router-dom";
import {
  Menu, Header, Button, Segment, Container, Icon, Image, Label, Card,
  Grid, Divider, Responsive, Visibility, Form, Input, Popup,
} from "semantic-ui-react";
import AnchorLink from "react-anchor-link-smooth-scroll";
import moment from "moment";

import PricingPlans from "../components/PricingPlans";
import {
  blue, primary, secondary, lightGray, teal
} from "../config/colors";
import { addEmailToList } from "../actions/user";
import cbLogoSmall from "../assets/cb_logo_4_small.png";
import cbLogoSmallInverted from "../assets/cb_logo_4_small_inverted.png";
import showcase from "../assets/demo.gif";
import mongo from "../assets/mongodb-logo-1.png";
import mysql from "../assets/mysql.svg";
import postgres from "../assets/postgres.png";
import api from "../assets/api.png";
import firebase from "../assets/firebase_logo.png";
import chartsImage from "../assets/charts.jpg";
import dashboardImage from "../assets/dashboard.jpg";
import publicImage from "../assets/public_dashboard.jpg";
import teamImage from "../assets/team_1mod.png";
import securityImage from "../assets/security_1mod.png";
import buildIcon from "../assets/buildIcon.png";
import linkIcon from "../assets/linkIcon.png";
import chartIcon from "../assets/chartIcon.png";
import developerImage from "../assets/developer.png";
import headerBgImage from "../assets/brew-bg.png";

/*
  Description
*/
class Homepage extends Component {
  constructor(props) {
    super(props);

    const { history } = this.props;
    this.state = {
      activateShowcase: false,
      superMenu: false,
      plans: [{
        name: "Community",
        price: "Free",
        priceDetail: "forever",
        description: "No credit card required",
        primary: false,
        features: ["3 Charts", "1 Project", "1 Team member", "1 Datasource connection", "10MB Max query size"],
        onClick: () => {
          history.push({
            pathname: "/signup",
            search: "?plan=community",
          });
        }
      }, {
        name: "Basic",
        price: "$9",
        priceDetail: "per month",
        description: "Create more charts and connect multiple data sources",
        primary: true,
        features: ["10 Charts", "3 Project", "2 Team members", "5 Datasource connections", "30MB Max query size", "Auto-refresh every hour"],
        onClick: () => {
          history.push({
            pathname: "/signup",
            search: "?plan=basic",
          });
        }
      }, {
        name: "Pro",
        price: "$49",
        priceDetail: "per month",
        description: "More power, more amazing dashboards",
        primary: false,
        features: ["20 Charts per project", "10 projects", "5 Team members", "Unlimited datasource connections", "50MB Max query size", "Auto-refresh every 30 minutes"],
        onClick: () => {
          history.push({
            pathname: "/signup",
            search: "?plan=pro",
          });
        }
      }],
    };
  }

  componentDidMount() {
    this._activateShowcase();

    $crisp.push(["do", "chat:show"]);
    $crisp.push(["do", "chat:close"]);

    const script = document.createElement("script");
    script.src = "https://platform.twitter.com/widgets.js";
    script.async = true;

    document.getElementById("twitterRaz").appendChild(script);
  }

  _activateShowcase = () => {
    setTimeout(() => this.setState({ activateShowcase: true }), 500);
  }

  _screenUpdate = (e, { width }) => {
    if (width < 639) {
      this.setState({ mobile: true, collapseMenu: true });
    } else if (width < 1000) {
      this.setState({ collapseMenu: true });
    } else {
      this.setState({ mobile: false, collapseMenu: false });
    }
  }

  _onSubmitEmail = () => {
    const { addEmailToList } = this.props;
    const { email } = this.state;

    const emailCheck = /^[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,4}$/i.test(email);
    if (!emailCheck || !email) {
      this.setState({ emailError: true });
      return;
    }

    this.setState({ submitting: true, emailError: false, emailSuccess: false });
    addEmailToList(email)
      .then(() => {
        this.setState({ submitting: false, emailSuccess: true, email: "" });
      })
      .catch(() => {
        this.setState({ submitting: false, emailError: true });
      });
  }

  render() {
    const {
      activateShowcase, mobile, superMenu, emailError, email, submitting,
      emailSuccess, plans, collapseMenu,
    } = this.state;
    const { user } = this.props;

    return (
      <div style={styles.container}>
        <Menu
          fixed="top"
          inverted={!superMenu}
          borderless
          fluid
          size="small"
          style={!superMenu ? { backgroundColor: "transparent" } : {}}
        >
          {superMenu
            && (
            <Menu.Item as={AnchorLink} href="#top-segment">
              <img src={cbLogoSmall} alt="Chartbrew Logo" />
              {!mobile && <span style={styles.brewTitle}>Chartbrew</span>}
            </Menu.Item>
            )}
          {!superMenu
            && (
            <Menu.Item as={AnchorLink} href="#top-segment">
              <img src={cbLogoSmallInverted} alt="Chartbrew Logo" />
              {!mobile && <span style={styles.brewTitle}>Chartbrew</span>}
            </Menu.Item>
            )}
          <Menu.Item>
            <Popup
              trigger={
                <Label color="violet">beta</Label>
              }
              content="Chartbrew is in beta which means we are actively working on adding a lot of new features. We really appreciate your support and feedback at this stage to make Chartbrew an awesome product!"
            />
          </Menu.Item>
          <Menu.Item className="changelog-trigger" as="a">
            Updates
            <div className="changelog-badge" />
          </Menu.Item>
          {!collapseMenu && (
            <>
              {!user.id
                && (
                <Menu.Menu position="right" style={{ fontSize: "1.1em" }}>
                  <Menu.Item
                    as="a"
                    href="https://github.com/razvanilin/chartbrew"
                    target="_blank"
                    rel="noopener noreferrer"
                  >
                    <Icon name="github" />
                    View on GitHub
                  </Menu.Item>
                  <Menu.Item
                    as="a"
                    href="https://join.slack.com/t/chartbrew/shared_invite/enQtNzMzMzkzMTQ5MDc0LTlhYTE0N2E4ZDE5Y2MyNTMxZGExNTVjYjZmN2FjZjlhMTdhZTBjMGQ5MGQwYjEzMjkzNzg0ZjE2MzEwMThlMjQ"
                    target="_blank"
                    rel="noopener noreferrer"
                  >
                    <Icon name="slack" />
                    Join our Community
                  </Menu.Item>
                  <Menu.Item
                    as="a"
                    href="https://docs.chartbrew.com"
                    target="_blank"
                    rel="noopener noreferrer"
                  >
                    Documentation
                  </Menu.Item>
                  <Menu.Item as={AnchorLink} href="#pricing">
                    Pricing
                  </Menu.Item>
                  <Menu.Item as={Link} to="/signup">
                    Sign up
                  </Menu.Item>
                  <Menu.Item as={Link} to="/login">
                    Log in
                  </Menu.Item>
                </Menu.Menu>
                )}
              {user.id && (
                <Menu.Menu position="right" style={{ fontSize: "1.1em" }}>
                  <Menu.Item as={Link} to="/user">
                    Go to your dashboard
                  </Menu.Item>
                </Menu.Menu>
              )}
            </>
          )}
          {collapseMenu && (
            <Menu.Menu position="right" style={{ fontSize: "1.1em" }}>
              <Menu.Item>
                <Popup
                  content="Add users to your feed"
                  trigger={
                    <Icon inverted={!superMenu} size="large" name="bars" />
                  }
                  on="click"
                  position="bottom right"
                  flowing
                  size="large"
                  hideOnScroll
                >
                  <Menu vertical>
                    <Menu.Item
                      as="a"
                      href="https://github.com/razvanilin/chartbrew"
                      target="_blank"
                      rel="noopener noreferrer"
                    >
                      <Icon name="github" />
                      View on GitHub
                    </Menu.Item>
                    <Menu.Item
                      as="a"
                      href="https://join.slack.com/t/chartbrew/shared_invite/enQtNzMzMzkzMTQ5MDc0LTlhYTE0N2E4ZDE5Y2MyNTMxZGExNTVjYjZmN2FjZjlhMTdhZTBjMGQ5MGQwYjEzMjkzNzg0ZjE2MzEwMThlMjQ"
                      target="_blank"
                      rel="noopener noreferrer"
                    >
                      <Icon name="slack" />
                      Join our Community
                    </Menu.Item>
                    <Menu.Item
                      as="a"
                      href="https://docs.chartbrew.com"
                      target="_blank"
                      rel="noopener noreferrer"
                    >
                      <Icon name="book" />
                      Documentation
                    </Menu.Item>
                    <Menu.Item as={AnchorLink} href="#pricing">
                      <Icon name="dollar sign" />
                      Pricing
                    </Menu.Item>
                    <Menu.Item as={Link} to="/signup">
                      Sign up
                    </Menu.Item>
                    <Menu.Item as={Link} to="/login">
                      Log in
                    </Menu.Item>
                  </Menu>
                </Popup>
              </Menu.Item>
            </Menu.Menu>
          )}
        </Menu>

        <Segment inverted color="blue" style={styles.headerSegment} id="top-segment">
          <div style={styles.headerBg} />
          <Container text style={{ paddingTop: 100 }} textAlign="center">

            <Visibility
              continuous
              onTopPassed={() => this.setState({ superMenu: true })}
              onOnScreen={() => {
                this.setState({ superMenu: false });
              }}
              onTopVisible={() => this.setState({ superMenu: false })}
            >
              <Header inverted as="h1" style={styles.pageHeader}>
                Brew your own charts
                <Divider hidden />
                <Header.Subheader style={styles.mainSubheader}>
                  Open source app that generates charts from your data sources with no extra coding
                </Header.Subheader>
              </Header>
            </Visibility>
            <div style={styles.topBufferSm} />
            {!mobile && (
              <Button.Group widths="2">
                <Button secondary size="massive" icon labelPosition="left" as={Link} to="/signup">
                  <Icon name="cloud" />
                  Brew in cloud
                </Button>

                <Button basic inverted size="massive" icon labelPosition="right" as="a" href="https://github.com/razvanilin/chartbrew">
                  <Icon name="github" />
                  Run it locally
                </Button>
              </Button.Group>
            )}

            {mobile && (
              <>
                <Button secondary size="massive" icon labelPosition="right" as={Link} to="/signup">
                  <Icon name="cloud" />
                  Brew in cloud
                </Button>
                <div style={styles.topBufferSm} />
                <Button basic inverted size="massive" icon labelPosition="right" as="a" href="https://github.com/razvanilin/chartbrew">
                  <Icon name="github" />
                  Run it locally
                </Button>
              </>
            )}
          </Container>

          <div style={styles.topBufferSm} />
          <Divider hidden />

          <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 100 100" preserveAspectRatio="none" style={mobile ? styles.svgMobile : styles.svg}>
            <polygon className="svg--sm" fill="white" points="0,0 30,100 65,21 90,100 100,75 100,100 0,100" style={styles.firstPolygon} />
            <polygon className="svg--lg" fill="white" points="0,0 15,100 33,21 45,100 50,75 55,100 72,20 85,100 95,50 100,80 100,100 0,100" style={styles.secondPolygon} />
          </svg>
        </Segment>

        <div style={styles.demoContainer}>
          <Responsive
            as={Container}
            textAlign="center"
            fireOnMount
            onUpdate={this._screenUpdate}
            style={!mobile ? styles.negativeSpacing : { paddingBottom: 20 }}
          >
            <Segment
              raised
              compact
              style={
                activateShowcase && mobile ? styles.showcaseSegmentActiveMobile
                  : activateShowcase && !mobile
                    ? styles.showcaseSegmentActive : styles.showcaseSegment
              }
            >
              <Image
                size="huge"
                rounded
                src={showcase}
                alt="Chartbrew - how to visualize your data"
                style={styles.showcaseImage}
              />
            </Segment>
          </Responsive>
        </div>

        <div style={styles.firstContainer}>
          <Container fluid textAlign="center">
            <Header size="big" inverted style={styles.pageHeader}>
              Stop being a stranger to your data
              <Header.Subheader style={styles.pageSubheader}>
                {"Connect your datasource to ChartBrew and visualize your data in a few simple steps"}
              </Header.Subheader>
            </Header>
            <Divider hidden />

            <Container>
              <Card.Group stackable itemsPerRow={3} centered>
                <Card as={AnchorLink} href="#connect" raised link color="violet">
                  <Card.Content>
                    <Image src={linkIcon} style={{ paddingBottom: 20, maxHeight: 156 }} />
                    <Card.Header>Connect to your datasource</Card.Header>
                  </Card.Content>
                </Card>
                <Card as={AnchorLink} href="#build" raised link color="violet">
                  <Card.Content>
                    <Image src={buildIcon} style={{ paddingBottom: 20, maxHeight: 156 }} />
                    <Card.Header>Build your charts using our editor</Card.Header>
                  </Card.Content>
                </Card>
                <Card as={AnchorLink} href="#visualize" raised link color="violet">
                  <Card.Content>
                    <Image src={chartIcon} style={{ paddingBottom: 20, maxHeight: 156 }} />
                    <Card.Header>Visualize your data</Card.Header>
                  </Card.Content>
                </Card>
              </Card.Group>
            </Container>

            <Container text textAlign="center" style={{ paddingTop: 50 }}>
              <Header as="h1" inverted>Get updates about Chartbrew</Header>
              <Form stackable size="big">
                <Form.Field style={{ display: "inline-block" }} error={emailError}>
                  <Input
                    style={{ width: 300 }}
                    placeholder="Enter your email address"
                    value={email || ""}
                    onChange={(e, data) => this.setState({ email: data.value })}
                  />
                </Form.Field>
                <Form.Field>
                  <Button
                    primary
                    icon
                    labelPosition="right"
                    size="big"
                    loading={submitting}
                    onClick={this._onSubmitEmail}
                  >
                    {!emailSuccess && <Icon name="send" />}
                    {emailSuccess && <Icon name="checkmark" />}

                    {!emailSuccess && "Submit"}
                    {emailSuccess && "Thanks!"}
                  </Button>
                </Form.Field>
              </Form>
            </Container>
          </Container>

          <Container text textAlign="center" style={{ paddingTop: 50 }}>
            <Header as="h1" inverted>Made by humans</Header>
            <a href="https://twitter.com/Kate_Belakova?ref_src=twsrc%5Etfw" className="twitter-follow-button" data-size="large" data-show-count="false">Follow @Kate_Belakova</a>
            <span>{" "}</span>
            <a id="twitterRaz" href="https://twitter.com/razvanilin?ref_src=twsrc%5Etfw" className="twitter-follow-button" data-size="large" data-show-count="false">Follow @razvanilin</a>
          </Container>
        </div>

        <div
          id="connect"
          style={{
            position: "relative", minHeight: 300, overflow: "hidden", paddingBottom: 20
          }}
        >
          <div style={styles.connectDataContainer} />
          <Container fluid textAlign="center" style={{ position: "relative", paddingTop: 50 }}>
            <Header size="huge" inverted icon style={styles.pageTitle}>
              <Icon name="plug" />
              Connect to your datasource
              <Header.Subheader style={styles.pageSubheader}>
                Take a look at what we are currently supporting
              </Header.Subheader>
            </Header>
            <Divider hidden />

            <Grid columns={4} centered stackable>
              <Grid.Column width={3}>
                <Card centered color="blue" raised>
                  <Image src={mongo} />
                  <Card.Content>
                    <Card.Header textAlign="center">MongoDB</Card.Header>
                  </Card.Content>
                </Card>
              </Grid.Column>
              <Grid.Column width={3}>
                <Card centered color="blue" raised>
                  <Image src={api} />
                  <Card.Content>
                    <Card.Header textAlign="center">APIs</Card.Header>
                  </Card.Content>
                </Card>
              </Grid.Column>
              <Grid.Column width={3}>
                <Card centered color="blue" raised>
                  <Image src={postgres} />
                  <Card.Content>
                    <Card.Header textAlign="center">PostgreSQL</Card.Header>
                  </Card.Content>
                </Card>
              </Grid.Column>
              <Grid.Column width={3}>
                <Card centered color="blue" raised>
                  <Image src={mysql} />
                  <Card.Content>
                    <Card.Header textAlign="center">MySQL</Card.Header>
                  </Card.Content>
                </Card>
              </Grid.Column>
            </Grid>

            <Container style={{ paddingTop: 50 }}>
              <Header inverted as="h1">Supporting soon</Header>
              <Divider hidden />
              <Card.Group centered itemsPerRow={mobile ? 2 : 4}>
                <Card centered color="violet" raised style={mobile ? styles.upcomingCardsMobile : styles.upcomingCards}>
                  <Image src={firebase} />
                  <Card.Content>
                    <Card.Header>Firebase</Card.Header>
                  </Card.Content>
                </Card>
              </Card.Group>
              <div style={{ paddingTop: 30 }}>
                <Button
                  secondary
                  size="big"
                  icon
                  labelPosition="right"
                  as="a"
                  href="https://trello.com/b/IQ7eiDqZ/chartbrew-roadmap"
                  target="_blank"
                  rel="noopener noreferrer"
                >
                  <Icon name="road" />
                  Our roadmap
                </Button>
              </div>
            </Container>
          </Container>
        </div>

        <div id="build" style={{ position: "relative", minHeight: 300, overflow: "hidden" }}>
          <div style={styles.buildChartContainer} />
          <Container fluid textAlign="center" style={{ position: "relative", paddingTop: 100, marginBottom: 20 }}>
            <Header size="huge" inverted icon style={styles.pageTitle}>
              <Icon name="cogs" />
              Build your charts
              <Header.Subheader style={styles.pageSubheader}>
                Use our powerful editor to create any chart you want
              </Header.Subheader>
            </Header>
            <Divider hidden />

            <Grid centered stackable columns={2}>
              <Grid.Column width={8}>
                <Segment raised compact style={styles.imageSegment}>
                  <Image rounded src={chartsImage} />
                </Segment>
              </Grid.Column>
              <Grid.Column width={6} textAlign={mobile ? "center" : "left"} verticalAlign="middle">
                <Header size="huge" textAlign={mobile ? "center" : "left"} inverted>
                  Representing your data
                  <Header.Subheader style={{ fontSize: "0.6em" }}>
                    {"Choose from the multiple types of charts available to you. You can create timeseries, data type comparisons and much more. Your imagination is the limit."}
                  </Header.Subheader>
                </Header>
                <Button secondary size="big" icon labelPosition="right" as={Link} to="/signup">
                  <Icon name="cogs" />
                  Build your own
                </Button>
              </Grid.Column>
            </Grid>
          </Container>
        </div>

        <div id="visualize">
          <Container fluid textAlign="center" style={{ paddingTop: 50, marginBottom: 20 }}>
            <Header size="huge" inverted icon style={styles.pageTitle}>
              <Icon name="line chart" />
              Visualize your data
              <Header.Subheader style={styles.pageSubheader}>
                Manage your own dashboard containing all the charts
              </Header.Subheader>
            </Header>
            <Divider hidden />

            <Grid centered columns={2} stackable>
              <Grid.Row>
                <Grid.Column width={8}>
                  <Segment raised compact style={styles.imageSegment}>
                    <Image rounded src={dashboardImage} />
                  </Segment>
                </Grid.Column>
                <Grid.Column width={6} verticalAlign="middle" textAlign={mobile ? "center" : "left"}>
                  <Header size="huge" textAlign={mobile ? "center" : "left"} inverted>
                    {"Customize your dashboard"}
                    <Header.Subheader style={{ fontSize: "0.6em" }}>
                      {"You can resize and order the charts to your liking. You and your team can now watch as your data evolves and get useful insights using different chart types."}
                    </Header.Subheader>
                  </Header>
                  <Button secondary size="big" icon labelPosition="right" as={Link} to="/signup">
                    <Icon name="line chart" />
                    Create your dashboard
                  </Button>
                </Grid.Column>
              </Grid.Row>
              <Grid.Row>
                <Divider hidden />
              </Grid.Row>
              <Grid.Row style={{ paddingBottom: 50 }}>
                <Grid.Column width={6} verticalAlign="middle" textAlign={mobile ? "center" : "left"}>
                  <Header size="huge" textAlign={mobile ? "center" : "left"} inverted>
                    {"Share your charts with the world"}
                    <Header.Subheader style={{ fontSize: "0.6em" }}>
                      {"You can easily mark charts as public and share your unique dashboard link with the world. Your followers can stay up-to-date with your metrics if you're planning on building an open product."}
                    </Header.Subheader>
                  </Header>
                  <Button size="big" secondary as={Link} to="/b/Humminz_1" icon labelPosition="right">
                    <Icon name="globe" />
                    Public dashboard demo
                  </Button>
                </Grid.Column>
                <Grid.Column width={8}>
                  <Segment raised compact style={styles.imageSegment}>
                    <Image rounded src={publicImage} />
                  </Segment>
                </Grid.Column>
              </Grid.Row>
            </Grid>
          </Container>
        </div>

        <div style={styles.teamContainer}>
          <Container fluid style={{ paddingTop: 50, paddingBottom: 50 }}>
            <Header textAlign="center" size="huge" inverted icon style={styles.pageTitle}>
              <Icon name="users" />
              {"Collaborate with your team"}
              <Header.Subheader style={styles.pageSubheader}>
                {"Manage your team and permissions and create charts together"}
              </Header.Subheader>
            </Header>

            <Container text>
              <Segment raised compact style={styles.illustrationSegment}>
                <Image rounded src={teamImage} />
              </Segment>
            </Container>
          </Container>
        </div>

        <div style={styles.thirdContainer}>
          <Container fluid>
            <Header textAlign="center" size="huge" inverted icon style={styles.pageTitle}>
              <Icon name="lock" />
              Your data and connections are fully secured
              <Header.Subheader style={styles.pageSubheader}>
                {"We don't store any data other than what's needed for the charts"}
              </Header.Subheader>
            </Header>
            <Grid centered columns={3} stackable padded>
              <Grid.Column width={6}>
                <Segment raised compact style={styles.illustrationSegment}>
                  <Image size="large" rounded src={securityImage} />
                </Segment>
              </Grid.Column>

              <Grid.Column width={1} />

              <Grid.Column verticalAlign="middle" width={5}>
                <Container textAlign="left">
                  <Header inverted>
                    {"Your database connection configuration is fully secured and encrypted on our server. We also advise all our users to connect to their databases with a read-only account to mitigate risks."}
                  </Header>
                  <Header inverted>
                    {"We store only the minimal data on our servers. The data is used to generate the chart configuration which doesn't necessarily hold sensitive information unless you want to specifically include sensitive information to be visible on the charts."}
                  </Header>
                  <Header inverted>
                    {"Alternatively, run ChartBrew on your servers for free and own the entire data. Check out our repo below."}
                  </Header>
                  <Button basic inverted icon size="big" labelPosition="right" as="a" href="https://github.com/razvanilin/chartbrew">
                    <Icon name="github" />
                    Run it locally
                  </Button>
                </Container>
              </Grid.Column>
            </Grid>
          </Container>
        </div>

        <div style={styles.pricingContainer} id="pricing">
          <Container>
            <Container style={{ paddingTop: 50, paddingBottom: 60 }}>
              <Header inverted textAlign="center" style={styles.pageTitle}>
                Pick the plan that suits your goals
                <Header.Subheader style={styles.pageSubheader}>
                  Applicable to ChartBrew Cloud only
                </Header.Subheader>
              </Header>
            </Container>
            <Segment color="olive" raised>
              <PricingPlans plans={plans} />
            </Segment>
          </Container>

          <Container text style={{ paddingTop: 20 }}>
            <Segment color="olive" raised>
              <Grid columns={2} centered stackable padded celled="internally">
                <Grid.Column textAlign="center" width={8}>
                  <Header as="h1">
                    $5
                    <Header.Subheader>per aditional member</Header.Subheader>
                  </Header>
                  <Header>On all paid plans</Header>
                </Grid.Column>
                <Grid.Column textAlign="center" width={8}>
                  <Header as="h1">
                    Need a different plan?
                  </Header>
                  <Button secondary icon labelPosition="right" as="a" href="mailto:info@depomo.com">
                    <Icon name="mail" />
                    Get in touch
                  </Button>
                </Grid.Column>
              </Grid>
            </Segment>
          </Container>

          <Container text textAlign="center" style={{ paddingTop: 100 }}>
            <Header inverted textAlign="center" style={styles.pageTitle}>
              ChartBrew is open source
              <Header.Subheader style={styles.pageSubheader}>
                The codebase is available to everybody, you can run it yourself for free
              </Header.Subheader>
            </Header>
            <Button basic inverted size="massive" icon labelPosition="right" as="a" href="https://github.com/razvanilin/chartbrew">
              <Icon name="github" />
              ChartBrew repo
            </Button>
          </Container>
        </div>

        <div style={styles.fifthContainer}>
          <Container fluid textAlign="center">
            <Image centered src={developerImage} />
            <Header textAlign="center" size="huge" inverted icon style={styles.pageTitle}>
              {"Now let's brew some charts"}
            </Header>
            {!mobile && (
              <Container text>
                <Button.Group widths="2">
                  <Button secondary size="massive" icon labelPosition="left" as={Link} to="/signup">
                    <Icon name="cloud" />
                    Brew in cloud
                  </Button>

                  <Button basic inverted size="massive" icon labelPosition="right" as="a" href="https://github.com/razvanilin/chartbrew">
                    <Icon name="github" />
                    Run it locally
                  </Button>
                </Button.Group>
              </Container>
            )}

            {mobile && (
              <>
                <Button secondary size="massive" icon labelPosition="right" as={Link} to="/signup">
                  <Icon name="cloud" />
                  Brew in cloud
                </Button>
                <div style={styles.topBufferSm} />
                <Button basic inverted size="massive" icon labelPosition="right" as="a" href="https://github.com/razvanilin/chartbrew">
                  <Icon name="github" />
                  Run it locally
                </Button>
              </>
            )}
          </Container>
        </div>

        <div style={styles.footer}>
          <Container textAlign="center" style={styles.footer}>
            <Menu text inverted vertical={mobile} style={mobile ? { display: "inline" } : {}}>
              <Menu.Item
                as="a"
                href="https://depomo.com"
                target="_blank"
                rel="noopener noreferrer"
              >
                {`© Depomo ${moment().format("YYYY")}`}
              </Menu.Item>
              <Menu.Menu position="right">
                <Menu.Item
                  as="a"
                  href="https://github.com/razvanilin/chartbrew"
                  target="_blank"
                  rel="noopener noreferrer"
                >
                  Open-source
                </Menu.Item>
                <Menu.Item
                  as="a"
                  href="https://join.slack.com/t/chartbrew/shared_invite/enQtNzMzMzkzMTQ5MDc0LTlhYTE0N2E4ZDE5Y2MyNTMxZGExNTVjYjZmN2FjZjlhMTdhZTBjMGQ5MGQwYjEzMjkzNzg0ZjE2MzEwMThlMjQ"
                  target="_blank"
                  rel="noopener noreferrer"
                >
                  Community
                </Menu.Item>
                <Menu.Item
                  as="a"
                  href="https://github.com/razvanilin/chartbrew-docs/blob/master/TermsAndConditions.md"
                  target="_blank"
                  rel="noopener noreferrer"
                >
                  Terms & Conditions
                </Menu.Item>
                <Menu.Item
                  as="a"
                  href="https://github.com/razvanilin/chartbrew-docs/blob/master/PrivacyPolicy.md"
                  target="_blank"
                  rel="noopener noreferrer"
                >
                  Privacy Policy
                </Menu.Item>
              </Menu.Menu>
            </Menu>
          </Container>
        </div>
      </div>
    );
  }
}
const styles = {
  container: {
    flex: 1,
    backgroundColor: primary,
  },
  headerBg: {
    position: "absolute",
    top: 0,
    bottom: 0,
    right: 0,
    left: 0,
    width: "100%",
    height: "100%",
    background: `url(${headerBgImage}) repeat`,
    backgroundSize: "40%",
    opacity: 0.1,
    pointerEvents: "none",
  },
  svg: {
    position: "absolute",
    left: 0,
    bottom: -1,
    width: "101%",
    height: 150,
  },
  svgMobile: {
    position: "absolute",
    left: 0,
    bottom: 0,
    width: "100%",
    height: 50,
  },
  firstPolygon: {
    fill: teal,
  },
  secondPolygon: {
    fill: secondary,
  },
  negativeSpacing: {
    marginBottom: -100,
  },
  demoContainer: {
    width: "100%",
    backgroundColor: secondary,
  },
  showcaseSegment: {
    opacity: 0,
    padding: 0,
    border: "none",
    top: 0,
    textAlign: "center",
    display: "inline-block",
  },
  showcaseSegmentActive: {
    opacity: 1,
    padding: 0,
    border: "none",
    top: -150,
    textAlign: "center",
    display: "inline-block",
    transition: "all 1s",
  },
  showcaseSegmentActiveMobile: {
    opacity: 1,
    padding: 0,
    border: "none",
    // top: -100,
    textAlign: "center",
    display: "inline-block",
    transition: "all 1s",
  },
  pageHeader: {
    paddingBottom: 20,
    fontWeight: 600,
    fontSize: "3.5em",
  },
  pageTitle: {
    fontWeight: 600,
    fontSize: "3em",
  },
  mainSubheader: {
    fontSize: "0.4em",
  },
  pageSubheader: {
    fontSize: "0.5em",
  },
  showcaseImage: {
    boxShadow: "0px 0px 20px black",
  },
  headerSegment: {
    background: `linear-gradient(${blue}, ${primary} 100%)`,
    minHeight: 550,
    marginTop: 0,
    marginBottom: 0,
  },
  firstContainer: {
    margin: 0,
    paddingBottom: 70,
    minHeight: 400,
    backgroundImage: `linear-gradient(${secondary}, #cf6b4e)`,
    borderBottomLeftRadius: "80% 10%",
    borderBottomRightRadius: "80% 10%",
  },
  connectDataContainer: {
    position: "absolute",
    top: 0,
    bottom: 0,
    right: 0,
    left: 0,
    width: "100%",
    height: "100%",
    backgroundImage: `linear-gradient(-170deg, ${primary} 40%, ${blue} )`,
    transform: "skewY(-5deg)",
    transformOrigin: "top left 0px",
  },
  buildChartContainer: {
    position: "absolute",
    top: 0,
    bottom: 0,
    right: 0,
    left: 0,
    width: "100%",
    height: "100%",
    backgroundImage: `linear-gradient(${primary} 20%, ${blue} 200%)`,
    transform: "skewY(5deg)",
    transformOrigin: "bottom right",
  },
  teamContainer: {
    backgroundImage: `linear-gradient(${secondary}, ${primary})`,
  },
  secondContainer: {
    margin: 0,
    paddingTop: 50,
    paddingBottom: 50,
    minHeight: 400,
    backgroundColor: primary,
  },
  thirdContainer: {
    paddingTop: 50,
    paddingBottom: 50,
    minHeight: 400,
    background: `linear-gradient(${secondary}, #cf6b4e)`,
    // backgroundColor: secondary,
    borderTopLeftRadius: "80% 10%",
    borderTopRightRadius: "80% 10%",
  },
  pricingContainer: {
    paddingTop: 50,
    paddingBottom: 100,
    minHeight: 400,
    background: `linear-gradient(${teal}, ${primary})`,
    // backgroundColor: teal,
  },
  fourthContainer: {
    paddingTop: 50,
    paddingBottom: 50,
    minHeight: 400,
    background: `linear-gradient(${secondary}, ${blue})`,
    // backgroundColor: primary,
  },
  fifthContainer: {
    paddingTop: 100,
    paddingBottom: 100,
    minHeight: 200,
    backgroundColor: blue,
  },
  footer: {
    backgroundColor: blue,
    padding: 10,
  },
  stepContainer: {
    paddingTop: 50,
  },
  imageSegment: {
    padding: 0,
    border: "none",
  },
  illustrationSegment: {
    backgroundColor: "transparent",
    padding: 0,
    border: "none",
    boxShadow: "none",
  },
  developerPricing: {
    boxShadow: "0 2px 4px 0 rgba(34,36,38,.12), 0 2px 10px 0 rgba(34,36,38,.15)",
    backgroundColor: "white",
    marginTop: "-50px",
    borderRadius: 5,
  },
  developerPricingMobile: {
    boxShadow: "0 2px 4px 0 rgba(34,36,38,.12), 0 2px 10px 0 rgba(34,36,38,.15)",
    backgroundColor: "white",
  },
  brewTitle: {
    paddingLeft: 10,
    fontSize: "1.3em",
  },
  upcomingCards: {
    backgroundColor: lightGray,
  },
  upcomingCardsMobile: {
    backgroundColor: lightGray,
  },
  topBufferSm: {
    marginTop: 25,
  },
};

Homepage.propTypes = {
  history: PropTypes.object.isRequired,
  user: PropTypes.object.isRequired,
  addEmailToList: PropTypes.func.isRequired,
};

const mapStateToProps = (state) => {
  return {
    user: state.user.data,
  };
};

const mapDispatchToProps = (dispatch) => {
  return {
    addEmailToList: (email) => dispatch(addEmailToList(email)),
  };
};

export default connect(mapStateToProps, mapDispatchToProps)(Homepage);
