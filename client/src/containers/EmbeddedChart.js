import React, { useState, useEffect } from "react";
import PropTypes from "prop-types";
import { connect } from "react-redux";
import {
  Container, Loading, Row, Text, Popover, Link, Badge, Spacer,
} from "@nextui-org/react";
import moment from "moment";
import { format } from "date-fns";
import { enGB } from "date-fns/locale";
import { CloseSquare, Filter2 } from "react-iconly";
import { Helmet } from "react-helmet";

import {
  getEmbeddedChart as getEmbeddedChartAction,
  runQueryWithFilters as runQueryWithFiltersAction,
} from "../actions/chart";
import LineChart from "./Chart/components/LineChart";
import BarChart from "./Chart/components/BarChart";
import TableContainer from "./Chart/components/TableView/TableContainer";
import ChartFilters from "./Chart/components/ChartFilters";
import PieChart from "./Chart/components/PieChart";
import DoughnutChart from "./Chart/components/DoughnutChart";
import RadarChart from "./Chart/components/RadarChart";
import PolarChart from "./Chart/components/PolarChart";
import logo from "../assets/logo_inverted.png";
import useInterval from "../modules/useInterval";

const pageHeight = window.innerHeight;

/*
  This container is used for embedding charts in other websites
*/
function EmbeddedChart(props) {
  const { getEmbeddedChart, match, runQueryWithFilters } = props;

  const [loading, setLoading] = useState(false);
  const [chart, setChart] = useState({});
  const [error, setError] = useState(false);
  const [conditions, setConditions] = useState([]);
  const [dataLoading, setDataLoading] = useState(false);

  useInterval(() => {
    setDataLoading(true);
    getEmbeddedChart(match.params.chartId)
      .then((chart) => {
        setChart(chart);
        setDataLoading(false);
      })
      .catch(() => {
        setDataLoading(false);
      });
  }, chart.autoUpdate ? chart.autoUpdate * 1000 : null);

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

    setDataLoading(true);
    runQueryWithFilters(chart.project_id, chart.id, newConditions)
      .then((data) => {
        setDataLoading(false);
        setChart(data);
      })
      .catch(() => {
        setDataLoading(false);
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

  if (loading || !chart.id) {
    return (
      <>
        <Helmet>
          <style type="text/css">
            {`
            body, html {
              background-color: transparent;
            }

            #root {
              background-color: transparent;
            }
          `}
          </style>
        </Helmet>
        <Container justify="center" css={{ ...styles.loaderContainer, pt: 50 }}>
          <Row justify="center" align="center">
            <Loading type="points-opacity" color="currentColor" size="xl" aria-label="Loading" />
          </Row>
        </Container>
      </>
    );
  }

  if (error) {
    return (
      <Container css={{ backgroundColor: "$blue300", p: 10 }}>
        <Row>
          <Text h5>{"Error loading the Chart"}</Text>
        </Row>
        <Row>
          <Text>The Chart might not be public in the ChartBrew dashboard.</Text>
        </Row>
      </Container>
    );
  }

  return (
    <div style={styles.container}>
      <Helmet>
        <style type="text/css">
          {`
            body, html {
              background-color: transparent;
            }

            #root {
              background-color: transparent;
            }
          `}
        </style>
      </Helmet>
      <Container fluid css={{ pl: "$sm" }} style={styles.header(chart.type)} xl>
        <Row justify="space-between">
          <div style={{ display: "flex", alignItems: "center" }}>
            <Text b size="1.1em" css={{ color: "$text", lineHeight: "$xs" }}>{chart.name}</Text>
            <Spacer x={0.5} />
            {chart.Datasets && conditions.map((c) => {
              return (
                <Badge color="primary" variant={"flat"} key={c.id} size="sm" css={{ p: 0, pl: 5, pr: 5 }}>
                  {c.type !== "date" && `${c.value}`}
                  {c.type === "date" && format(new Date(c.value), "Pp", { locale: enGB })}
                  <Spacer x={0.2} />
                  <Link onClick={() => _onClearFilter(c)} css={{ color: "$text" }}>
                    <CloseSquare size="small" />
                  </Link>
                </Badge>
              );
            })}
          </div>

          {chart.chartData && (
            <div>
              <p>
                {_checkIfFilters() && (
                  <Popover>
                    <Popover.Trigger>
                      <Link css={{ color: "$accents6" }}>
                        <Filter2 set="light" />
                      </Link>
                    </Popover.Trigger>
                    <Popover.Content>
                      <Container css={{ pt: 10, pb: 10 }}>
                        <ChartFilters
                          chart={chart}
                          onAddFilter={_onAddFilter}
                          onClearFilter={_onClearFilter}
                          conditions={conditions}
                        />
                      </Container>
                    </Popover.Content>
                  </Popover>
                )}
              </p>
            </div>
          )}
        </Row>
      </Container>
      <Spacer y={0.5} />
      {chart.type === "line"
        && (
        <div>
          <LineChart chart={chart} height={pageHeight - 100} />
        </div>
        )}
      {chart.type === "bar"
        && (
        <div>
          <BarChart chart={chart} height={pageHeight - 100} />
        </div>
        )}
      {chart.type === "pie"
        && (
        <div>
          <PieChart
            chart={chart}
            height={pageHeight - 100}
          />
        </div>
        )}
      {chart.type === "doughnut"
        && (
        <div>
          <DoughnutChart
            chart={chart}
            height={pageHeight - 100}
          />
        </div>
        )}
      {chart.type === "radar"
        && (
        <div>
          <RadarChart
            chart={chart}
            height={pageHeight - 100}
          />
        </div>
        )}
      {chart.type === "polar"
        && (
        <div>
          <PolarChart
            chart={chart}
            height={pageHeight - 100}
          />
        </div>
        )}
      {chart.type === "table"
        && (
        <div>
          <TableContainer
            height={pageHeight - 100}
            tabularData={chart.chartData}
            embedded
            datasets={chart.Datasets}
          />
        </div>
        )}
      <Spacer y={0.5} />
      <Container css={{ pr: 5, pl: 5 }} xl>
        <Row justify="space-between" align="center">
          <div style={styles.row}>
            {!loading && (
              <>
                {dataLoading && (
                  <>
                    <Loading type="spinner" size="xs" inlist />
                    <Spacer x={0.2} />
                    <Text small>{"Updating..."}</Text>
                  </>
                )}
                {!dataLoading && (
                  <Text small i title="Last updated">
                    {`${_getUpdatedTime(chart.chartDataUpdated)}`}
                  </Text>
                )}
              </>
            )}
            {loading && (
              <>
                <Loading type="spinner" size="xs" inlist />
                <Spacer x={0.2} />
                <Text small css={{ color: "$accents6" }}>{"Updating..."}</Text>
              </>
            )}
          </div>
          {chart.showBranding && (
            <Link href="https://chartbrew.com" target="_blank" rel="noreferrer" css={{ color: "$primary", ai: "flex-end" }}>
              <img
                src={logo}
                width="15"
                alt="Chartbrew logo"
              />
              <Spacer x={0.2} />
              <Text small css={{ color: "$accents6" }}>
                <strong>Chart</strong>
                brew
              </Text>
            </Link>
          )}
        </Row>
      </Container>
    </div>
  );
}

const styles = {
  container: {
    flex: 1,
    backgroundColor: "transparent",
    padding: 20,
  },
  header: (type) => ({
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
  row: {
    display: "flex",
    flexDirection: "row",
    alignItems: "center",
  }
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
