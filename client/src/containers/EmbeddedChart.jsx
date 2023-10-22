import React, { useState, useEffect } from "react";
import PropTypes from "prop-types";
import {
  Popover, Link, Spacer, CircularProgress, Chip,
} from "@nextui-org/react";
import moment from "moment";
import { format } from "date-fns";
import { enGB } from "date-fns/locale";
import { Helmet } from "react-helmet";

import {
  getEmbeddedChart, runQueryWithFilters,
} from "../slices/chart";
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
import Container from "../components/Container";
import Row from "../components/Row";
import Text from "../components/Text";
import Callout from "../components/Callout";
import { LuFilter, LuXCircle } from "react-icons/lu";
import { useParams } from "react-router";
import { useDispatch } from "react-redux";

const pageHeight = window.innerHeight;

/*
  This container is used for embedding charts in other websites
*/
function EmbeddedChart() {
  const [loading, setLoading] = useState(false);
  const [chart, setChart] = useState({});
  const [error, setError] = useState(false);
  const [conditions, setConditions] = useState([]);
  const [dataLoading, setDataLoading] = useState(false);

  const params = useParams();
  const dispatch = useDispatch();

  useInterval(() => {
    setDataLoading(true);
    dispatch(getEmbeddedChart({ chart_id: params.chartId }))
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
      dispatch(getEmbeddedChart({ chart_id: params.chartId }))
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
    dispatch(runQueryWithFilters({ project_id: chart.project_id, chart_id: chart.id, filters: newConditions }))
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
    dispatch(runQueryWithFilters({ project_id: chart.project_id, chart_id: chart.id, filters: newConditions }))
      .then((data) => {
        setChart(data);
      });
  };

  const _checkIfFilters = () => {
    let filterCount = 0;
    chart.ChartDatasetConfigs.forEach((cdc) => {
      if (cdc.Dataset?.conditions) {
        filterCount += cdc.Dataset.conditions.filter((c) => c.exposed).length;
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
        <Container justify="center" style={{ ...styles.loaderContainer, paddingTop: 50 }}>
          <Row justify="center" align="center">
            <CircularProgress color="default" />
          </Row>
        </Container>
      </>
    );
  }

  if (error) {
    return (
      <Callout
        title={"Error loading the chart"}
        text="The chart might not be public in the Chartbrew dashboard."
      />
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
      <Container size="fluid" className="pl-unit-sm" style={styles.header(chart.type)} xl>
        <Row justify="space-between">
          <div style={{ display: "flex", alignItems: "center" }}>
            <Text b size="1.1em" css={{ color: "$text", lineHeight: "$xs" }}>{chart.name}</Text>
            <Spacer x={0.5} />
            {chart.ChartDatasetConfigs && conditions.map((c) => {
              return (
                <Chip
                  color="primary"
                  variant={"flat"}
                  key={c.id}
                  size="sm"
                  className={"py-0 px-5"}
                  endContent={(
                    <Link onClick={() => _onClearFilter(c)} css={{ color: "$text" }}>
                      <LuXCircle />
                    </Link>
                  )}
                >
                  {c.type !== "date" && `${c.value}`}
                  {c.type === "date" && format(new Date(c.value), "Pp", { locale: enGB })}
                </Chip>
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
                        <LuFilter />
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
            datasets={chart.ChartDatasetConfigs}
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
                    <CircularProgress aria-label="loading" size="xs" />
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
                <CircularProgress aria-label="loading" />
                <Spacer x={0.2} />
                <Text small css={{ color: "$accents6" }}>{"Updating..."}</Text>
              </>
            )}
          </div>
          {chart.showBranding && (
            <Link href="https://chartbrew.com" target="_blank" rel="noreferrer" className={"text-primary items-end"}>
              <img
                src={logo}
                width="15"
                alt="Chartbrew logo"
              />
              <Spacer x={0.2} />
              <Text small color="gray">
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
  runQueryWithFilters: PropTypes.func.isRequired,
};

export default EmbeddedChart;
