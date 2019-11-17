import React, { Component } from "react";
import PropTypes from "prop-types";
import { connect } from "react-redux";
import { Elements, StripeProvider } from "react-stripe-elements";

import StripeSourceForm from "./StripeSourceForm";
import { STRIPE_API_KEY } from "../config/settings";
/*
  Description
*/
class AddStripeSource extends Component {
  _onComplete = (error) => {
    const { onComplete } = this.props;
    onComplete(error);
  }

  render() {
    const { charge, plan } = this.props;

    return (
      <div style={styles.container}>
        <StripeProvider apiKey={STRIPE_API_KEY}>
          <div className="example">
            <Elements>
              <StripeSourceForm
                charge={charge}
                plan={plan}
                onComplete={this._onComplete}
              />
            </Elements>
          </div>
        </StripeProvider>
      </div>
    );
  }
}
const styles = {
  container: {
    flex: 1,
  },
};

AddStripeSource.defaultProps = {
  charge: false,
  plan: "",
  onComplete: () => {},
};

AddStripeSource.propTypes = {
  charge: PropTypes.bool,
  plan: PropTypes.string,
  onComplete: PropTypes.func,
};

const mapStateToProps = () => {
  return {
  };
};

const mapDispatchToProps = () => {
  return {
  };
};

export default connect(mapStateToProps, mapDispatchToProps)(AddStripeSource);
