import React, { useState, useEffect } from "react";
import { connect } from "react-redux";
import { PropTypes } from "prop-types";
import { withRouter } from "react-router";
import {
  Grid, Container, Button, Header, Divider
} from "semantic-ui-react";

import cookie from "react-cookies";

/*
  Component for inviting user to the team
*/
function UserInvite(props) {
  const {
    user, history
  } = props;

  const [fetched, setFetched] = useState(false);

  useEffect(() => {
    if (user.id && !fetched) {
      setFetched(true);
      redirectUser("login");
    }
  }, [user]);

  const redirectUser = (route) => {
    const params = new URLSearchParams(document.location.search);
    const token = params.get("token");

    if (cookie.load("brewToken")) cookie.remove("brewToken");
    if (route === "login") {
      history.push(`/login?inviteToken=${token}`);
    } else {
      history.push(`/signup?inviteToken=${token}`);
    }
  };

  return (
    <div style={styles.container}>
      <Grid
        centered
        verticalAlign="middle"
        textAlign="center"
        >
        <Grid.Column stretched style={{ maxWidth: 500 }}>
          <Container textAlign="center" style={{ marginTop: "3em" }}>
            <Header as="h2" icon>
              Your Chartbrew team invitation
              <Header.Subheader>Please select an option below</Header.Subheader>
            </Header>
            <Divider section hidden />
            <Button
              basic
              content="Login with an existing account"
              onClick={() => redirectUser("login")}
            />
            <Button
              secondary
              content="Create a new account"
              onClick={() => redirectUser("signup")}
            />
          </Container>
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

UserInvite.propTypes = {
  user: PropTypes.object.isRequired,
  history: PropTypes.object.isRequired,
};

const mapStateToProps = (state) => {
  return {
    user: state.user.data,
    team: state.team,
  };
};

const mapDispatchToProps = () => {
  return {
  };
};

export default withRouter(connect(mapStateToProps, mapDispatchToProps)(UserInvite));
