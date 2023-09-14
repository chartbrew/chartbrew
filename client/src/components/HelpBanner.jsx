import React from "react";
import PropTypes from "prop-types";
import {
  Card, CardBody, CardFooter, CardHeader, Divider, Image, Link, Spacer,
} from "@nextui-org/react";
import { FcGraduationCap } from "react-icons/fc";

import Row from "./Row";
import Text from "./Text";

function HelpBanner(props) {
  const {
    title, description, url, info, imageUrl
  } = props;

  const _onOpenHelp = () => {
    // open the url in a new tab
    window.open(url, "_blank");
  };

  return (
    <Card
      variant="bordered"
      isPressable
      isHoverable
      onClick={() => _onOpenHelp()}
      className="max-w-[400px] border-1 border-content3"
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
          <Link className={"text-lg font-bold text-start"} href={url} target="_blank" rel="noopener">{title}</Link>
        </div>
      </CardHeader>
      <Divider />
      <CardBody>
        <div>
          <Text>
            {description}
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
            {info}
          </Text>
        </Row>
      </CardFooter>
    </Card>
  );
}

HelpBanner.propTypes = {
  title: PropTypes.string.isRequired,
  description: PropTypes.string.isRequired,
  url: PropTypes.string.isRequired,
  imageUrl: PropTypes.string.isRequired,
  info: PropTypes.string.isRequired,
};

export default HelpBanner;
