import {
  FETCHING_QUERY,
  FETCH_QUERY_FAIL,
  FETCH_ALL_QUERIES,
  FETCH_QUERY_SUCCESS,
} from "../actions/savedQuery";

export default function savedQuery(state = {
  loading: false,
  error: false,
  data: [],
}, action) {
  switch (action.type) {
    case FETCHING_QUERY:
      return { ...state, loading: true };
    case FETCH_ALL_QUERIES:
      return { ...state, loading: false, data: action.savedQueries };
    case FETCH_QUERY_SUCCESS:
      // look for existing connection in the data array and replace it if it exists
      let indexFound = -1;
      for (let i = 0; i < state.data.length; i++) {
        if (state.data[i].id === parseInt(action.savedQuery.id, 10)) {
          indexFound = i;
          break;
        }
      }
      const newData = [...state.data];
      if (indexFound > -1) {
        newData[indexFound] = action.savedQuery;
      } else {
        newData.push(action.savedQuery);
      }
      return { ...state, loading: false, data: newData };
    case FETCH_QUERY_FAIL:
      return { ...state, loading: false, error: true };
    default:
      return state;
  }
}
