import React, { Component } from "react";
import PropTypes from "prop-types";
import { connect } from "react-redux";
import {
  Message, Segment, Header, Dimmer, Loader, Dropdown, Label
} from "semantic-ui-react";

import AddStripeSource from "../components/AddStripeSource";
import { getCustomer, setDefaultSource, removeSource } from "../actions/stripe";
/*
  Login container with an embedded login form
*/
class ManagePaymentMethods extends Component {
  state = {
    loading: true,
  }

  componentDidMount() {
    this._getComponentData();
  }

  _getComponentData() {
    this.setState({ loading: true, error: false });
    this.props.getCustomer()
      .then((customer) => {
        if (!customer.sources) throw new Error("malformed customer object");
        this.setState({
          sources: customer.sources.data,
          loading: false,
          defaultSource: customer.default_source,
        });
      })
      .catch((error) => {
        let encounteredError = true;
        if (error.message.indexOf("404") > -1) encounteredError = 404;
        this.setState({ error: encounteredError, loading: false });
      });
  }

  _onSourceAdded = () => {
    this._getComponentData();
  }

  _setDefaultSource = (cardId) => {
    this.setState({ loading: true });
    this.props.setDefaultSource(cardId)
      .then(() => {
        this._getComponentData();
      })
      .catch(() => {
        this.setState({ error: true, loading: false });
      });
  }

  _removeSource = (cardId) => {
    this.setState({ loading: true });
    this.props.removeSource(cardId)
      .then(() => {
        this._getComponentData();
      })
      .catch(() => {
        this.setState({ error: true, loading: false });
      });
  }

  render() {
    const {
      error, loading, sources, defaultSource
    } = this.state;

    return (
      <div style={this.props.style}>
        <Header attached="top" as="h3">Add a new payment method</Header>
        <Segment attached raised>
          <AddStripeSource onComplete={this._onSourceAdded} />
        </Segment>

        <Header attached="top" as="h3">Your saved payment methods</Header>
        <Segment attached raised style={styles.sourcesContainer}>
          {(error && error !== 404)
            && (
            <Message negative>
              <Message.Header>We encountered a problem while getting your details</Message.Header>
              <p>{"Try refreshing the page or get in touch with us directly using the chat function."}</p>
            </Message>
            )}
          {(!loading && (error === 404 || !defaultSource))
            && <p>{"You don't have any payment methods saved yet."}</p>}
          {loading
            && (
            <Dimmer inverted active={loading}>
              <Loader />
            </Dimmer>
            )}
          {sources && sources.map((source) => {
            return (
              <Segment clearing key={source.id}>
                <Dropdown icon="ellipsis vertical" direction="left" button className="icon" style={{ float: "right" }}>
                  <Dropdown.Menu>
                    <Dropdown.Item
                      icon="sync"
                      text="Make default"
                      disabled={defaultSource === source.id}
                      onClick={() => this._setDefaultSource(source.id)}
                    />
                    <Dropdown.Divider />
                    <Dropdown.Item
                      icon="trash"
                      text="Delete"
                      disabled={sources.length < 2}
                      onClick={() => this._removeSource(source.id)}
                    />
                  </Dropdown.Menu>
                </Dropdown>
                <Header style={{ display: "contents" }}>
                  {`${source.name} xxxx-${source.last4}`}
                  {defaultSource === source.id && <Label color="olive">Default</Label>}
                  <Header.Subheader>{`Expires ${source.exp_month}/${source.exp_year}`}</Header.Subheader>
                </Header>
              </Segment>
            );
          })}
        </Segment>
      </div>
    );
  }
}
const styles = {
  container: {
    flex: 1,
  },
  sourcesContainer: {
    minHeight: 50,
  },
};

ManagePaymentMethods.defaultProps = {
  style: {},
};

ManagePaymentMethods.propTypes = {
  getCustomer: PropTypes.func.isRequired,
  setDefaultSource: PropTypes.func.isRequired,
  removeSource: PropTypes.func.isRequired,
  style: PropTypes.object,
};

const mapStateToProps = () => {
  return {
  };
};

const mapDispatchToProps = (dispatch) => {
  return {
    getCustomer: () => dispatch(getCustomer()),
    setDefaultSource: (cardId) => dispatch(setDefaultSource(cardId)),
    removeSource: (cardId) => dispatch(removeSource(cardId)),
  };
};

export default connect(mapStateToProps, mapDispatchToProps)(ManagePaymentMethods);
