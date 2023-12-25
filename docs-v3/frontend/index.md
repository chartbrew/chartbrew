---

canonicalUrl: https://docs.chartbrew.com/frontend/

meta: 
    - property: og:url
      content: https://docs.chartbrew.com/frontend/

---

# Chartbrew Frontend

## Structure

```
|-- .eslintrc.json
|-- package.json
|-- config                          # Webpack, jest, etc config files
|-- public                          # Contains the entry index.html file
|-- scripts                         # React scripts (build, run, etc)
|-- src
    |-- actions                     # Redux actions
    |-- assets                      # Any assets (images and stuff)
    |-- components                  # React (dumb) components that should be re-usable
    |-- config                      # various config files with globals, colors, misc functions
    |-- containers                  # React smart components (usually pages that contain multiple components)
    |-- reducers                    # Redux reducers

```

## How this works

If you never used [React Redux](https://react-redux.js.org/) before, it's strongly recommended to run a [quick-start](https://react-redux.js.org/introduction/quick-start) before attempting to modify anything in the front-end.

The main point on future developments will be to always develop with the [props down, events up](https://jasonformat.com/props-down-events-up/) mentality. In Chartbrew this means that a container should send the props to a component and the component can call any events that were passed down by the container. The events will run in the parent component.

**The new components should be functional and use [React Hooks.](https://reactjs.org/docs/hooks-intro.html)**

::: warning
Currently, the containers are quite huge and some components are not as dumb as they should be. This will be improved with future updates.
:::

## Example

The following example will create a dummy container with a component, reducer and action.

### Actions

The actions are placed in the `actions/` folder.

```javascript
// actions/brew.js

import { API_HOST } from "../config/settings";

export const FETCHING_BREW = "FETCHING_BREW"; // this is the type of action, used for identification
export const FETCHED_BREW = "FETCHED_BREW";

export function getBrew(id) {
  return (dispatch) => { // dispatch is used to send the action to the reducer
    const url = `${API_HOST}/brew/${id}`;
    const method = "GET";
    const headers = new Headers({
      "Accept": "application/json",
    });

    dispatch({ type: FETCHING_BREW });
    return fetch(url, { method, headers }) // like in the backend code, Promises are preferred
      .then((response) => {
        if (!response.ok) {
          return new Promise((resolve, reject) => reject(response.statusText));
        }

        return response.json();
      })
      .then((brew) => {
        dispatch({ type: FETCHED_BREW, brew }); // dispatching the action together with the payload
        return new Promise((resolve) => resolve(brew));
      })
      .catch((error) => {
        return new Promise((resolve, reject) => reject(error));
      });
  };
}
```

### Reducer

The reducers are placed in the `reducers/` folder and registered in the `index` file there.

```javascript
// reducers/brew.js

import {
  FETCHING_BREW,
  FETCHED_BREW,
} from "../actions/brew";

export default function brew((state) = {
  loading: false,
  data: {},
}, action) {
  switch (action.type) {
    case FETCHING_BREW:
      return { ...state, loading: true };
    case FETCHED_BREW:
      // remember the "brew" payload dispatched from the action
      return { ...state, loading: false, data: action.brew };
    default:
      return state;
  }
}
```

Don't forget to register this reducer in the `index.js` file in the same folder.

### Component

This will be an example component to show the name and flavour of the brew and a simple button with an event attached.

```javascript
// components/BrewCard.js

import React from "react";
import PropTypes from "prop-types";
import { Button } from "@nextui-org/react";

function BrewCard(props) {
  const { brew, mixBrew } = props;

  return (
    <div style={styles.container}>
      <h2>{{brew.name}}</h2>
      <p>{{brew.flavour}}</p>
      <Button onClick={mixBrew} auto>
        Mix the Brew
      </Button>
    </div>
  );
}

const styles = {
  container: {
    flex: 1,
  },
};

BrewCard.defaultProps = {
  mixBrew: () => {},
};

BrewCard.propTypes = {
  brew: PropTypes.object.isRequired,
  mixBrew: PropTypes.func,
};

export default BrewCard;
```

### Container

This will be a page showing the BrewCard component after getting calling the `getBrew` action.

```javascript
import React, { useState, useEffect } from "react";
import PropTypes from "prop-types";
import { connect } from "react-redux";
import {
  Container, Loading, Row, Dimmer, Spacer, Text, Card,
} from "@nextui-org/react";

import { getBrew as getBrewAction } from "../actions/brew";

function BrewPage(props) {
  const { getBrew, brew, loading } = props;
  const [mixed, setMixed] = useState(false);

  useEffect(() => {
    getBrew(1);
  }, []);

  // container functionality should be prepended with a '_'
  const _onMixBrew = () => {
    setMixed(true);
  };

  if (loading) {
    return (
      <Container sm justify="center">
        <Row justify="center">
          <Loading size="lg" />
        </Row>
      </Container>
    );
  }

  return (
    <Container>
      <Row justify="center">
        <Text h2>The Brew</Text>
      </Row>
      <Spacer y={1} />
      <Row justify="center">
      <Card>
        <Card.Body>
          <BrewCard brew={brew} mixBrew={_onMixBrew} />
        </Card.Body>
        <Card.Footer>
          {mixed && (
            <Text color="success">
              The brew is mixed
            </Text>
          )}
        </Card.Footer>
      </Row>
    </Container>
  );
}

BrewPage.propTypes = {
  getBrew: PropTypes.func.isRequired,
  brew: PropTypes.object.isRequired,
};

const mapStateToProps = (state) => {
  return {
    brew: state.brew.data,
    loading: state.brew.loading,
  };
};

const mapDispatchToProps = (dispatch) => {
  return {
    getBrew: (id) => dispatch(getBrewAction(id)),
  };
};

export default connect(mapStateToProps, mapDispatchToProps)(BrewPage);
```

## Styling

Chartbrew is using NextUI for the components. 

[The react components usable within Chartbrew can be found here.](https://nextui.org/)

For any changes to the general feel of the site you can modify Sematic's global variables in `src/theme.js`. You can check out the theming docs on [NextUI's website](https://nextui.org/docs/theme/customize-theme).
