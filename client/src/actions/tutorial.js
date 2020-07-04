import { updateUser } from "./user";
import { APP_VERSION } from "../config/settings";

export const CHANGE_TUTORIAL = "CHANGE_TUTORIAL";
export const COMPLETE_TUTORIAL = "COMPLETE_TUTORIAL";

export function changeTutorial(tutorial) {
  return (dispatch) => {
    return dispatch({
      type: CHANGE_TUTORIAL,
      tutorial,
    });
  };
}

export function completeTutorial(tut) {
  return (dispatch, getState) => {
    const user = getState().user.data;
    const { tutorial } = getState();
    if (!user.id) throw new Error("No user found");

    // if a tutorial is passed, use the argument, otherwise use current tutorial
    const tempTour = tut ? `${tut}` : `${tutorial}`;
    let tempTutorials = {
      tutorials: {
        [tempTour]: APP_VERSION,
      },
    };

    if (user.tutorials) {
      tempTutorials = {
        tutorials: {
          ...user.tutorials,
          [tempTour]: APP_VERSION,
        },
      };
    }

    dispatch({ type: COMPLETE_TUTORIAL });
    return dispatch(updateUser(user.id, tempTutorials));
  };
}

export function resetTutorial(tuts) {
  return (dispatch, getState) => {
    const user = getState().user.data;

    const tempTutorials = user.tutorials;
    for (let i = 0; i < tuts.length; i++) {
      const tut = tuts[i];
      if (tempTutorials[tut]) {
        delete tempTutorials[tut];
      }
    }

    return dispatch(updateUser(user.id, { tutorials: tempTutorials }));
  };
}
