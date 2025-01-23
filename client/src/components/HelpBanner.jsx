import React from "react";
import PropTypes from "prop-types";
import {
  Card, CardBody, CardFooter, CardHeader, Divider, Link, Spacer,
} from "@heroui/react";
import { LuGraduationCap } from "react-icons/lu";

import Row from "./Row";
import Text from "./Text";

const bannerData = {
  api: {
    title: "Learn how to visualize your API data with Chartbrew",
    description: "Chartbrew can connect to your API data and create charts that tell you more about your data.",
    url: "https://chartbrew.com/blog/how-to-visualize-simple-analytics-data-with-chartbrew/",
    info: "5 min read",
  },
  mongodb: {
    title: "How to visualize your MongoDB data with Chartbrew",
    description: "Chartbrew can connect to your MongoDB database and create charts that tell you more about your data.",
    url: "https://chartbrew.com/blog/how-to-visualize-your-mongodb-data-with-chartbrew/",
    info: "7 min read",
  },
  postgres: {
    title: "How to visualize your Postgres data with Chartbrew",
    description: "Chartbrew can connect to your Postgres database and create charts that tell you more about your data.",
    url: "https://chartbrew.com/blog/how-to-visualize-postgresql-data-with-chartbrew/",
    info: "5 min read",
  },
  mysql: {
    title: "How to visualize your MySQL data with Chartbrew",
    description: "Chartbrew can connect to your MySQL database and create charts that tell you more about your data.",
    url: "https://chartbrew.com/blog/visualize-mysql-data-with-chartbrew/",
    info: "5 min read",
  },
  firestore: {
    title: "How to visualize your Firestore data with Chartbrew",
    description: "Connect, query, and visualize your Firestore data with Chartbrew. A step-by-step tutorial on how you can start creating your insightful dashboard.",
    url: "https://chartbrew.com/blog/how-to-visualize-your-firestore-data-with-chartbrew/",
    info: "5 min read",
  },
  realtimedb: {
    title: "How to visualize your Realtime Database data with Chartbrew",
    description: "Connect to Firebase Realtime Database to create reports and visualize your data. This tutorial will show you how to connect and create your first chart.",
    url: "https://chartbrew.com/blog/visualize-your-firebase-realtime-database-with-chartbrew/",
    info: "5 min read",
  },
  googleAnalytics: {
    title: "How to visualize your Google Analytics data with Chartbrew",
    description: "Learn how you can power up your Chartbrew dashboards with the Google Analytics integration. Get to know your data with Chartbrew.",
    url: "https://chartbrew.com/blog/integrate-google-analytics-ga4-with-your-chartbrew-dashboards/",
    info: "5 min read",
  },
  strapi: {
    title: "How to visualize your Strapi data with Chartbrew",
    description: "Chartbrew can connect to your Strapi's API to fetch data that can be visualized in a dashboard. You can use the data from your API to create charts and tables that will be updated in real-time.",
    url: "https://chartbrew.com/blog/create-your-strapi-visualization-dashboard-with-chartbrew/",
    info: "5 min read",
  },
  customerio: {
    title: "How to visualize your Customer.io data with Chartbrew",
    description: "Chartbrew can now integrate with Customer.io to get data about customers and visualize it with beautiful charts and live reports.",
    url: "https://chartbrew.com/blog/visualize-and-report-on-customerio-data-with-chartbrew/",
    info: "7 min read",
  },
  timescaledb: {
    title: "How to visualize your TimescaleDB data with Chartbrew",
    description: "Chartbrew can connect to your TimescaleDB database and create charts that tell you more about your data.",
    url: "https://chartbrew.com/blog/connect-and-visualize-timescaledb-data-with-chartbrew/",
    info: "5 min read",
  },
  supabasedb: {
    title: "How to visualize your Supabase data with Chartbrew",
    description: "Chartbrew can connect to your Supabase database and create charts that tell you more about your data.",
    url: "https://chartbrew.com/blog/connect-and-visualize-supabase-database-with-chartbrew/",
    info: "5 min read",
  },
  rdsPostgres: {
    title: "How to connect Amazon RDS Postgres to Chartbrew",
    description: "Chartbrew can connect to your RDS Postgres database and create charts that tell you more about your data.",
    url: "https://chartbrew.com/blog/how-to-connect-and-visualize-amazon-rds-with-chartbrew/",
    info: "5 min read",
  },
  rdsMysql: {
    title: "How to connect Amazon RDS MySQL to Chartbrew",
    description: "Chartbrew can connect to your RDS MySQL database and create charts that tell you more about your data.",
    url: "https://chartbrew.com/blog/how-to-connect-and-visualize-amazon-rds-with-chartbrew/",
    info: "5 min read",
  },
}

function HelpBanner(props) {
  const { type, imageUrl } = props;

  const _onOpenHelp = () => {
    // open the url in a new tab
    window.open(bannerData[type].url, "_blank");
  };

  if (!bannerData[type]) {
    return null;
  }

  return (
    <Card
      isPressable
      isHoverable
      onClick={() => _onOpenHelp()}
      className="max-w-[400px]"
      shadow="sm"
    >
      <CardHeader className="flex gap-3">
        <div>
          <img
            src={imageUrl}
            width={100}
            height={80}
            radius="sm"
          />
        </div>
        <div>
          <Link
            className={"font-bold text-start"}
            href={bannerData[type].url}
            target="_blank"
            rel="noopener"
          >
            {bannerData[type].title}
          </Link>
        </div>
      </CardHeader>
      <Divider />
      <CardBody>
        <div>
          <Text>
            {bannerData[type].description}
          </Text>
        </div>
      </CardBody>
      <Divider />
      <CardFooter>
        <Row align="center">
          <LuGraduationCap size={24} />
          <Spacer x={1} />
          <Text
            css={{ py: 5 }}
            color="default"
            target="_blank"
          >
            {bannerData[type].info}
          </Text>
        </Row>
      </CardFooter>
    </Card>
  );
}

HelpBanner.propTypes = {
  type: PropTypes.string,
  imageUrl: PropTypes.string.isRequired,
};

HelpBanner.defaultProps = {
  type: "api",
};

export default HelpBanner;
