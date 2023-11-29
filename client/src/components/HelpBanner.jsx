import React from "react";
import PropTypes from "prop-types";
import {
  Card, CardBody, CardFooter, CardHeader, Divider, Image, Link, Spacer,
} from "@nextui-org/react";
import { FcGraduationCap } from "react-icons/fc";

import Row from "./Row";
import Text from "./Text";

const bannerData = {
  api: {
    title: "Learn how to visualize your API data with Chartbrew",
    description: "Chartbrew can connect to your API data and create charts that tell you more about your data.",
    url: "https://chartbrew.com/blog/how-to-visualize-simple-analytics-data-with-chartbrew/",
    info: "5 min read",
  },
}

function HelpBanner(props) {
  const { type, imageUrl } = props;

  const _onOpenHelp = () => {
    // open the url in a new tab
    window.open(bannerData[type].url, "_blank");
  };

  return (
    <Card
      isPressable
      isHoverable
      onClick={() => _onOpenHelp()}
      className="max-w-[400px]"
      shadow="sm"
    >
      <CardHeader className="flex gap-3">
        <Image
          src={imageUrl}
          width={80}
          height={80}
          radius="sm"
        />
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
          <FcGraduationCap size={24} />
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
