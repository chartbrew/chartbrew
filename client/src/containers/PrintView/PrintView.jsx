import React, {
  useEffect, useState,
} from "react";
import PropTypes from "prop-types";
import { connect } from "react-redux";
import { withRouter } from "react-router";
import {
  Button, Container, Grid, Input, Row, Spacer, Text, Tooltip,
} from "@nextui-org/react";
import { Helmet } from "react-helmet";
import uuid from "uuid/v4";
import { FaPrint, FaRedo } from "react-icons/fa";
import { ChevronLeftCircle, TickSquare } from "react-iconly";

import {
  runQueryWithFilters as runQueryWithFiltersAction,
} from "../../actions/chart";
import Chart from "../Chart/Chart";

function PrintView(props) {
  const {
    charts, onPrint, isPrinting, project,
  } = props;

  const [orientation, setOrientation] = useState("portrait");
  const [showMenu, setShowMenu] = useState(true);
  const [showTheme, setShowTheme] = useState(false);
  const [printCharts, setPrintCharts] = useState([]);
  const [editingTitle, setEditingTitle] = useState(false);
  const [printTitle, setPrintTitle] = useState("");

  useEffect(() => {
    if (charts && charts.length > 0) {
      let rowCounter = 0;
      let sizeCalc = 0;
      const newCharts = [];
      charts.map((chart, index) => {
        if (chart.draft) return chart;
        newCharts.push(chart);
        sizeCalc += chart.chartSize;
        if (charts[index + 1] && sizeCalc + charts[index + 1].chartSize > 4) {
          sizeCalc = 0;
          rowCounter++;
        }

        if (rowCounter === 2) {
          newCharts.push("row");
          rowCounter = 0;
        }

        return chart;
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
                background-color: white !important;
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
      <Container style={styles.logoContainer} onMouseEnter={_onDisplayMenu}>
        {showMenu && (
          <Row style={styles.orientationBtn}>
            <Button
              icon={<ChevronLeftCircle />}
              bordered
              onClick={_togglePrint}
              css={{ minWidth: "fit-content" }}
            />
            <Spacer x={0.2} />
            <Button
              icon={<FaRedo />}
              bordered
              onClick={_changeOrientation}
              auto
            >
              {orientation === "portrait" ? "Switch to Landscape" : "Switch to Portrait"}
            </Button>
            <Spacer x={0.2} />
            <Button
              icon={<FaPrint />}
              onClick={_onStartPrint}
              auto
            >
              Print
            </Button>
          </Row>
        )}
      </Container>
      <div onMouseEnter={_onDisplayMenu}>
        <Text size="2.5em" onClick={() => setEditingTitle(true)}>
          <Tooltip content="Edit your public dashboard title">
            <a style={styles.editTitle}>
              {printTitle || project.name}
            </a>
          </Tooltip>
        </Text>

        {editingTitle
          && (
            <Container justify="center">
              <Row justify="center" align="center">
                <Input
                  placeholder="Enter a title"
                  value={printTitle || project.name}
                  onChange={(e) => setPrintTitle(e.target.value)}
                  bordered
                />
                <Spacer x={0.2} />
                <Button
                  color="secondary"
                  icon={<TickSquare />}
                  onClick={() => setEditingTitle(false)}
                  auto
                >
                  Save
                </Button>
              </Row>
            </Container>
          )}
      </div>
      <Grid.Container style={styles.mainGrid}>
        {orientation && printCharts && printCharts.map((chart) => {
          if (chart === "row") {
            return (
              <Grid xs={12} style={{ paddingTop: orientation === "landscape" ? 50 : 230 }} key={uuid()} />
            );
          }
          if (chart.draft) return (<span style={{ display: "none" }} key={chart.id} />);
          return (
            <Grid
              xs={chart.chartSize * 3}
              key={chart.id}
              style={styles.chartGrid}
            >
              <Chart
                chart={chart}
                charts={printCharts}
                showDrafts={false}
                print={orientation}
                height={orientation === "landscape" ? 230 : 300}
              />
            </Grid>
          );
        })}
      </Grid.Container>
    </div>
  );
}

PrintView.propTypes = {
  charts: PropTypes.array.isRequired,
  onPrint: PropTypes.func.isRequired,
  isPrinting: PropTypes.bool.isRequired,
  project: PropTypes.object.isRequired,
};

const styles = {
  page: (orientation) => ({
    width: orientation === "landscape" ? "9.25in" : "7in",
    height: orientation === "landscape" ? "7in" : "9.25in",
    paddingTop: orientation === "landscape" ? "0.2in" : "0.9in",
    paddingBottom: orientation === "landscape" ? "0.5in" : "0.9in",
    paddingRight: orientation === "landscape" ? "1in" : "auto",
    paddingLeft: orientation === "landscape" ? "1in" : "auto",
    backgroundColor: "white",
  }),
  chartGrid: {
    padding: 10,
  },
  mainGrid: {
    paddingTop: 15,
  },
  orientationBtn: {
    position: "absolute",
    top: "0.1in",
    left: 20,
  },
  logo: {
    width: 40,
  },
  logoContainer: {
    padding: 5,
    marginTop: 10,
  },
  editTitle: {
    color: "black",
  },
};

const mapStateToProps = (state) => {
  return {
    charts: state.chart.data,
    project: state.project.active,
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
