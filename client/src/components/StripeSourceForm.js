import React, { Component } from "react";
import PropTypes from "prop-types";
import { connect } from "react-redux";
import { CardElement, injectStripe } from "react-stripe-elements";
import { Button, Container, Message } from "semantic-ui-react";

import { addSource, subscribeToPlan } from "../actions/stripe";
/*
  Description
*/
class StripeSourceForm extends Component {
  constructor(props) {
    super(props);
    this.state = {
      loading: false
    };
    this.submit = this.submit.bind(this);
  }

  submit() {
    const {
      stripe, addSource, subscribeToPlan, onComplete, user, charge, plan
    } = this.props;
    this.setState({ loading: true, error: false, success: false });

    stripe.createToken({ name: user.name })
      .then(({ token }) => {
        return addSource(token.id);
      })
      .then((source) => {
        if (charge) {
          return subscribeToPlan(plan);
        }

        return new Promise(resolve => resolve(source));
      })
      .then(() => {
        this.setState({ loading: false, success: true });
        onComplete();
      })
      .catch(() => {
        this.setState({ loading: false, error: true });
      });
  }

  render() {
    const { loading, error, success } = this.state;
    const { charge } = this.props;
    return (
      <div className="checkout" style={styles.container}>
        <Container>
          <CardElement />
          <br />
          <Button primary={!success} color={success ? "green" : null} onClick={this.submit} loading={loading}>
            {(!success && charge) && "Subscribe"}
            {(!success && !charge) && "Save card"}
            {success && "Done"}
          </Button>

          {error
            && (
            <Message negative>
              <Message.Header>Oups! There was an error with your request</Message.Header>
              <p>{"Please try again or use another card. Use the chat function to get in touch with us if the problem persists."}</p>
            </Message>
            )}
        </Container>
      </div>
    );
  }
}

const styles = {
  container: {
    flex: 1,
  },
};

StripeSourceForm.defaultProps = {
  charge: false,
  plan: "",
  onComplete: () => {},
};

StripeSourceForm.propTypes = {
  charge: PropTypes.bool,
  plan: PropTypes.string,
  user: PropTypes.object.isRequired,
  stripe: PropTypes.object.isRequired,
  addSource: PropTypes.func.isRequired,
  subscribeToPlan: PropTypes.func.isRequired,
  onComplete: PropTypes.func,
};

const mapStateToProps = (state) => {
  return {
    user: state.user.data,
  };
};

const mapDispatchToProps = (dispatch) => {
  return {
    addSource: (tokenId) => dispatch(addSource(tokenId)),
    subscribeToPlan: (plan) => dispatch(subscribeToPlan(plan)),
  };
};

export default injectStripe(connect(mapStateToProps, mapDispatchToProps)(StripeSourceForm));
