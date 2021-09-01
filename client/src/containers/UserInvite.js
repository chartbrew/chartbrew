import React, { Component } from "react";
import { connect } from "react-redux";
import { PropTypes } from "prop-types";
import { Link } from "react-router-dom";
import { withRouter } from "react-router";
import {
  Grid, Loader, Container, Dimmer, Button, Header, Icon
} from "semantic-ui-react";

import cookie from "react-cookies";
import { addTeamMember, getUserByTeamInvite } from "../actions/team";

/*
  Component for inviting user to the team
*/
class UserInvite extends Component {
  constructor(props) {
    super(props);
    this.state = {
      loading: true,
      success: false,
      error: false,
      fetched: false
    };
  }

  componentDidUpdate(nextProps) {
    this.updateProps(nextProps);
  }

  updateProps = (nextProps) => {
    const { addTeamMember } = this.props;
    const { fetched } = this.state;
    const params = new URLSearchParams(document.location.search);

    this.setState({ teamId: params.get("team_id") });
    if (nextProps.user.data.id && !fetched) {
      this.setState({ fetched: true });
      addTeamMember(nextProps.user.data.id, params.get("token"))
        .then(() => {
          this.setState({ success: true, loading: false });
        })
        .catch(() => {
          this.setState({ error: true, loading: false });
        });
    }
  }

  redirectUser() {
    const { getUserByTeamInvite, history } = this.props;
    const params = new URLSearchParams(document.location.search);
    const token = params.get("token");

    getUserByTeamInvite(token)
      .then((invitedUser) => {
        if (cookie.load("brewToken")) cookie.remove("brewToken");
        if (invitedUser) {
          history.push(`/login?inviteToken=${token}`);
        } else {
          history.push(`/signup?inviteToken=${token}`);
        }
      })
      .catch(() => {
        history.push("/");
      });
  }

  successMessage() {
    const { user } = this.props;
    const { teamId } = this.state;

    return (
      <Container textAlign="center" style={{ marginTop: "3em" }}>
        <Header as="h2" icon color="green">
          <Icon color="green" name="checkmark" circular />
          {user.data.name}
          , you have been added to the team
        </Header>
        <Button positive icon labelPosition="right">
          <Link to={`/team/${teamId}/members`} style={{ color: "white" }}> Explore team </Link>
          <Icon name="arrow alternate circle right outline" />
        </Button>
      </Container>
    );
  }

  errorMessage() {
    return (
      <Header as="h2" icon color="orange">
        <Icon color="orange" name="delete" circular />
        There was an error adding you to the team.
        <Header.Subheader>
          Please try refreshing the page or contact us.
        </Header.Subheader>
      </Header>
    );
  }

  render() {
    const { user } = this.props;
    const { success, error, loading } = this.state;

    return (
      <div style={styles.container}>
        <Grid
          centered
          verticalAlign="middle"
          textAlign="center"
        >
          <Grid.Column stretched style={{ maxWidth: 500 }}>
            {user.data.id
              ? (
                <span>
                  <Dimmer active={loading} style={{ marginTop: "5em" }} inverted>
                    <Loader size="big" content="Adding you to the team ..." />
                  </Dimmer>
                  {success && this.successMessage() }
                  {error && this.errorMessage() }
                </span>
              )
              : this.redirectUser()}
          </Grid.Column>
        </Grid>
      </div>
    );
  }
}

const styles = {
  container: {
    flex: 1,
  },
};

UserInvite.propTypes = {
  addTeamMember: PropTypes.func.isRequired,
  getUserByTeamInvite: PropTypes.func.isRequired,
  user: PropTypes.object.isRequired,
  history: PropTypes.object.isRequired,
};

const mapStateToProps = (state) => {
  return {
    user: state.user,
    team: state.team,
  };
};

const mapDispatchToProps = (dispatch) => {
  return {
    addTeamMember: (userId, token) => dispatch(addTeamMember(userId, token)),
    getUserByTeamInvite: (token) => dispatch(getUserByTeamInvite(token)),
  };
};

export default withRouter(connect(mapStateToProps, mapDispatchToProps)(UserInvite));
