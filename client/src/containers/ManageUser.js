import React, { useEffect } from "react";
import { connect } from "react-redux";
import PropTypes from "prop-types";
import { Route, Switch, withRouter } from "react-router";

import { Link } from "react-router-dom";

import { Menu, Header, Grid } from "semantic-ui-react";
import EditUserForm from "../components/EditUserForm";
import Navbar from "../components/Navbar";
import { cleanErrors as cleanErrorsAction } from "../actions/error";

/*
  User Profile Settings main screen
*/
function ManageUser(props) {
  const { cleanErrors } = props;

  useEffect(() => {
    cleanErrors();
  }, []);

  const check = (path) => {
    switch (path) {
      case "edit":
        if (window.location.pathname.indexOf("edit") > -1) return true;
        break;
      default:
        return false;
    }
    return false;
  };

  return (
    <div style={styles.container}>
      <Navbar hideTeam />
      <Grid centered padded columns={2} stackable>
        <Grid.Column width={3}>
          <Header as="h3" style={{ paddingTop: 20 }}>
            Account settings
          </Header>
          <Menu secondary vertical fluid>
            <Menu.Item
              as={Link}
              active={check("edit")}
              to="/edit"
            >
              Edit Profile
            </Menu.Item>
            <Menu.Item disabled>
              Settings
            </Menu.Item>
            <Menu.Item disabled>
              Notifications
            </Menu.Item>
          </Menu>
        </Grid.Column>
        <Grid.Column width={12}>
          <Switch>
            <Route path="/edit" component={EditUserForm} />
          </Switch>
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

ManageUser.propTypes = {
  cleanErrors: PropTypes.func.isRequired,
};

const mapStateToProps = (state) => {
  return {
    user: state.user.data,
  };
};

const mapDispatchToProps = (dispatch) => {
  return {
    cleanErrors: () => dispatch(cleanErrorsAction()),
  };
};

export default withRouter(connect(mapStateToProps, mapDispatchToProps)(ManageUser));
