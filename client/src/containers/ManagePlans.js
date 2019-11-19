import React, { Component } from "react";
import PropTypes from "prop-types";
import { connect } from "react-redux";
import { withRouter } from "react-router";
import {
  Message, Segment, Header, Dimmer, Loader, Grid,
  Modal, Button, Icon, List, Divider,
} from "semantic-ui-react";
import moment from "moment";

import PricingPlans from "../components/PricingPlans";
import { getTeamPlan as getTeamPlanAction } from "../actions/team";
import {
  removeSubscription as removeSubscriptionAction,
  updateSubscription as updateSubscriptionAction,
} from "../actions/stripe";
import AddStripeSource from "../components/AddStripeSource";

/*
  Login container with an embedded login form
*/
class ManagePlans extends Component {
  constructor(props) {
    super(props);

    this.state = {
      allPlans: [{
        id: 1,
        name: "Community",
        price: "Free",
        priceDetail: "forever",
        description: "This will remove your subscription",
        primary: false,
        features: ["3 Charts", "1 Project", "1 Team member", "1 Datasource connection", "10MB Max query size"],
        buttonText: "Change plan",
        onClick: () => {
          this.setState({ freeModal: true, selectedPlan: 1 });
        }
      }, {
        id: 2,
        name: "Basic",
        price: "$9",
        priceDetail: "per month",
        description: "Create more charts and connect multiple data sources",
        primary: false,
        features: ["10 Charts", "3 Project", "2 Team members", "5 Datasource connections", "30MB Max query size", "Auto-refresh every hour"],
        buttonText: "Change plan",
        onClick: () => {
          if (this.state.currentPlan.id > 2) { // eslint-disable-line
            this.setState({ downgradeModal: true, selectedPlan: 2 });
          } else {
            this.setState({ upgradeModal: true, selectedPlan: 2 });
          }
        },
      }, {
        id: 3,
        name: "Pro",
        price: "$49",
        priceDetail: "per month",
        description: "More power, more amazing dashboards",
        primary: false,
        features: ["20 Charts per project", "10 projects", "5 Team members", "Unlimited datasource connections", "50MB Max query size", "Auto-refresh every 30 minutes"],
        buttonText: "Change plan",
        onClick: () => {
          this.setState({ upgradeModal: true, selectedPlan: 3 });
        },
      }],
    };
  }

  componentDidMount() {
    this._prepareComponentData();
  }

  _prepareComponentData = () => {
    const { getTeamPlan, match } = this.props;
    const { allPlans } = this.state;

    this.setState({ loading: true, error: false, modalLoading: false });
    getTeamPlan(match.params.teamId)
      .then((subscription) => {
        const { plan } = subscription;

        let currentPlan = allPlans[0];
        const availablePlans = [];
        for (let i = 0; i < allPlans.length; i++) {
          if (subscription.status === "canceled") {
            if (i > 0) {
              availablePlans.push(allPlans[i]);
            }
          } else if (allPlans[i].name.toLowerCase() !== plan.nickname.toLowerCase()) { // eslint-disable-line
            availablePlans.push(allPlans[i]);
          } else {
            currentPlan = allPlans[i];
          }
        }

        this.setState({
          currentPlan,
          availablePlans,
          loading: false,
          selectedPlan: currentPlan.id,
          subCanceled: subscription.status === "canceled" ? moment(subscription.current_period_end, "X").format("LLL") : null,
        });
      })
      .catch(() => {
        this.setState({ error: true, loading: false });
      });
  }

  _updateSubscription = () => {
    const { updateSubscription } = this.props;
    const { allPlans, selectedPlan } = this.state;

    this.setState({
      modalLoading: true,
      error: false,
      connectionError: false,
      projectError: false,
      chartError: false,
      memberError: false,
    });

    updateSubscription(allPlans[selectedPlan - 1].name)
      .then((subscription) => {
        // check if the object is customer (which means there's no payment method)
        if (subscription.object === "customer") {
          this.setState({ payModal: true, upgradeModal: false });
          return;
        }

        this._prepareComponentData();
        this.setState({ modalLoading: false, downgradeModal: false, upgradeModal: false });
      })
      .catch((error) => {
        if (error.message && error.message.indexOf("404") > -1) {
          this.setState({ payModal: true, upgradeModal: false });
          return;
        }

        let connectionError = false;
        let chartError = false;
        let projectError = false;
        let memberError = false;
        if (error === "connection") {
          connectionError = true;
        }
        if (error === "chart") {
          chartError = true;
        }
        if (error === "project") {
          projectError = true;
        }
        if (error === "member") {
          memberError = true;
        }

        this.setState({
          modalLoading: false,
          downgradeModal: false,
          upgradeModal: false,
          connectionError,
          chartError,
          projectError,
          memberError,
          error: true,
        });
      });
  }

  _removeSubscription = () => {
    const { removeSubscription } = this.props;

    this.setState({
      modalLoading: true,
      error: false,
      connectionError: false,
      projectError: false,
      chartError: false,
      memberError: false,
    });

    removeSubscription()
      .then(() => {
        this._prepareComponentData();
        this.setState({ modalLoading: false, freeModal: false });
      })
      .catch((error) => {
        let connectionError = false;
        let chartError = false;
        let projectError = false;
        let memberError = false;
        if (error === "connection") {
          connectionError = true;
        }
        if (error === "chart") {
          chartError = true;
        }
        if (error === "project") {
          projectError = true;
        }
        if (error === "member") {
          memberError = true;
        }

        this.setState({
          modalLoading: false,
          freeModal: false,
          connectionError,
          chartError,
          projectError,
          memberError,
          error: true,
        });
      });
  }

  _onSubscribed = () => {
    this.setState({ payModal: false });
    this._prepareComponentData();
  }

  render() {
    const {
      loading, currentPlan, availablePlans, allPlans, selectedPlan, error, subCanceled,
      connectionError, projectError, chartError, memberError, upgradeModal,
      modalLoading, downgradeModal, freeModal, payModal,
    } = this.state;
    const { team, style } = this.props;

    if (loading || !allPlans || !selectedPlan || !team.id) {
      return (
        <Segment style={styles.container}>
          <Dimmer inverted active={loading}>
            <Loader />
          </Dimmer>
        </Segment>
      );
    }

    return (
      <div style={style}>
        <div style={styles.container}>
          {error && !connectionError && !projectError && !chartError
            && (
            <Message negative>
              <Message.Header>Uh oh, there was a problem with the request.</Message.Header>
              <p>{"Try refreshing the page and if the problem persist, get in touch with us and we'll help you out."}</p>
            </Message>
            )}
          {connectionError
            && (
            <Message negative>
              <Message.Header>{"The number of database connections exceeds the new plan"}</Message.Header>
              <p>{"In order to be able to downgrade your plan, you must delete some database connections so that it doesn't exceed the maximum number allowed by the new plan."}</p>
            </Message>
            )}
          {chartError
            && (
            <Message negative>
              <Message.Header>{"The number of charts exceeds the new plan"}</Message.Header>
              <p>{"In order to be able to downgrade your plan, you must delete some charts so that it doesn't exceed the maximum number allowed by the new plan."}</p>
            </Message>
            )}
          {projectError
            && (
            <Message negative>
              <Message.Header>{"The number of projects exceeds the new plan"}</Message.Header>
              <p>{"In order to be able to downgrade your plan, you must delete some projects so that it doesn't exceed the maximum number allowed by the new plan."}</p>
            </Message>
            )}
          {memberError
            && (
            <Message negative>
              <Message.Header>{"Please remove any other team members before switching to the free plan"}</Message.Header>
              <p>{"The free plan does not include the ability to collaborate with other team members. Remove all the other team members before proceeding."}</p>
            </Message>
            )}
          {!!subCanceled
            && (
            <Message warning>
              <Message.Header>{"Your subscription was canceled. You won't be charged again"}</Message.Header>
              <p>
                You are still able to take advantage of the extra features until
                {subCanceled}
              </p>
            </Message>
            )}
          {currentPlan
            && (
            <div style={{ paddingBottom: 20 }}>
              <Header attached="top" as="h3">Current plan</Header>
              <Segment attached raised>
                <Grid relaxed column={3} centered celled="internally">
                  <Grid.Column textAlign="center" verticalAlign="middle" width={5}>
                    <Header sub>{currentPlan.name}</Header>
                    <Header size="huge">
                      {currentPlan.price}
                      <Header.Subheader>{currentPlan.priceDetail}</Header.Subheader>
                    </Header>
                  </Grid.Column>
                  <Grid.Column textAlign="center" verticalAlign="middle" width={5}>
                    <Header>Team size</Header>
                    <Header size="huge">
                      {team.TeamRoles.length}
                      <Header.Subheader>team members</Header.Subheader>
                    </Header>
                  </Grid.Column>
                  <Grid.Column textAlign="left" verticalAlign="middle" width={5}>
                    <List animated relaxed verticalAlign="middle">
                      {currentPlan.features.map((feature) => {
                        return (
                          <List.Item key={feature}>
                            <Icon name="checkmark" color="olive" />
                            <List.Content>
                              <List.Header>
                                {feature}
                              </List.Header>
                            </List.Content>
                          </List.Item>
                        );
                      })}
                    </List>
                  </Grid.Column>
                </Grid>
              </Segment>
            </div>
            )}
          {availablePlans
            && (
            <div>
              <Header attached="top" as="h3">Change your plan</Header>
              <Segment attached raised>
                {!!subCanceled
                  && (
                  <Message>
                    <Message.Header>{"If you activate your subscription now, you will be charged again"}</Message.Header>
                    {`Your subscription is still active until ${subCanceled}`}
                  </Message>
                  )}
                <PricingPlans plans={availablePlans} celled />
              </Segment>
            </div>
            )}

          {/* UPGRADE MODAL */}
          <Modal
            open={upgradeModal}
            size="small"
            onClose={() => this.setState({ upgradeModal: false })}
          >
            <Modal.Header>
              Upgrading to the
              {" "}
              {allPlans[selectedPlan - 1].name}
              {" "}
              plan?
            </Modal.Header>
            <Modal.Content>
              <p>{"Awesome to hear that! You will get access to all the extra features immediately."}</p>
              <List animated relaxed verticalAlign="middle">
                {allPlans[selectedPlan - 1].features.map((feature) => {
                  return (
                    <List.Item key={feature}>
                      <Icon name="checkmark" color="olive" />
                      <List.Content>
                        <List.Header>
                          {feature}
                        </List.Header>
                      </List.Content>
                    </List.Item>
                  );
                })}
              </List>
            </Modal.Content>
            <Modal.Actions>
              <Button
                onClick={() => this.setState({ upgradeModal: false })}
              >
                Cancel
              </Button>
              <Button
                positive
                icon
                labelPosition="right"
                loading={modalLoading}
                onClick={this._updateSubscription}
              >
                <Icon name="angle double up" />
                Upgrade
              </Button>
            </Modal.Actions>
          </Modal>

          {/* DOWNGRADE MODAL */}
          <Modal
            open={downgradeModal}
            size="small"
            onClose={() => this.setState({ downgradeModal: false })}
          >
            <Modal.Header>
              Are you sure you want to downgrade to the
              {" "}
              {allPlans[selectedPlan - 1].name}
              {" "}
              plan?
            </Modal.Header>
            <Modal.Content>
              <p>{"Downgrading your plan will cap your usage on projects, charts, connections and more."}</p>
              <Message negative>
                <p>{"Please note that you will not be able to downgrade the plan if you exceed the usage of the new plan."}</p>
              </Message>
            </Modal.Content>
            <Modal.Actions>
              <Button
                onClick={() => this.setState({ downgradeModal: false })}
              >
                Cancel
              </Button>
              <Button
                negative
                icon
                labelPosition="right"
                loading={modalLoading}
                onClick={this._updateSubscription}
              >
                <Icon name="angle double down" />
                Downgrade
              </Button>
            </Modal.Actions>
          </Modal>

          {/* FREE MODAL */}
          <Modal
            open={freeModal}
            size="small"
            onClose={() => this.setState({ freeModal: false })}
          >
            <Modal.Header>
              Are you sure you want to switch to the
              {" "}
              {allPlans[selectedPlan - 1].name}
              {" "}
              plan?
            </Modal.Header>
            <Modal.Content>
              <p>{"Downgrading your plan will cap your usage on projects, charts, connections and more."}</p>
              <p>{"After downgrading to our free plan, you won't be charged anymore and your subscription will be removed."}</p>
              <Message negative>
                <p>{"Please note that you will not be able to downgrade the plan if you exceed the usage of the new plan."}</p>
              </Message>
            </Modal.Content>
            <Modal.Actions>
              <Button
                onClick={() => this.setState({ freeModal: false })}
              >
                Cancel
              </Button>
              <Button
                negative
                icon
                labelPosition="right"
                loading={modalLoading}
                onClick={this._removeSubscription}
              >
                <Icon name="angle double down" />
                Downgrade
              </Button>
            </Modal.Actions>
          </Modal>

          {/* PAYMENT MODAL */}
          <Modal
            open={payModal}
            size="small"
            onClose={() => this.setState({ payModal: false })}
          >
            <Modal.Header>
              Subscribe to the
              {" "}
              {allPlans[selectedPlan - 1].name}
              {" "}
              plan
            </Modal.Header>
            <Modal.Content>
              <Header textAlign="center" size="large">
                {allPlans[selectedPlan - 1].price}
                <Header.Subheader>{allPlans[selectedPlan - 1].priceDetail}</Header.Subheader>
              </Header>
              <Divider section />
              <label>Secured payment through Stripe</label>
              <AddStripeSource
                charge
                plan={allPlans[selectedPlan - 1].name}
                onComplete={() => this._onSubscribed()}
              />
            </Modal.Content>
            <Modal.Actions>
              <Button
                onClick={() => this.setState({ payModal: false })}
              >
                Cancel
              </Button>
            </Modal.Actions>
          </Modal>
        </div>
      </div>
    );
  }
}
const styles = {
  container: {
    flex: 1,
    minHeight: 50,
  },
};

ManagePlans.defaultProps = {
  style: {}
};

ManagePlans.propTypes = {
  match: PropTypes.object.isRequired,
  getTeamPlan: PropTypes.func.isRequired,
  team: PropTypes.object.isRequired,
  style: PropTypes.object,
  removeSubscription: PropTypes.func.isRequired,
  updateSubscription: PropTypes.func.isRequired,
};

const mapStateToProps = (state) => {
  return {
    team: state.team.active,
  };
};

const mapDispatchToProps = (dispatch) => {
  return {
    getTeamPlan: (teamId) => dispatch(getTeamPlanAction(teamId)),
    removeSubscription: () => dispatch(removeSubscriptionAction()),
    updateSubscription: (plan) => dispatch(updateSubscriptionAction(plan)),
  };
};

export default withRouter(connect(mapStateToProps, mapDispatchToProps)(ManagePlans));
