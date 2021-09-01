import React, { useState, useEffect } from "react";
import { connect } from "react-redux";
import { PropTypes } from "prop-types";
import { Link } from "react-router-dom";
import {
  Grid, Loader, Container, Dimmer, Button, Header, Icon
} from "semantic-ui-react";

import { verify } from "../actions/user";

/*
  Component for verifying a new user
*/
function VerifyUser(props) {
  const { verify } = props;
  const [loading, setLoading] = useState(true);
  const [success, setSuccess] = useState(false);
  const [error, setError] = useState(false);
  const [name, setName] = useState("");

  useEffect(() => {
    const params = new URLSearchParams(document.location.search);

    verify(params.get("id"), params.get("token"))
      .then((user) => {
        setSuccess(true);
        setLoading(false);
        setName(user.name);
      })
      .catch(() => {
        setError(true);
        setLoading(false);
      });
  }, []);

  return (
    <div style={styles.container}>
      <Grid
        centered
        verticalAlign="middle"
        textAlign="center"
      >
        <Grid.Column stretched style={{ maxWidth: 500 }}>
          <Dimmer active={loading} style={{ marginTop: "5em" }} inverted>
            <Loader size="big" inverted content="Verifying your account ..." />
          </Dimmer>

          {success
            && (
            <Container textAlign="center" style={{ marginTop: "3em" }}>
              <Header as="h2" icon color="green">
                <Icon color="green" name="checkmark" circular />
                {name}
                , Your email was verified successfully
              </Header>
              <Button positive icon labelPosition="right">
                <Link to="/user" style={{ color: "white" }}> Go to account </Link>
                <Icon name="arrow alternate circle right outline" />
              </Button>
            </Container>
            )}

          {error
            && (
            <Header as="h2" icon color="red">
              <Icon color="red" name="delete" circular />
              Your email could not be verified
              <Header.Subheader>
                Please try refreshing the page or contact us.
              </Header.Subheader>
            </Header>
            )}
        </Grid.Column>
      </Grid>
    </div>
  );
}

const styles = {
  container: {
    flex: 1,
  },
};

VerifyUser.propTypes = {
  verify: PropTypes.func.isRequired,
};

const mapStateToProps = (state) => {
  return {
    user: state.user,
  };
};

const mapDispatchToProps = (dispatch) => {
  return {
    verify: (id, token) => dispatch(verify(id, token)),
  };
};

export default connect(mapStateToProps, mapDispatchToProps)(VerifyUser);
