import {
  FETCHING_CONNECTION,
  FETCH_CONNECTION_FAIL,
  FETCH_ALL_CONNECTIONS,
  FETCH_CONNECTION_SUCCESS,
} from "../actions/connection";

export default function connection(state = {
  loading: false,
  error: false,
  data: [],
}, action) {
  switch (action.type) {
    case FETCHING_CONNECTION:
      return { ...state, loading: true };
    case FETCH_ALL_CONNECTIONS:
      return { ...state, loading: false, data: action.connections };
    case FETCH_CONNECTION_SUCCESS:
      // look for existing connection in the data array and replace it if it exists
      let indexFound = -1;
      for (let i = 0; i < state.data.length; i++) {
        if (state.data[i].id === parseInt(action.connection.id, 10)) {
          indexFound = i;
          break;
        }
      }
      const newData = [...state.data];
      if (indexFound > -1) {
        newData[indexFound] = action.connection;
      } else {
        newData.push(action.connection);
      }
      return { ...state, loading: false, data: newData };
    case FETCH_CONNECTION_FAIL:
      return { ...state, loading: false, error: true };
    default:
      return state;
  }
}
