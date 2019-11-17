import React, { Component } from "react";
import PropTypes from "prop-types";
import {
  Grid, Button, Header, List, Icon, Responsive,
  Container, Divider,
} from "semantic-ui-react";

/*
  Displays the pricing plans depending on the configuration
*/
class PricingPlans extends Component {
  constructor(props) {
    super(props);
    this.state = {
      mobile: false,
    };
  }

  _screenUpdate = (e, { width }) => {
    if (width < 639) {
      this.setState({ mobile: true });
    } else {
      this.setState({ mobile: false });
    }
  }

  render() {
    const { mobile } = this.state;
    const { plans, celled } = this.props;

    return (
      <Responsive
        as="div"
        fireOnMount
        onUpdate={this._screenUpdate}
      >
        <Grid centered columns={plans ? plans.length : 1} stackable padded celled={mobile || celled ? "internally" : false}>
          {plans && plans.map((plan) => {
            return (
              <Grid.Column
                key={plan.name}
                textAlign="center"
                width={plans.length > 3 ? 4 : plans.length === 3 ? 5 : 7}
                style={
                  mobile && plan.primary ? styles.highlightPricingMobile
                    : !mobile && plan.primary ? styles.highlightPricing : {}
                }
              >
                <Container>
                  <div style={{ height: 300 }}>
                    <Header sub style={{ paddingBottom: 30 }}>{plan.name}</Header>
                    <Header style={styles.pageTitle}>
                      {plan.price}
                      <Header.Subheader>{plan.priceDetail}</Header.Subheader>
                    </Header>
                    <Header>{plan.description}</Header>
                  </div>
                  <Button size="large" primary basic={!plan.primary} icon labelPosition="right" onClick={plan.onClick}>
                    <Icon name="play" />
                    {plan.buttonText || "Get started now"}
                  </Button>
                  <Divider />

                  <Header textAlign="left">Features</Header>
                  <List animated relaxed verticalAlign="middle">
                    {plan.features.map((feature) => {
                      return (
                        <List.Item key={feature}>
                          <Icon name="checkmark" color="olive" />
                          <List.Content style={styles.listContent}>
                            <List.Header>
                              {feature}
                            </List.Header>
                          </List.Content>
                        </List.Item>
                      );
                    })}
                  </List>
                </Container>
              </Grid.Column>
            );
          })}
        </Grid>
      </Responsive>
    );
  }
}

const styles = {
  highlightPricing: {
    boxShadow: "0 2px 4px 0 rgba(34,36,38,.12), 0 2px 10px 0 rgba(34,36,38,.15)",
    backgroundColor: "white",
    marginTop: "-50px",
    borderRadius: 5,
  },
  highlightPricingMobile: {
    boxShadow: "0 2px 4px 0 rgba(34,36,38,.12), 0 2px 10px 0 rgba(34,36,38,.15)",
    backgroundColor: "white",
  },
  pageTitle: {
    fontWeight: 600,
    fontSize: "3em",
  },
  listContent: {
    textAlign: "left",
  },
};

PricingPlans.defaultProps = {
  celled: false,
};

PricingPlans.propTypes = {
  plans: PropTypes.array.isRequired,
  celled: PropTypes.bool,
};

export default PricingPlans;
