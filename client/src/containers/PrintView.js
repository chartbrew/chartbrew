import React, { useState } from "react";
import PropTypes from "prop-types";
import { connect } from "react-redux";
import { withRouter } from "react-router";
import {
  Button, Grid, Icon, Image, Popup
} from "semantic-ui-react";

import {
  runQueryWithFilters as runQueryWithFiltersAction,
} from "../actions/chart";
import Chart from "./Chart/Chart";
import cbLogo from "../assets/logo_blue.png";

function PrintView(props) {
  const {
    charts, onPrint,
  } = props;

  const [orientation, setOrientation] = useState("portrait");
  const [showMenu, setShowMenu] = useState(false);

  const _onDisplayMenu = () => {
    setShowMenu(true);
  };

  const _onHideMenu = () => {
    setShowMenu(false);
  };

  const _changeOrientation = () => {
    if (orientation === "portrait") {
      setOrientation("landscape");
    } else {
      setOrientation("portrait");
    }
  };

  return (
    <div style={{ width: orientation === "landscape" ? "29.7cm" : "21cm" }}>
      <div style={styles.logoContainer} onMouseEnter={_onDisplayMenu} onMouseLeave={_onHideMenu}>
        {showMenu && (
          <div style={styles.orientationBtn}>
            <Button
              icon="arrow left"
              basic
              onClick={onPrint}
            />
            <Button
              icon
              labelPosition="left"
              primary
              basic
              onClick={_changeOrientation}
            >
              <Icon name="redo" />
              {orientation === "portrait" ? "Landscape" : "Portrait"}
            </Button>
          </div>
        )}
        <Popup
          trigger={(
            <Image size="small" src={cbLogo} style={styles.logo} centered onClick={onPrint} />
          )}
          content="Click to return to the dashboard"
        />
      </div>
      <Grid stackable centered style={styles.mainGrid}>
        {charts.map((chart) => {
          if (chart.draft) return (<span style={{ display: "none" }} key={chart.id} />);
          return (
            <Grid.Column width={chart.chartSize * 4} key={chart.id} style={styles.chartGrid}>
              <Chart
                key={chart.id}
                chart={chart}
                charts={charts}
                showDrafts={false}
                isPrint
              />
            </Grid.Column>
          );
        })}
      </Grid>
    </div>
  );
}

PrintView.propTypes = {
  charts: PropTypes.array.isRequired,
  onPrint: PropTypes.func.isRequired,
};

const styles = {
  chartGrid: {
    padding: 10,
  },
  mainGrid: {
    padding: 10,
    paddingTop: 15,
  },
  orientationBtn: {
    position: "absolute",
    top: 10,
    left: 10,
  },
  logo: {
    width: 40,
  },
  logoContainer: {
    padding: 5,
    marginTop: 10,
  },
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
  };
};

export default withRouter(connect(mapStateToProps, mapDispatchToProps)(PrintView));
