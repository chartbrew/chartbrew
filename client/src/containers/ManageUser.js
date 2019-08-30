import React, { Component } from "react";
import { connect } from "react-redux";
import { Route, Switch, withRouter } from "react-router";

import { Link } from "react-router-dom";

import { Menu, Header, Grid } from "semantic-ui-react";
import EditUserForm from "../components/EditUserForm";
import Navbar from "../components/Navbar";
/*
  Component for inviting user to the team
*/
class ManageUser extends Component {
  check(path) {
    switch (path) {
      case "edit":
        if (window.location.pathname.indexOf("edit") > -1) return true;
        break;
      default:
        return false;
    }
    return false;
  }


  render() {
    return (
      <div style={styles.container}>
        <Navbar hideTeam />
        <Grid centered padded columns={2}>
          <Grid.Column width={3}>
            <Header as="h3" style={{ paddingTop: 20 }}>
              Account settings
            </Header>
            <Menu secondary vertical fluid>
              <Menu.Item
                as={Link}
                active={this.check("edit")}
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
}

const styles = {
  container: {
    flex: 1,
  },
};

ManageUser.propTypes = {
};

const mapStateToProps = (state) => {
  return {
    user: state.user.data,
  };
};

const mapDispatchToProps = () => {
  return {
  };
};

export default withRouter(connect(mapStateToProps, mapDispatchToProps)(ManageUser));
