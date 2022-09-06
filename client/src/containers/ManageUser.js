import React, { useEffect } from "react";
import { connect } from "react-redux";
import PropTypes from "prop-types";
import { Route, Switch, withRouter } from "react-router";
import { Grid } from "@nextui-org/react";

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

  return (
    <div style={styles.container}>
      <Navbar hideTeam />
      <Grid.Container justify="center">
        <Grid xs={12} sm={10} md={8}>
          <Switch>
            <Route path="/edit" component={EditUserForm} />
          </Switch>
        </Grid>
      </Grid.Container>
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
