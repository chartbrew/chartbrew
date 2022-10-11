import React from "react";
import PropTypes from "prop-types";
import Tour from "reactour";
import {
  Button, Container, Row, Spacer, Text
} from "@nextui-org/react";
import { FaPlug } from "react-icons/fa";
import { Edit, Setting, TickSquare } from "react-iconly";

import { secondary } from "../../../config/colors";
import showTutorial from "../../../config/tutorials";

function Walkthrough(props) {
  const {
    tourActive, closeTour, userTutorials,
  } = props;

  const isActive = (type) => {
    return showTutorial(type, userTutorials);
  };

  return (
    <>
      {tourActive && (
        <Tour
          accentColor={secondary}
          steps={steps[tourActive]}
          isOpen={isActive(tourActive)}
          onRequestClose={closeTour}
          closeWithMask={false}
        />
      )}
    </>
  );
}

const steps = {
  addchart: [
    {
      selector: ".chart-name-tut",
      content: () => (
        <Container>
          <Row>
            <Text color="black">{"You can change the summary of the chart at any time by clicking on the text."}</Text>
          </Row>
          <Row>
            <Text color="black">{"This will be displayed above your chart in the dashboard."}</Text>
          </Row>
        </Container>
      ),
    },
    {
      selector: ".chart-actions-tut",
      content: () => (
        <Container>
          <Row>
            <Text color="black">{"The chart saves automatically and the button will be green when everything is synced."}</Text>
          </Row>
          <Row>
            <Text color="black">{" You have the option to manually save from here and to change the draft status of the chart at any time."}</Text>
          </Row>
        </Container>
      ),
    },
    {
      selector: ".chart-type-tut",
      content: () => (
        <Container>
          <Row>
            <Text color="black">{"When you have the data set up, your chart will appear here. You can also query for new data or refresh the style at any time."}</Text>
          </Row>
        </Container>
      ),
    },
    {
      selector: ".add-dataset-tut",
      content: ({ close }) => ( // eslint-disable-line
        <Container>
          <Row>
            <Text color="black">{"Here is the place where you prepare the data for brewing. You can create different datasets, connect them to data sources and get the data flowing."}</Text>
          </Row>
          <Row>
            <Text color="black">{"You will need at least one dataset to generate a chart. Create one now and get acquainted with how it works 👩‍💻"}</Text>
          </Row>
          <Spacer y={0.5} />
          <Row>
            <Button
              color="success"
              onClick={close}
              auto
            >
              Brewing time!
            </Button>
          </Row>
        </Container>
      ),
    },
  ],
  dataset: [
    {
      selector: ".dataset-manage-tut",
      content: () => (
        <Container>
          <Row>
            <Text color="black">{"Each dataset will need to be connected to one of your data sources. Chartbrew will then know where to fetch the data from."}</Text>
          </Row>
          <Row>
            <Text color="black">
              {"You can always create new connections by clicking the "}
              <FaPlug />
              {" button."}
            </Text>
          </Row>
          <Row>
            <Text color="black">{"Select one of your connections from the dropdown list to get started."}</Text>
          </Row>
        </Container>
      ),
    },
    {
      selector: ".dataset-actions-tut",
      content: ({ close }) => ( // eslint-disable-line
        <Container>
          <Row>
            <Text color="black">{"The dataset settings are saved automatically, but you can always save manually from here."}</Text>
          </Row>
          <Row>
            <Text color="black">{"If you no longer need one of the datasets, the delete button is also here for you."}</Text>
          </Row>
          <Spacer y={0.5} />
          <Row>
            <Button
              iconRight={<FaPlug />}
              color="success"
              onClick={close}
              auto
            >
              Time to connect
            </Button>
          </Row>
        </Container>
      ),
    }
  ],
  apibuilder: [
    {
      selector: ".apibuilder-route-tut",
      content: () => (
        <Container>
          <Row>
            <Text color="black">{"Here, you will have to enter the route and query parameters that you need for your API request."}</Text>
          </Row>
        </Container>
      ),
    },
    {
      selector: ".apibuilder-menu-tut",
      content: () => (
        <Container>
          <Row>
            <Text color="black">{"You can further configure your requests by adding headers, a body of data and you can also paginate requests if the API allows it."}</Text>
          </Row>
        </Container>
      ),
    },
    {
      selector: ".apibuilder-headers-tut",
      content: () => (
        <Container>
          <Row>
            <Text color="black">{"The global headers are enabled by default. These are set in the Connections page and it's best used for headers that need to be included often, such as the 'Authorization' header."}</Text>
          </Row>
        </Container>
      ),
    },
    {
      selector: ".apibuilder-type-tut",
      content: () => (
        <Container>
          <Row>
            <Text color="black">{"You can select what type of API request you want to send from here."}</Text>
          </Row>
        </Container>
      ),
    },
    {
      selector: ".apibuilder-request-tut",
      content: () => (
        <Container>
          <Row>
            <Text color="black">{"Once you have everything ready, send the request away and get the data."}</Text>
          </Row>
        </Container>
      ),
    },
    {
      selector: ".apibuilder-result-tut",
      content: ({ close }) => ( // eslint-disable-line
        <Container>
          <Row>
            <Text color="black">{"If the request is successful you will see the JSON data in this section."}</Text>
          </Row>
          <Row>
            <Text color="black">{"If the API supports it, you will also get the error message in case the request is not successful."}</Text>
          </Row>
          <Spacer y={0.5} />
          <Row>
            <Button
              icon={<Setting />}
              color="success"
              onClick={close}
              auto
            >
              Start configuring
            </Button>
          </Row>
        </Container>
      ),
    },
  ],
  mongobuilder: [
    {
      selector: ".mongobuilder-query-tut",
      content: () => (
        <Container>
          <Row>
            <Text color="black">
              {"Here you can enter your MongoDB query to get data from your database. You can have a look at "}
              <a
                href="https://docs.mongodb.com/manual/tutorial/query-documents/"
                target="_blank"
                rel="noopener noreferrer"
              >
                {"MongoDB's documentation on how to query documents."}
              </a>
            </Text>
          </Row>
          <Row>
            <Text color="black">
              {"Note that you should always start the query with: "}
              <pre>{"collection(\"your_collection\")..."}</pre>
            </Text>
          </Row>
        </Container>
      ),
    },
    {
      selector: ".mongobuilder-buttons-tut",
      content: () => (
        <Container>
          <Row>
            <Text color="black">{"Once you write the query, you can run it from here."}</Text>
          </Row>
          <Row>
            <Text color="black">{"To make things easier later on you can also save the query and use it for other charts."}</Text>
          </Row>
        </Container>
      ),
    },
    {
      selector: ".mongobuilder-saved-tut",
      content: () => (
        <Container>
          <Row>
            <Text color="black">{"Once you save some queries they will appear in this section. You can update and delete them from here as well."}</Text>
          </Row>
        </Container>
      ),
    },
    {
      selector: ".mongobuilder-result-tut",
      content: ({ close }) => ( // eslint-disable-line
        <Container>
          <Row>
            <Text color="black">{"The JSON-formatted data will appear here when you run a successful query."}</Text>
          </Row>
          <Spacer y={0.5} />
          <Row>
            <Button
              iconRight={<Edit />}
              color="success"
              onClick={close}
              auto
            >
              Write a query
            </Button>
          </Row>
        </Container>
      ),
    },
  ],
  sqlbuilder: [
    {
      selector: ".sqlbuilder-query-tut",
      content: () => (
        <Container>
          <Row>
            <Text color="black">
              {"Here you can enter your SQL query to get data from your database."}
            </Text>
          </Row>
          <Row>
            <Text color="black">
              {"As an example, it should look like this: "}
              <pre>{"SELECT * from users WHERE age > 43;"}</pre>
            </Text>
          </Row>
        </Container>
      ),
    },
    {
      selector: ".sqlbuilder-buttons-tut",
      content: () => (
        <Container>
          <Row>
            <Text color="black">{"Once you write the query, you can run it from here."}</Text>
          </Row>
          <Row>
            <Text color="black">{"To make things easier later on you can also save the query and use it for other charts."}</Text>
          </Row>
        </Container>
      ),
    },
    {
      selector: ".sqlbuilder-saved-tut",
      content: () => (
        <Container>
          <Row>
            <Text color="black">{"Once you save some queries they will appear in this section. You can update and delete them from here as well."}</Text>
          </Row>
        </Container>
      ),
    },
    {
      selector: ".sqlbuilder-result-tut",
      content: ({ close }) => ( // eslint-disable-line
        <Container>
          <Row>
            <Text color="black">{"The JSON-formatted data will appear here when you run a successful query."}</Text>
          </Row>
          <Spacer y={0.5} />
          <Row>
            <Button
              iconRight={<Edit />}
              color="success"
              onClick={close}
              auto
            >
              Write a query
            </Button>
          </Row>
        </Container>
      ),
    },
  ],
  firestoreBuilder: [
    {
      selector: ".firestorebuilder-collections-tut",
      content: () => (
        <Container>
          <Row>
            <Text color="black">
              {"You Firestore collections will appear here."}
            </Text>
          </Row>
          <Row>
            <Text color="black">
              {"In case you can't see them or you added a new collection just now, press the refresh link to get the latest data."}
            </Text>
          </Row>
          <Row>
            <Text color="black">
              {"Once you see the collection you want to use, just click on it to select it."}
            </Text>
          </Row>
        </Container>
      ),
    },
    {
      selector: ".firestorebuilder-request-tut",
      content: () => (
        <Container>
          <Row>
            <Text color="black">{"Once you select a collection, click here to get data from your Firestore database."}</Text>
          </Row>
        </Container>
      ),
    },
    {
      selector: ".firestorebuilder-result-tut",
      content: () => (
        <Container>
          <Row>
            <Text color="black">{"You can see the results of your query in JSON format over here."}</Text>
          </Row>
        </Container>
      ),
    },
    {
      selector: ".firestorebuilder-query-tut",
      content: ({ close }) => ( // eslint-disable-line
        <Container>
          <Row>
            <Text color="black">{"One last thing!"}</Text>
          </Row>
          <Row>
            <Text color="black">{"You can query the data from your Firestore database using the built-in query editor here."}</Text>
          </Row>
          <Row>
            <Text color="black">{"You will have to select which field you want to query on, the operation, and value(s)."}</Text>
          </Row>
          <Row>
            <Text color="black">{"Chartbrew supports all Firestore operations, but more custom query options will be added soon."}</Text>
          </Row>
          <Spacer y={0.5} />
          <Row>
            <Button
              color="success"
              onClick={close}
              auto
            >
              Awesome!
            </Button>
          </Row>
        </Container>
      ),
    },
  ],
  requestmodal: [
    {
      selector: ".requestmodal-fields-tut",
      content: ({ close }) => ( // eslint-disable-line
        <Container>
          <Row>
            <Text color="black">{"Great! You have some data now."}</Text>
          </Row>
          <Row>
            <Text>{"You can explore your data and press 'Done' to continue configuring your chart."}</Text>
          </Row>
          <Spacer y={0.5} />
          <Row>
            <Button
              color="success"
              onClick={close}
              auto
            >
              Gotcha
            </Button>
          </Row>
        </Container>
      ),
    },
  ],
  datasetdata: [
    {
      selector: ".datasetdata-axes-tut",
      content: () => (
        <Container>
          <Row>
            <Text color="black">{"This is the place where you can configure what data appears on the chart axes. You will notice that the chart preview will update automatically when you change these."}</Text>
          </Row>
          <Row>
            <Text color="black">{"You can also apply an operation on the Y axis, like count, sum and average."}</Text>
          </Row>
        </Container>
      )
    },
    {
      selector: ".datasetdata-filters-tut",
      content: () => (
        <Container>
          <Row>
            <Text color="black">{"To give you more flexibility, Chartbrew also supports a wide range of filters."}</Text>
          </Row>
          <Row>
            <Text color="black">{"You can select any field from your dataset and filter based on the given values and operations."}</Text>
          </Row>
        </Container>
      )
    },
    {
      selector: ".datasetdata-date-tut",
      content: ({ close }) => ( // eslint-disable-line
        <Container>
          <Row>
            <Text color="black">{"To simplify the date filtering across datasets, Chartbrew allows you to select date ranges to filter your data."}</Text>
          </Row>
          <Row>
            <Text color="black">
              {"If this is your use-case, select a date field here and then you can use the"}
              <strong>{" global date settings "}</strong>
              {"on the right to filter your data."}
            </Text>
          </Row>
          <Spacer y={0.5} />
          <Row>
            <Button
              iconRight={<TickSquare />}
              color="success"
              onClick={close}
              auto
            >
              All done
            </Button>
          </Row>
        </Container>
      )
    }
  ]
};

Walkthrough.defaultProps = {
  userTutorials: {},
};

Walkthrough.propTypes = {
  tourActive: PropTypes.string.isRequired,
  closeTour: PropTypes.func.isRequired,
  userTutorials: PropTypes.object,
};

export default Walkthrough;
