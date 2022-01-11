import React, { useState, useEffect } from "react";
import PropTypes from "prop-types";
import { connect } from "react-redux";
import {
  Container, Loader, Header, Message, Icon, Popup, Button, Label,
} from "semantic-ui-react";
import moment from "moment";
import { format } from "date-fns";
import { enGB } from "date-fns/locale";

import {
  getEmbeddedChart as getEmbeddedChartAction,
  runQueryWithFilters as runQueryWithFiltersAction,
} from "../actions/chart";
import LineChart from "./Chart/components/LineChart";
import BarChart from "./Chart/components/BarChart";
import TableContainer from "./Chart/components/TableView/TableContainer";
import { blackTransparent } from "../config/colors";
import ChartFilters from "./Chart/components/ChartFilters";
import PieChart from "./Chart/components/PieChart";
import DoughnutChart from "./Chart/components/DoughnutChart";
import RadarChart from "./Chart/components/RadarChart";
import PolarChart from "./Chart/components/PolarChart";

const pageHeight = window.innerHeight;

/*
  This container is used for embedding charts in other websites
*/
function EmbeddedChart(props) {
  const { getEmbeddedChart, match, runQueryWithFilters } = props;

  const [loading, setLoading] = useState(false);
  const [chart, setChart] = useState(null);
  const [error, setError] = useState(false);
  const [conditions, setConditions] = useState([]);

  useEffect(() => {
    // change the background color to transparent
    document.body.style.backgroundColor = "transparent";

    setLoading(true);
    setTimeout(() => {
      getEmbeddedChart(match.params.chartId)
        .then((chart) => {
          setChart(chart);
          setLoading(false);
        })
        .catch(() => {
          setError(true);
          setLoading(false);
          setChart({ error: "no chart" });
        });
    }, 1000);
  }, []);

  const _getUpdatedTime = (updatedAt) => {
    if (moment().diff(moment(updatedAt), "days") > 1) {
      return moment(updatedAt).calendar();
    }

    return moment(updatedAt).fromNow();
  };

  const _onAddFilter = (condition) => {
    let found = false;
    const newConditions = conditions.map((c) => {
      let newCondition = c;
      if (c.id === condition.id) {
        newCondition = condition;
        found = true;
      }
      return newCondition;
    });
    if (!found) newConditions.push(condition);
    setConditions(newConditions);

    runQueryWithFilters(chart.project_id, chart.id, newConditions)
      .then((data) => {
        setChart(data);
      });
  };

  const _onClearFilter = (condition) => {
    const newConditions = [...conditions];
    let clearIndex;
    for (let i = 0; i < conditions.length; i++) {
      if (conditions[i].id === condition.id) {
        clearIndex = i;
        break;
      }
    }
    if (clearIndex > -1) newConditions.splice(clearIndex, 1);

    setConditions(newConditions);
    runQueryWithFilters(chart.project_id, chart.id, newConditions)
      .then((data) => {
        setChart(data);
      });
  };

  const _checkIfFilters = () => {
    let filterCount = 0;
    chart.Datasets.forEach((d) => {
      if (d.conditions) {
        filterCount += d.conditions.filter((c) => c.exposed).length;
      }
    });

    return filterCount > 0;
  };

  if (loading || !chart) {
    return (
      <Container textAlign="center" text style={styles.loaderContainer}>
        <Loader active inverted>Loading</Loader>
      </Container>
    );
  }

  if (error) {
    return (
      <Container text>
        <Message>
          <Message.Header>Error loading the Chart</Message.Header>
          <p>
            The Chart might not be public in the ChartBrew dashboard.
          </p>
        </Message>
      </Container>
    );
  }

  return (
    <div style={styles.container}>
      <Container>
        <Container fluid style={styles.header(chart.type)}>
          <Header style={{ display: "contents" }}>{chart.name}</Header>
          {chart.chartData && (
            <div>
              <p>
                {_checkIfFilters() && (
                  <Popup
                    trigger={(
                      <Button
                        icon="filter"
                        direction="left"
                        basic
                        className="circular icon"
                        style={styles.filterBtn}
                      />
                    )}
                    on="click"
                    flowing
                    size="tiny"
                  >
                    <ChartFilters
                      chart={chart}
                      onAddFilter={_onAddFilter}
                      onClearFilter={_onClearFilter}
                      conditions={conditions}
                    />
                  </Popup>
                )}
                {chart.Datasets && (
                  <Label.Group style={{ display: "inline", marginLeft: 10 }} size="small">
                    {conditions.map((c) => {
                      return (
                        <Label key={c.id} icon>
                          {c.type !== "date" && c.value}
                          {c.type === "date" && format(new Date(c.value), "Pp", { locale: enGB })}
                          <Icon name="delete" onClick={() => _onClearFilter(c)} />
                        </Label>
                      );
                    })}
                  </Label.Group>
                )}
              </p>
            </div>
          )}
        </Container>
        {chart.type === "line"
          && (
          <Container fluid>
            <LineChart chart={chart} height={pageHeight - 100} />
          </Container>
          )}
        {chart.type === "bar"
          && (
          <Container fluid>
            <BarChart chart={chart} height={pageHeight - 100} />
          </Container>
          )}
        {chart.type === "pie"
          && (
          <Container fluid>
            <PieChart
              chart={chart}
              height={pageHeight - 100}
            />
          </Container>
          )}
        {chart.type === "doughnut"
          && (
          <Container fluid>
            <DoughnutChart
              chart={chart}
              height={pageHeight - 100}
            />
          </Container>
          )}
        {chart.type === "radar"
          && (
          <Container fluid>
            <RadarChart
              chart={chart}
              height={pageHeight - 100}
            />
          </Container>
          )}
        {chart.type === "polar"
          && (
          <Container fluid>
            <PolarChart
              chart={chart}
              height={pageHeight - 100}
            />
          </Container>
          )}
        {chart.type === "table"
          && (
          <Container fluid>
            <TableContainer
              height={pageHeight - 100}
              tabularData={chart.chartData}
              embedded
            />
          </Container>
          )}
        <div style={{ marginTop: 5 }}>
          <small>
            {!loading && (
              <i>
                <span title="Last updated">{`${_getUpdatedTime(chart.chartDataUpdated)}`}</span>
              </i>
            )}
            {loading && (
              <>
                <Icon name="spinner" loading />
                <span>{" Updating..."}</span>
              </>
            )}
          </small>
          {chart.showBranding && (
            <small style={{ color: blackTransparent(0.5), float: "right" }}>
              {"Powered by "}
              <a href="https://chartbrew.com" target="_blank" rel="noreferrer">
                Chartbrew
              </a>
            </small>
          )}
        </div>
      </Container>
    </div>
  );
}

const styles = {
  container: {
    flex: 1,
    backgroundColor: "transparent",
    padding: 10,
  },
  header: (type) => ({
    paddingRight: type === "table" ? 0 : 20,
    paddingLeft: type === "table" ? 0 : 20,
    paddingBottom: type === "table" ? 10 : 0,
  }),
  loaderContainer: {
    minHeight: 100,
    minWidth: 100,
  },
  updatedText: {
    paddingLeft: 20,
  },
  filterBtn: {
    // marginLeft: 10,
    backgroundColor: "transparent",
    boxShadow: "none",
  },
};

EmbeddedChart.propTypes = {
  getEmbeddedChart: PropTypes.func.isRequired,
  match: PropTypes.object.isRequired,
  runQueryWithFilters: PropTypes.func.isRequired,
};

const mapStateToProps = () => {
  return {
  };
};

const mapDispatchToProps = (dispatch) => {
  return {
    getEmbeddedChart: (id) => dispatch(getEmbeddedChartAction(id)),
    runQueryWithFilters: (projectId, chartId, filters) => (
      dispatch(runQueryWithFiltersAction(projectId, chartId, filters))
    ),
  };
};

export default connect(mapStateToProps, mapDispatchToProps)(EmbeddedChart);
