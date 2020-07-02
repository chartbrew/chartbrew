import {
  CHANGE_TUTORIAL,
  COMPLETE_TUTORIAL
} from "../actions/tutorial";

const initialState = "";

export default function tutorial(state = initialState, action) {
  switch (action.type) {
    case COMPLETE_TUTORIAL:
      return initialState;
    case CHANGE_TUTORIAL:
      return action.tutorial;
    default:
      return state;
  }
}
