import React, { useEffect } from "react";
import PropTypes from "prop-types";
import { connect } from "react-redux";

import {
  runQuery as runQueryAction,
  runQueryWithFilters as runQueryWithFiltersAction,
} from "../actions/chart";

function PrintView(props) {
  const { runQuery, runQueryWithFilters, charts } = props; // eslint-disable-line

  useEffect(() => {
    if (!charts) {
      //
    }
  }, [charts]);

  return (
    <div>
      <p>Print view</p>
    </div>
  );
}

PrintView.propTypes = {
  charts: PropTypes.array.isRequired,
  runQuery: PropTypes.func.isRequired,
  runQueryWithFilters: PropTypes.func.isRequired,
};

const mapStateToProps = (state) => {
  return {
    charts: state.chart.data,
  };
};

const mapDispatchToProps = (dispatch) => {
  return {
    runQueryWithFilters: (projectId, chartId, filters) => (
      dispatch(runQueryWithFiltersAction(projectId, chartId, filters))
    ),
    runQuery: (projectId, chartId) => dispatch(runQueryAction(projectId, chartId)),
  };
};

export default connect(mapStateToProps, mapDispatchToProps)(PrintView);
