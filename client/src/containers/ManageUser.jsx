import React, { useEffect } from "react";
import { connect } from "react-redux";
import PropTypes from "prop-types";

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
      <div className="grid grid-cols-12 justify-center">
        <div className="col-span-12 sm:col-span-10 md:col-span-8">
          <EditUserForm />
        </div>
      </div>
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

export default connect(mapStateToProps, mapDispatchToProps)(ManageUser);
