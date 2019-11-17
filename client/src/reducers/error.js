import {
  ADD_ERROR,
  REMOVE_ERROR,
  CLEAN_ERRORS,
} from "../actions/error";

const initialState = [];

export default function error(state = initialState, action) {
  switch (action.type) {
    case ADD_ERROR:
      return [action.error, ...state];
    case REMOVE_ERROR:
      return state.filter((error, i) => i !== action.index);
    case CLEAN_ERRORS:
      return state.filter((i) => i.pathname !== window.location.pathname);
    default:
      return state;
  }
}
