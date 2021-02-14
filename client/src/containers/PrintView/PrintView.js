import React, {
  useEffect, useState,
} from "react";
import PropTypes from "prop-types";
import { connect } from "react-redux";
import { withRouter } from "react-router";
import {
  Button, Container, Form, Grid, Header, Icon, Input, Popup
} from "semantic-ui-react";
import { Helmet } from "react-helmet";
import uuid from "uuid/v4";

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
      <div style={styles.logoContainer} onMouseEnter={_onDisplayMenu}>
        {showMenu && (
          <div style={styles.orientationBtn}>
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
              {orientation === "portrait" ? "Switch to Landscape" : "Switch to Portrait"}
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
      </div>
      <div onMouseEnter={_onDisplayMenu}>
        <Header textAlign="center" size="huge" onClick={() => setEditingTitle(true)}>
          <Popup
            trigger={(
              <a style={styles.editTitle}>
                { printTitle || project.name}
              </a>
            )}
            content="Edit your public dashboard title"
          />
        </Header>

        {editingTitle
          && (
            <Container fluid textAlign="center">
              <Form style={{ display: "inline-block" }} size="big">
                <Form.Group>
                  <Form.Field>
                    <Input
                      placeholder="Enter a title"
                      value={printTitle || project.name}
                      onChange={(e, data) => setPrintTitle(data.value)}
                    />
                  </Form.Field>
                  <Form.Field>
                    <Button
                      secondary
                      icon
                      labelPosition="right"
                      type="submit"
                      onClick={() => setEditingTitle(false)}
                      size="big"
                    >
                      <Icon name="checkmark" />
                      Save
                    </Button>
                  </Form.Field>
                </Form.Group>
              </Form>
            </Container>
          )}
      </div>
      <Grid stackable centered style={styles.mainGrid}>
        {orientation && printCharts && printCharts.map((chart) => {
          if (chart === "row") {
            return (
              <Grid.Row style={{ marginTop: orientation === "landscape" ? 50 : 230 }} key={uuid()} />
            );
          }
          if (chart.draft) return (<span style={{ display: "none" }} key={chart.id} />);
          return (
            <Grid.Column
              width={chart.chartSize * 4}
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
  project: PropTypes.object.isRequired,
};

const styles = {
  page: (orientation) => ({
    width: orientation === "landscape" ? "9.25in" : "7in",
    height: orientation === "landscape" ? "7in" : "9.25in",
    marginTop: orientation === "landscape" ? "0.2in" : "0.9in",
    marginBottom: orientation === "landscape" ? "0.5in" : "0.9in",
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
