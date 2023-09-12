import React from "react";
import PropTypes from "prop-types";
import {
  Card, CardBody, Image, Link, Spacer,
} from "@nextui-org/react";
import { FcGraduationCap } from "react-icons/fc";

import Row from "./Row";
import Text from "./Text";
import Container from "./Container";

function HelpBanner(props) {
  const {
    title, description, url, info, imageUrl
  } = props;

  const _onOpenHelp = () => {
    // open the url in a new tab
    window.open(url, "_blank");
  };

  return (
    <Container size={"sm"}>
      <div className="grid grid-cols-12">
        <Card
          variant="bordered"
          isPressable
          isHoverable
          onClick={() => _onOpenHelp()}
        >
          <CardBody>
            <div className="grid grid-cols-12">
              <div className="col-span-12 md:col-span-9 py-20 px-20 flex-col">
                <Text size="h4" className={"py-5"}>
                  <Link className={"text-default"} href={url} target="_blank" rel="noopener">{title}</Link>
                </Text>
                <Text>
                  {description}
                </Text>
                <Spacer y={0.5} />
                <Row align="center">
                  <FcGraduationCap size={24} />
                  <Spacer x={0.3} />
                  <Text
                    css={{ py: 5 }}
                    color="primary"
                    target="_blank"
                    variant="b"
                  >
                    {info}
                  </Text>
                </Row>
              </div>
              <div className="md:col-span-3 sm:hidden">
                <Image
                  src={imageUrl}
                  objectFit="cover"
                  width={200}
                  height={200}
                />
              </div>
            </div>
          </CardBody>
        </Card>
      </div>
    </Container>
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
