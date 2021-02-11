import React, {
  useEffect, useState,
} from "react";
import PropTypes from "prop-types";
import { connect } from "react-redux";
import { withRouter } from "react-router";
import {
  Button, Grid, Icon, Image, Popup
} from "semantic-ui-react";
import { Helmet } from "react-helmet";

import {
  runQueryWithFilters as runQueryWithFiltersAction,
} from "../../actions/chart";
import Chart from "../Chart/Chart";
import cbLogo from "../../assets/logo_blue.png";

function PrintView(props) {
  const {
    charts, onPrint, isPrinting,
  } = props;

  const [orientation, setOrientation] = useState("portrait");
  const [showMenu, setShowMenu] = useState(false);
  const [showTheme, setShowTheme] = useState(false);
  const [printCharts, setPrintCharts] = useState([]);

  useEffect(() => {
    if (charts && charts.length > 0) {
      const newCharts = charts.map((chart) => {
        const newChart = chart;
        if (newChart && newChart.chartData && newChart.chartData.options) {
          // newChart.chartData.options.maintainAspectRatio = true;
          newChart.chartData.options.responsive = true;
        }

        return newChart;
      });

      setPrintCharts(newCharts);
    }
  }, [charts]);

  useEffect(() => {
    setShowTheme(isPrinting);
  }, [isPrinting]);

  const _onDisplayMenu = () => {
    setShowMenu(true);
  };

  const _onHideMenu = () => {
    setShowMenu(false);
  };

  const _changeOrientation = () => {
    const newOrientation = `${orientation}`;
    setOrientation("");
    setTimeout(() => {
      if (newOrientation === "portrait") {
        setOrientation("landscape");
      } else {
        setOrientation("portrait");
      }
    }, 100);
  };

  const _togglePrint = () => {
    setShowTheme(!showTheme);
    setTimeout(() => (onPrint()));
  };

  const _onStartPrint = () => {
    setShowMenu(false);
    setTimeout(() => (window.print()), 100);
  };

  return (
    <div style={styles.page(orientation)}>
      {showTheme && (
        <Helmet>
          <style type="text/css">
            {`
              body {
                background-color: white;
              }
            `}
          </style>
        </Helmet>
      )}
      {!showTheme && (
        <Helmet>
          <style type="text/css">
            {`
              body {
                background-color: #ECEFF1;
              }
            `}
          </style>
        </Helmet>
      )}
      <div style={styles.logoContainer} onMouseEnter={_onDisplayMenu} onMouseLeave={_onHideMenu}>
        {showMenu && (
          <div style={styles.orientationBtn(orientation)}>
            <Button
              icon="arrow left"
              basic
              onClick={_togglePrint}
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
            <Button
              icon
              labelPosition="left"
              primary
              onClick={_onStartPrint}
            >
              <Icon name="print" />
              Print
            </Button>
          </div>
        )}
        <Popup
          trigger={(
            <Image size="small" src={cbLogo} style={styles.logo} centered onClick={_togglePrint} />
          )}
          content="Click to return to the dashboard"
        />
      </div>
      <Grid stackable centered style={styles.mainGrid}>
        {orientation && printCharts && printCharts.map((chart) => {
          if (chart.draft) return (<span style={{ display: "none" }} key={chart.id} />);
          return (
            <Grid.Column width={chart.chartSize * 4} key={chart.id} style={styles.chartGrid}>
              <Chart
                key={chart.id}
                chart={chart}
                charts={printCharts}
                showDrafts={false}
                print={orientation}
                height={orientation === "landscape" ? 230 : 300}
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
  isPrinting: PropTypes.bool.isRequired,
};

const styles = {
  page: (orientation) => ({
    width: orientation === "landscape" ? "9.25in" : "7in",
    height: orientation === "landscape" ? "7in" : "9.25in",
    marginTop: orientation === "landscape" ? "0.2in" : "1in",
    marginBottom: orientation === "landscape" ? "0.5in" : "1in",
    marginRight: orientation === "landscape" ? "1in" : "auto",
    marginLeft: orientation === "landscape" ? "1in" : "auto",
    backgroundColor: "white",
  }),
  chartGrid: {
    padding: 10,
  },
  mainGrid: {
    paddingTop: 15,
  },
  orientationBtn: (orientation) => ({
    position: "absolute",
    top: orientation === "landscape" ? "0.2in" : "1in",
    left: 20,
  }),
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
