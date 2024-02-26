import React, { useState, useEffect } from "react";
import PropTypes from "prop-types";
import {
  Popover, Link, Spacer, CircularProgress, Chip, PopoverTrigger, PopoverContent,
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
import Row from "../components/Row";
import Text from "../components/Text";
import Callout from "../components/Callout";
import { LuListFilter, LuXCircle } from "react-icons/lu";
import { useParams } from "react-router";
import { useDispatch } from "react-redux";
import KpiMode from "./Chart/components/KpiMode";

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
  const [redraw, setRedraw] = useState(true);

  const params = useParams();
  const dispatch = useDispatch();

  useInterval(() => {
    setDataLoading(true);
    dispatch(getEmbeddedChart({ embed_id: params.chartId }))
      .then((chart) => {
        setChart(chart.payload);
        setDataLoading(false);
      })
      .catch(() => {
        setDataLoading(false);
      });
  }, chart?.autoUpdate ? chart.autoUpdate * 1000 : null);

  useEffect(() => {
    // change the background color to transparent
    document.body.style.backgroundColor = "transparent";

    setLoading(true);
    setTimeout(() => {
      dispatch(getEmbeddedChart({ embed_id: params.chartId }))
        .then((chart) => {
          setChart(chart.payload);
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
      if (cdc.Dataset?.conditions?.length > 0) {
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
        <div className="container mx-auto pt-10">
          <Row justify="center" align="center">
            <CircularProgress color="default" />
          </Row>
        </div>
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
      <div className="pl-unit-sm w-full" style={styles.header(chart.type)}>
        <Row justify="space-between">
          <div style={{ display: "flex", alignItems: "center" }}>
            <Text b className={"text-default"}>{chart.name}</Text>
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
              {_checkIfFilters() && (
                <Popover>
                  <PopoverTrigger>
                    <Link className="text-gray-500">
                      <LuListFilter />
                    </Link>
                  </PopoverTrigger>
                  <PopoverContent>
                    <ChartFilters
                      chart={chart}
                      onAddFilter={_onAddFilter}
                      onClearFilter={_onClearFilter}
                      conditions={conditions}
                    />
                  </PopoverContent>
                </Popover>
              )}
            </div>
          )}
        </Row>
      </div>
      <Spacer y={1} />
      {chart && (
        <div className="h-[calc(100vh-100px)]">
          {chart.type === "line" && (
            <LineChart
              chart={chart}
              redraw={redraw}
              redrawComplete={() => setRedraw(false)}
              embedded
            />
          )}
          {chart.type === "bar" && (
            <BarChart chart={chart} height={pageHeight - 100} />
          )}
          {chart.type === "pie" && (
            <PieChart
              chart={chart}
              height={pageHeight - 100}
            />
          )}
          {chart.type === "doughnut" && (
            <DoughnutChart
              chart={chart}
              height={pageHeight - 100}
            />
          )}
          {chart.type === "radar" && (
            <RadarChart
              chart={chart}
              height={pageHeight - 100}
            />
          )}
          {chart.type === "polar" && (
            <PolarChart
              chart={chart}
              height={pageHeight - 100}
            />
          )}
          {chart.type === "table" && (
            <TableContainer
              height={pageHeight - 100}
              tabularData={chart.chartData}
              embedded
              datasets={chart.ChartDatasetConfigs}
            />
          )}
          {(chart.type === "kpi" || chart.type === "avg") && (
            <KpiMode chart={chart} />
          )}
        </div>
      )}
      <Spacer y={4} />
      <div>
        <Row justify="space-between" align="center">
          <div style={styles.row}>
            {!loading && (
              <>
                {dataLoading && (
                  <>
                    <CircularProgress aria-label="loading" classNames={{ svg: "w-4 h-4" }} />
                    <Spacer x={1} />
                    <span className="text-default-500 text-xs">{"Updating..."}</span>
                  </>
                )}
                {!dataLoading && (
                  <span className="text-default-500 text-xs">
                    {`${_getUpdatedTime(chart.chartDataUpdated)}`}
                  </span>
                )}
              </>
            )}
            {loading && (
              <>
                <CircularProgress aria-label="loading" classNames={{ svg: "w-4 h-4" }} />
                <Spacer x={1} />
                <span className="text-default-500 text-xs">{"Updating..."}</span>
              </>
            )}
          </div>
          {chart.showBranding && (
            <Link href="https://chartbrew.com" target="_blank" rel="noreferrer" className={"text-primary items-center"}>
              <img
                src={logo}
                width="15"
                alt="Chartbrew logo"
              />
              <Spacer x={0.2} />
              <span className="text-default-500 text-xs">
                <strong>Chart</strong>
                brew
              </span>
            </Link>
          )}
        </Row>
      </div>
    </div>
  );
}

const styles = {
  container: {
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
