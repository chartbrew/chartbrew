import React from "react";
import PropTypes from "prop-types";
import {
  Card, Grid, Text, Link, Spacer, Row
} from "@nextui-org/react";
import { FcGraduationCap } from "react-icons/fc";

function HelpBanner(props) {
  const {
    title, description, url, info, imageUrl
  } = props;

  const _onOpenHelp = () => {
    // open the url in a new tab
    window.open(url, "_blank");
  };

  return (
    <Grid.Container>
      <Grid xs={12} md={8}>
        <Card
          variant="bordered"
          isPressable
          isHoverable
          onClick={() => _onOpenHelp()}
        >
          <Card.Body css={{ p: 0 }}>
            <Grid.Container>
              <Grid xs={12} sm={9} css={{ px: 20, py: 20 }} direction="column">
                <Text h4 css={{ py: 5 }}>
                  <Link css={{ color: "$text" }} href={url} target="_blank" rel="noopener">{title}</Link>
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
                    b
                  >
                    {info}
                  </Text>
                </Row>
              </Grid>
              <Grid xs={0} sm={3}>
                <Card.Image
                  src={imageUrl}
                  objectFit="cover"
                  width={200}
                  height={200}
                />
              </Grid>
            </Grid.Container>
          </Card.Body>
        </Card>
      </Grid>
    </Grid.Container>
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
